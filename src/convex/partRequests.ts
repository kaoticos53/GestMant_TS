import { getAuthUserId } from "@convex-dev/auth/server";
import { archiveDecidedRequestsBefore } from "./archive";
import { notifyUsers } from "./notify";
import { ConvexError, v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import {
  MutationCtx,
  QueryCtx,
  internalMutation,
  mutation,
  query,
} from "./_generated/server";
import { hasCapability, memberOrNull } from "./permissions";
import { freeReference } from "./references";
import {
  canEditRequest,
  isRequestInMotion,
  nextRequestStatus,
  type RequestAction,
} from "../lib/requestFlow";
import { richDocToPlainText, richDocToStore } from "../lib/richDoc";
import { trashPurgeAt } from "../lib/trash";
import {
  REQUEST_STATUSES,
  priorityValidator,
  requestStatusValidator,
} from "./schema";
import { trashRetentionDays } from "./trash";

/** Toda la gestión de peticiones requiere sesión iniciada. */
async function requireUser(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new ConvexError(
      "Debes iniciar sesión para gestionar las peticiones.",
    );
  }
  const user = await ctx.db.get(userId);
  if (!user || user.active === false || user.isAnonymous === true) {
    throw new ConvexError(
      user?.active === false
        ? "Esta cuenta ha sido dada de baja o no está activa."
        : "Debes iniciar sesión con una cuenta registrada para gestionar las peticiones.",
    );
  }
  return userId;
}

/** Decisiones sobre peticiones: capacidad «decideRequests» (admin siempre). */
async function requireDecisionCapability(ctx: QueryCtx, action: string) {
  const userId = await requireUser(ctx);
  const user = await ctx.db.get(userId);
  if (!user || !(await hasCapability(ctx, user, "decideRequests"))) {
    throw new ConvexError(
      `No tienes permisos para ${action}. Revisa la configuración de tu rol con el administrador.`,
    );
  }
  return userId;
}

/** Nombre visible de quien firma una decisión. */
async function actorName(ctx: QueryCtx, userId: Id<"users">) {
  const user = await ctx.db.get(userId);
  return user?.name || user?.email || "Responsable de repuestos";
}

/**
 * El motivo de una decisión, tal y como se guarda: el documento que escribe el
 * editor —con sus negritas, sus listas y sus fotos— o, si no dice nada, nada.
 */
function decisionReason(note: string | undefined): string | undefined {
  return richDocToStore(note);
}

/**
 * El mismo motivo, en una línea: es lo que queda en la traza de decisiones, que
 * se lee de un vistazo y no admite el formato de la ficha.
 */
function reasonOneLine(reason: string | undefined): string {
  return richDocToPlainText(reason);
}

const attachmentArgs = v.array(
  v.object({
    storageId: v.id("_storage"),
    name: v.string(),
    kind: v.union(v.literal("image"), v.literal("document")),
  }),
);

const partPayloadArgs = {
  code: v.string(),
  name: v.string(),
  description: v.optional(v.string()),
  category: v.string(),
  unit: v.string(),
  stock: v.number(),
  minStock: v.number(),
  location: v.optional(v.string()),
  supplier: v.optional(v.string()),
  partNumber: v.optional(v.string()),
  unitPrice: v.optional(v.number()),
  purchaseUrl: v.optional(v.string()),
};

type PartPayload = {
  code: string;
  name: string;
  description?: string;
  category: string;
  unit: string;
  stock: number;
  minStock: number;
  location?: string;
  supplier?: string;
  partNumber?: string;
  unitPrice?: number;
  purchaseUrl?: string;
};

/** Construye el documento de repuesto a partir de los datos del formulario. */
function buildPart(payload: PartPayload) {
  const code = payload.code.trim().toUpperCase();
  const name = payload.name.trim();
  if (!code) throw new ConvexError("El código del repuesto es obligatorio.");
  if (!name) throw new ConvexError("El nombre del repuesto es obligatorio.");
  return {
    code,
    name,
    ...(richDocToStore(payload.description)
      ? { description: richDocToStore(payload.description) }
      : {}),
    category: payload.category,
    unit: payload.unit.trim() || "ud",
    stock: Math.max(0, Math.floor(payload.stock)),
    minStock: Math.max(0, Math.floor(payload.minStock)),
    ...(payload.location?.trim()
      ? { location: payload.location.trim().toUpperCase() }
      : {}),
    ...(payload.supplier?.trim() ? { supplier: payload.supplier.trim() } : {}),
    ...(payload.partNumber?.trim()
      ? { partNumber: payload.partNumber.trim() }
      : {}),
    ...(typeof payload.unitPrice === "number" && payload.unitPrice >= 0
      ? { unitPrice: payload.unitPrice }
      : {}),
    ...(payload.purchaseUrl?.trim()
      ? { purchaseUrl: payload.purchaseUrl.trim() }
      : {}),
  };
}

async function assertPending(ctx: QueryCtx, requestId: Id<"partRequests">) {
  const request = await ctx.db.get(requestId);
  if (!request) throw new ConvexError("La petición ya no existe.");
  if (!canEditRequest(request.status)) {
    throw new ConvexError(
      `La petición ${request.reference} ya fue resuelta y no puede modificarse.`,
    );
  }
  return request;
}

/* La máquina de la petición («¿desde aquí se puede dar este paso?») vive en
 * `lib/requestFlow`, compartida con los botones de la ficha y con la recepción
 * de compras. Aquí solo quedan los avisos, que son de quien lo intenta. */

/** El paso, o el aviso de por qué no se puede dar desde donde está. */
function requireRequestStep(
  request: Doc<"partRequests">,
  action: RequestAction,
  blocked: (status: Doc<"partRequests">["status"]) => string,
): Doc<"partRequests">["status"] {
  const next = nextRequestStatus(request.status, action, request.heldFrom);
  if (next === null) throw new ConvexError(blocked(request.status));
  return next;
}

/** URL de subida para fotos y documentos de una petición. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const list = query({
  args: {
    status: v.optional(requestStatusValidator),
    /** Incluir también lo archivado (para las fichas que enlazan con él). */
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Invitado o cuenta de baja: vacío en vez de error (el panel pide esta lista
    // al montar). Las escrituras siguen exigiendo una cuenta con `requireUser`.
    if ((await memberOrNull(ctx)) === null) return [];
    const status = args.status;
    const requests = status
      ? await ctx.db
          .query("partRequests")
          .withIndex("by_status", (q) => q.eq("status", status))
          .collect()
      : await ctx.db.query("partRequests").collect();

    // Lo retirado no está en ninguna de las dos caras de la cola: ni en el día a
    // día ni en el archivo. Vive en la papelera (`trash`), que es su propia
    // pantalla: colarlo aquí devolvería a las listas algo que se retiró.
    const live = requests.filter((request) => request.deletedAt === undefined);
    // El día a día no ve el archivo; solo se resuelven sus adjuntos cuando se
    // piden expresamente (así no se generan URLs para lo archivado).
    const active = args.includeArchived
      ? live
      : live.filter((request) => request.archivedAt === undefined);

    const sorted = active.sort((a, b) => b.createdAt - a.createdAt);
    return await Promise.all(
      sorted.map(async (request) => ({
        ...request,
        attachments: await Promise.all(
          (request.attachments ?? []).map(async (attachment) => ({
            ...attachment,
            url: await ctx.storage.getUrl(attachment.storageId),
          })),
        ),
      })),
    );
  },
});

export const create = mutation({
  args: {
    requesterName: v.string(),
    requesterTeam: v.optional(v.string()),
    equipment: v.optional(v.string()),
    equipmentId: v.optional(v.id("equipment")),
    priority: priorityValidator,
    description: v.optional(v.string()),
    attachments: v.optional(attachmentArgs),
    notes: v.optional(v.string()),
    incidentId: v.optional(v.id("incidents")),
    lines: v.optional(
      v.array(
        v.object({
          sparePartId: v.id("spareParts"),
          quantity: v.number(),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const requesterUserId = await requireUser(ctx);
    const requester = await ctx.db.get(requesterUserId);
    if (
      !requester ||
      !(await hasCapability(ctx, requester, "createRequests"))
    ) {
      throw new ConvexError(
        "No tienes permisos para crear peticiones. Revisa la configuración de tu rol con el administrador.",
      );
    }
    const requesterName = args.requesterName.trim();
    if (!requesterName) {
      throw new ConvexError("Indica quién solicita el repuesto.");
    }

    const requestedLines = args.lines ?? [];
    // La descripción puede venir del editor como documento (bloques con
    // formato): lo que cuenta para «hay algo que pedir» es su texto, no su
    // formato.
    const description = richDocToStore(args.description);
    // La nota del solicitante también la escribe el editor, así que se guarda
    // como documento: su formato no debe perderse por el camino.
    const notes = richDocToStore(args.notes);
    const attachments = args.attachments ?? [];
    if (
      requestedLines.length === 0 &&
      !description &&
      attachments.length === 0
    ) {
      throw new ConvexError(
        "Añade un repuesto del catálogo o describe lo que necesitas (con fotos o documentos si los tienes).",
      );
    }

    const lines = [];
    for (const line of requestedLines) {
      const quantity = Math.floor(line.quantity);
      if (quantity < 1) {
        throw new ConvexError(
          "Cada repuesto solicitado necesita una cantidad de 1 o más.",
        );
      }
      const part = await ctx.db.get(line.sparePartId);
      if (!part) {
        throw new ConvexError(
          "Uno de los repuestos seleccionados ya no existe en el catálogo.",
        );
      }
      lines.push({
        sparePartId: part._id,
        code: part.code,
        name: part.name,
        quantity,
      });
    }

    // La referencia se reparte con la regla de todas las series
    // (`lib/references`): el número más alto ya usado, más uno. Nunca cuántas
    // filas hay: la papelera borra de verdad lo retirado, y contando filas la
    // siguiente petición heredaría una referencia ya gastada —la que quedó libre
    // al borrar— que además sigue citada en las órdenes de compra que salieron de
    // ella.
    const reference = await freeReference(ctx, "partRequest");

    let equipmentText = args.equipment?.trim() ?? "";
    if (args.equipmentId) {
      const item = await ctx.db.get(args.equipmentId);
      if (!item) {
        throw new ConvexError(
          "El equipo seleccionado ya no existe en el inventario.",
        );
      }
      if (!equipmentText) equipmentText = `${item.name} ${item.model}`.trim();
    }

    await ctx.db.insert("partRequests", {
      reference,
      requesterName,
      ...(requesterUserId ? { requesterId: requesterUserId } : {}),
      ...(args.requesterTeam?.trim()
        ? { requesterTeam: args.requesterTeam.trim() }
        : {}),
      ...(equipmentText ? { equipment: equipmentText } : {}),
      ...(args.equipmentId ? { equipmentId: args.equipmentId } : {}),
      priority: args.priority,
      status: REQUEST_STATUSES.PENDING,
      lines,
      ...(description ? { description } : {}),
      ...(attachments.length > 0 ? { attachments } : {}),
      ...(notes ? { notes } : {}),
      ...(args.incidentId ? { incidentId: args.incidentId } : {}),
      createdAt: Date.now(),
    });

    if (args.incidentId) {
      const incident = await ctx.db.get(args.incidentId);
      if (incident) {
        const interested = [
          incident.assigneeId,
          incident.workshopAssigneeId,
        ].filter((id): id is NonNullable<typeof id> => Boolean(id));
        await notifyUsers(
          ctx,
          interested,
          `${reference} creada para la incidencia ${incident.reference}`,
          incident._id,
        );
      }
    }

    return reference;
  },
});

/** Vincula al catálogo un repuesto ya existente. */
export const associateExisting = mutation({
  args: {
    requestId: v.id("partRequests"),
    sparePartId: v.id("spareParts"),
    quantity: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireDecisionCapability(ctx, "asociar repuestos a una petición");
    const request = await assertPending(ctx, args.requestId);
    const part = await ctx.db.get(args.sparePartId);
    if (!part) throw new ConvexError("El repuesto seleccionado ya no existe.");
    if (request.lines.some((line) => line.sparePartId === part._id)) {
      throw new ConvexError(
        `${part.code} ya está asociado a ${request.reference}.`,
      );
    }
    const quantity = Math.max(1, Math.floor(args.quantity ?? 1));
    await ctx.db.patch(args.requestId, {
      lines: [
        ...request.lines,
        { sparePartId: part._id, code: part.code, name: part.name, quantity },
      ],
    });
    return `${part.code} asociado a ${request.reference}`;
  },
});

/** Crea el repuesto investigado (proveedor, part number...) y lo asocia. */
export const associateNew = mutation({
  args: {
    requestId: v.id("partRequests"),
    quantity: v.optional(v.number()),
    part: v.object(partPayloadArgs),
  },
  handler: async (ctx, args) => {
    await requireDecisionCapability(ctx, "crear y asociar repuestos");
    const request = await assertPending(ctx, args.requestId);

    const doc = buildPart(args.part);
    const clash = await ctx.db
      .query("spareParts")
      .withIndex("by_code", (q) => q.eq("code", doc.code))
      .unique();
    if (clash) {
      throw new ConvexError(
        `Ya existe un repuesto con el código ${doc.code}. Asócialo desde «Catálogo existente» en lugar de crearlo otra vez.`,
      );
    }

    const now = Date.now();
    const sparePartId = await ctx.db.insert("spareParts", {
      ...doc,
      createdAt: now,
      updatedAt: now,
    });

    const quantity = Math.max(1, Math.floor(args.quantity ?? 1));
    await ctx.db.patch(args.requestId, {
      lines: [
        ...request.lines,
        { sparePartId, code: doc.code, name: doc.name, quantity },
      ],
    });
    return `${doc.code} creado y asociado a ${request.reference}`;
  },
});

/** Suspende temporalmente una petición. */
export const onHold = mutation({
  args: {
    requestId: v.id("partRequests"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const decisionActor = await requireDecisionCapability(
      ctx,
      "suspender peticiones",
    );
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new ConvexError("La petición ya no existe.");
    const held = requireRequestStep(request, "hold", (status) =>
      status === REQUEST_STATUSES.ON_HOLD
        ? `La petición ${request.reference} ya está en espera.`
        : status === REQUEST_STATUSES.CANCELLED
          ? `La petición ${request.reference} ya estaba cancelada.`
          : `Solo se pueden poner en espera las peticiones pendientes, aprobadas o pendientes de presupuesto (la ${request.reference} está en ${status}).`,
    );

    const now = Date.now();
    const reason = decisionReason(args.note);
    await ctx.db.patch(args.requestId, {
      status: held,
      holdSinceAt: now,
      // De dónde sale la suspensión: al reanudar se vuelve ahí. Es lo que evita
      // que una petición aprobada —con el material ya descontado— vuelva a
      // pendiente y se apruebe otra vez, descontando el material dos veces.
      heldFrom: request.status,
      ...(reason ? { holdNote: reason } : {}),
    });

    if (reason) {
      await ctx.db.insert("requestDecisions", {
        requestId: args.requestId,
        by: await actorName(ctx, decisionActor),
        decision: {
          reason:
            request.status === REQUEST_STATUSES.PENDING_SUPPLIER_QUOTE
              ? "pendingExternalQuote"
              : "other",
          note: reasonOneLine(reason),
        },
        at: now,
      });
    }
  },
});

/** Reanuda una petición que estaba en espera. */
export const resume = mutation({
  args: { requestId: v.id("partRequests") },
  handler: async (ctx, args) => {
    await requireDecisionCapability(ctx, "reanudar peticiones");
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new ConvexError("La petición ya no existe.");
    const resumed = requireRequestStep(request, "resume", () =>
      `Solo se pueden reanudar peticiones en espera (la ${request.reference} está en ${request.status}).`,
    );

    await ctx.db.patch(args.requestId, {
      status: resumed,
      holdSinceAt: undefined,
      holdNote: undefined,
      heldFrom: undefined,
    });
  },
});

/** Devuelve el material de una petición entregada. */
export const returnMaterial = mutation({
  args: {
    requestId: v.id("partRequests"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const decisionActor = await requireDecisionCapability(
      ctx,
      "devolver material",
    );
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new ConvexError("La petición ya no existe.");
    const returned = requireRequestStep(request, "returnMaterial", (status) =>
      `Solo se pueden devolver peticiones ya entregadas (la ${request.reference} está en ${status}).`,
    );

    const now = Date.now();
    const name = await actorName(ctx, decisionActor);
    const reason = decisionReason(args.note);
    await ctx.db.patch(args.requestId, {
      status: returned,
      returnedAt: now,
      ...(reason ? { returnNote: reason } : {}),
    });

    await ctx.db.insert("requestDecisions", {
      requestId: args.requestId,
      by: name,
      decision: {
        reason: "materialReturned",
        note: reasonOneLine(reason) || "Material devuelto por el técnico.",
      },
      at: now,
    });
  },
});

/** Cancela una petición que no se va a atender. */
export const cancel = mutation({
  args: {
    requestId: v.id("partRequests"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const decisionActor = await requireDecisionCapability(
      ctx,
      "cancelar peticiones",
    );
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new ConvexError("La petición ya no existe.");
    const cancelled = requireRequestStep(request, "cancel", (status) =>
      status === REQUEST_STATUSES.CANCELLED
        ? `La petición ${request.reference} ya estaba cancelada.`
        : status === REQUEST_STATUSES.ISSUED
          ? `Antes de cancelar la petición ${request.reference}, devuélvela desde «Devolver material».`
          : status === REQUEST_STATUSES.APPROVED ||
              status === REQUEST_STATUSES.RETURNED
            ? `La petición ${request.reference} tiene material comprometido: para cancelarla primero gestiona la devolución o reintegro de stock.`
            : `Solo se pueden cancelar las peticiones pendientes, en espera o pendientes de presupuesto (la ${request.reference} está en ${status}).`,
    );

    const now = Date.now();
    const name = await actorName(ctx, decisionActor);
    const reason = decisionReason(args.note);
    await ctx.db.patch(args.requestId, {
      status: cancelled,
      cancelledAt: now,
      ...(reason ? { cancelNote: reason } : {}),
    });

    await ctx.db.insert("requestDecisions", {
      requestId: args.requestId,
      by: name,
      decision: {
        reason: "requestCancelled",
        note:
          reasonOneLine(reason) || "Cancelada por decisión del responsable.",
      },
      at: now,
    });
  },
});

/** Pide presupuesto externo antes de decidir una petición. */
export const requestQuote = mutation({
  args: {
    requestId: v.id("partRequests"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireDecisionCapability(ctx, "pedir presupuesto externo");
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new ConvexError("La petición ya no existe.");
    const quoted = requireRequestStep(request, "requestQuote", (status) =>
      status === REQUEST_STATUSES.PENDING_SUPPLIER_QUOTE
        ? `La petición ${request.reference} ya está en modo presupuesto pendiente.`
        : `Solo se puede pedir presupuesto externo desde pendiente o en espera (la ${request.reference} está en ${status}).`,
    );

    const reason = decisionReason(args.note);
    await ctx.db.patch(args.requestId, {
      status: quoted,
      quoteRequestedAt: Date.now(),
      ...(reason ? { decisionNote: reason } : {}),
    });
  },
});

/** Aprueba la petición: aparta material descontando el stock del catálogo. */
export const approve = mutation({
  args: {
    requestId: v.id("partRequests"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireDecisionCapability(
      ctx,
      "aprobar o rechazar peticiones",
    );
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new ConvexError("La petición ya no existe.");
    // Pendiente o con el material ya recibido: lo comprado entra en el almacén
    // y se aprueba desde ahí, que es cuando hay existencias que apartar.
    const approved = requireRequestStep(request, "approve", () =>
      `La petición ${request.reference} ya fue resuelta y no puede aprobarse.`,
    );
    if (request.lines.length === 0) {
      throw new ConvexError(
        `La petición ${request.reference} no tiene ningún repuesto asociado. Asocia el repuesto (o crea uno nuevo con el proveedor y su nº de parte) antes de aprobar.`,
      );
    }

    const parts = [];
    for (const line of request.lines) {
      const part = await ctx.db.get(line.sparePartId);
      if (!part) {
        throw new ConvexError(
          `El repuesto ${line.code} ya no está en el catálogo. Rechaza la petición o restáuralo.`,
        );
      }
      if (part.stock < line.quantity) {
        throw new ConvexError(
          `Stock insuficiente de ${part.code} (${part.name}): hay ${part.stock} ${part.unit} y se solicitan ${line.quantity}.`,
        );
      }
      parts.push(part);
    }

    const now = Date.now();
    for (let i = 0; i < request.lines.length; i++) {
      const part = parts[i];
      await ctx.db.patch(part._id, {
        stock: part.stock - request.lines[i].quantity,
        updatedAt: now,
      });
    }

    const reason = decisionReason(args.note);
    await ctx.db.patch(args.requestId, {
      status: approved,
      decidedBy: await actorName(ctx, userId),
      decidedAt: now,
      ...(reason ? { decisionNote: reason } : {}),
    });
  },
});

/** Rechaza la petición sin tocar el stock. */
export const reject = mutation({
  args: {
    requestId: v.id("partRequests"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireDecisionCapability(
      ctx,
      "aprobar o rechazar peticiones",
    );
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new ConvexError("La petición ya no existe.");
    const rejected = requireRequestStep(request, "reject", () =>
      `La petición ${request.reference} ya fue resuelta y no puede rechazarse.`,
    );

    const reason = decisionReason(args.note);
    await ctx.db.patch(args.requestId, {
      status: rejected,
      decidedBy: await actorName(ctx, userId),
      decidedAt: Date.now(),
      ...(reason ? { decisionNote: reason } : {}),
    });
  },
});

/* ------------------------------------------------------------------ */
/* Archivo: sacar del día a día lo ya decidido y antiguo, sin perderlo  */
/* ------------------------------------------------------------------ */

/** Manda una petición ya decidida al archivo. */
export const archive = mutation({
  args: { requestId: v.id("partRequests") },
  handler: async (ctx, args) => {
    const userId = await requireDecisionCapability(ctx, "archivar peticiones");
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new ConvexError("La petición ya no existe.");
    if (request.archivedAt !== undefined) return;
    if (isRequestInMotion(request.status)) {
      throw new ConvexError(
        `La petición ${request.reference} sigue en movimiento: resuélvela, aprobárala o cancelala antes de archivarla.`,
      );
    }

    await ctx.db.patch(args.requestId, {
      archivedAt: Date.now(),
      archivedBy: await actorName(ctx, userId),
    });
  },
});

/** Devuelve una petición del archivo a la cola. */
export const unarchive = mutation({
  args: { requestId: v.id("partRequests") },
  handler: async (ctx, args) => {
    await requireDecisionCapability(ctx, "recuperar peticiones");
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new ConvexError("La petición ya no existe.");
    if (request.archivedAt === undefined) return;

    await ctx.db.patch(args.requestId, {
      archivedAt: undefined,
      archivedBy: undefined,
    });
  },
});

/** Archivado masivo a mano de peticiones ya decididas. */
export const archiveDecidedBefore = mutation({
  args: { before: v.number() },
  handler: async (ctx, args) => {
    const userId = await requireDecisionCapability(ctx, "archivar peticiones");
    if (!Number.isFinite(args.before)) {
      throw new ConvexError("Indica una fecha de corte válida.");
    }
    return await archiveDecidedRequestsBefore(ctx, {
      before: args.before,
      by: await actorName(ctx, userId),
    });
  },
});

/** Marca una petición aprobada como entregada al técnico. */
export const markIssued = mutation({
  args: {
    requestId: v.id("partRequests"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireDecisionCapability(ctx, "marcar peticiones como entregadas");
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new ConvexError("La petición ya no existe.");
    const issued = requireRequestStep(request, "issue", (status) =>
      `Solo se pueden entregar peticiones aprobadas (la ${request.reference} está en estado ${status}).`,
    );
    const reason = decisionReason(args.note);
    await ctx.db.patch(args.requestId, {
      status: issued,
      issuedAt: Date.now(),
      ...(reason ? { issueNote: reason } : {}),
    });
  },
});

/* ------------------------------------------------------------------ */
/* Papelera: lo retirado espera antes de borrarse de verdad            */
/* ------------------------------------------------------------------ */

/** Tandas de la pasada nocturna, como en la papelera de incidencias. */
const PURGE_LIMIT = 100;

/**
 * Borra de verdad una petición retirada: su fila y los archivos que adjuntaba.
 * Es lo irreversible, así que solo lo llaman el borrado a mano y la pasada de la
 * papelera, nunca la retirada.
 *
 * Lo que sí se queda son las peticiones de compra que se pidieron por ella: son
 * la constancia de lo que se compró, y guardan copiada la referencia de la
 * petición, así que siguen leyéndose —y recibiéndose— sin la petición de la que
 * salieron.
 */
async function purgeRequest(
  ctx: MutationCtx,
  request: Doc<"partRequests">,
): Promise<void> {
  for (const attachment of request.attachments ?? []) {
    await ctx.storage.delete(attachment.storageId);
  }
  await ctx.db.delete(request._id);
}

/**
 * Retira una petición: se pidió por error o es el duplicado de otra. No se borra
 * —eso sería irreversible— sino que sale de la cola y espera en la papelera con
 * el mismo plazo que lo retirado del almacén y de las incidencias (`lib/trash`).
 *
 * Vale para cualquier estado: lo que se retira es la petición entera, con sus
 * decisiones, no un paso de su flujo. Retirar dos veces la misma petición no es
 * un error.
 */
export const withdraw = mutation({
  args: { requestId: v.id("partRequests"), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await requireDecisionCapability(ctx, "retirar peticiones");
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new ConvexError("La petición ya no existe.");
    if (request.deletedAt !== undefined) return;

    const now = Date.now();
    const reason = args.reason?.trim();
    await ctx.db.patch(args.requestId, {
      deletedAt: now,
      deletedBy: await actorName(ctx, userId),
      ...(reason ? { deletedReason: reason } : {}),
      // El plazo vigente se cuenta ahora, no al recuperarla: lo retirado cumple
      // el plazo con el que entró, igual que en la papelera del almacén.
      purgeAt: trashPurgeAt(now, await trashRetentionDays(ctx)),
    });
  },
});

/**
 * Recupera una petición de la papelera: vuelve a la cola —o al archivo, si de
 * ahí salió— tal y como estaba, con sus repuestos asociados, sus decisiones y
 * sus adjuntos.
 */
export const restore = mutation({
  args: { requestId: v.id("partRequests") },
  handler: async (ctx, args) => {
    await requireDecisionCapability(ctx, "recuperar peticiones");
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new ConvexError("La petición ya no existe.");
    if (request.deletedAt === undefined) return;

    await ctx.db.patch(args.requestId, {
      deletedAt: undefined,
      deletedBy: undefined,
      deletedReason: undefined,
      purgeAt: undefined,
    });
  },
});

/**
 * Borra ya una petición retirada, sin esperar el plazo: lo que alguien retiró y
 * ahora confirma que no quiere. Es la única forma de borrar de verdad, así que
 * pide que la petición esté retirada: lo que no ha pasado por la papelera no se
 * borra de un tirón.
 */
export const deleteNow = mutation({
  args: { requestId: v.id("partRequests") },
  handler: async (ctx, args) => {
    await requireDecisionCapability(ctx, "borrar peticiones");
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new ConvexError("La petición ya no existe.");
    if (request.deletedAt === undefined) {
      throw new ConvexError(
        "Retira la petición antes de borrarla: lo que no pasa por la papelera no se puede recuperar.",
      );
    }
    await purgeRequest(ctx, request);
  },
});

/**
 * La pasada de la papelera de peticiones: borra de verdad lo que cumplió su
 * plazo sin que nadie lo recuperara. Va por tandas, como la del almacén y la de
 * incidencias, y no toca nada más: lo que está dentro de plazo espera a su
 * noche.
 */
export const purgeExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("partRequests")
      .withIndex("by_purgeAt", (q) => q.lt("purgeAt", Date.now()))
      .take(PURGE_LIMIT);

    let purged = 0;
    for (const request of rows) {
      // El índice solo guarda lo retirado; aun así, un `purgeAt` suelto —un dato
      // viejo— no borra una petición que está en la cola.
      if (request.deletedAt === undefined) continue;
      await purgeRequest(ctx, request);
      purged += 1;
    }
    return purged;
  },
});

/** Una petición en la papelera, tal y como la enseña el módulo Archivo. */
export interface WithdrawnRequestItem {
  id: Id<"partRequests">;
  reference: string;
  status: Doc<"partRequests">["status"];
  requesterName: string;
  requesterTeam: string | null;
  equipment: string | null;
  /** Lo que pide —repuestos o descripción—, en texto plano: una línea de lista. */
  summary: string;
  deletedAt: number;
  deletedBy: string | null;
  deletedReason: string | null;
  purgeAt: number;
  /** Salió del archivo: recuperarla la devuelve allí, no a la cola. */
  archived: boolean;
}

/**
 * La papelera de peticiones, para el módulo Archivo: lo retirado —lo que antes
 * se borra, delante— y el plazo vigente. La ve quien decide peticiones: es la
 * pantalla desde la que se deshace, y lo retirado no es del día a día de nadie.
 */
export const trash = query({
  args: {},
  handler: async (ctx) => {
    await requireDecisionCapability(ctx, "ver la papelera de peticiones");

    const rows = await ctx.db
      .query("partRequests")
      .withIndex("by_deletedAt")
      .collect();
    const items: WithdrawnRequestItem[] = rows
      .filter((row) => row.deletedAt !== undefined)
      .map((row) => ({
        id: row._id,
        reference: row.reference,
        status: row.status,
        requesterName: row.requesterName,
        requesterTeam: row.requesterTeam ?? null,
        equipment: row.equipment ?? null,
        summary:
          row.lines.map((line) => `${line.code} ${line.name}`).join(" · ") ||
          richDocToPlainText(row.description),
        deletedAt: row.deletedAt!,
        deletedBy: row.deletedBy ?? null,
        deletedReason: row.deletedReason ?? null,
        // Sin fecha de borrado —dato viejo— se cuenta desde que se retiró.
        purgeAt: row.purgeAt ?? row.deletedAt!,
        archived: row.archivedAt !== undefined,
      }))
      // Lo que antes se va, delante: es lo que pide una decisión.
      .sort((a, b) => a.purgeAt - b.purgeAt);

    return {
      items,
      nextPurgeAt: items[0]?.purgeAt ?? null,
      retentionDays: await trashRetentionDays(ctx),
    };
  },
});
