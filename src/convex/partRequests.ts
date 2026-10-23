import { archiveDecidedRequestsBefore } from "./archive";
import { notifyUsers } from "./notify";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  type MutationCtx,
  type QueryCtx,
  mutation,
  query,
} from "./_generated/server";
import { hasCapability, memberOrNull } from "./permissions";
import { freeReference } from "./references";
import {
  canEditRequest,
  canRequestStep,
  deliveryNote,
  isRequestInMotion,
  lineDelivered,
  lineRemaining,
  nextRequestStatus,
  requestDelivery,
  type RequestAction,
} from "../lib/requestFlow";
import { richDocToStore } from "../lib/richDoc";
import {
  REJECTION_REASONS,
  REQUEST_STATUSES,
  priorityValidator,
  requestStatusValidator,
  type RequestDecision,
} from "./schema";

import {
  actorName,
  attachmentArgs,
  buildPart,
  decisionReason,
  partPayloadArgs,
  reasonOneLine,
  requireDecisionCapability,
  requireUser,
} from "./_partRequests/helpers";
import {
  holdIncidentForParts,
  syncIncidentWithParts,
} from "./_partRequests/incidentSync";

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

/** El nombre con el que firma quien abre una petición desde la incidencia. */
function actorLabel(user: Doc<"users"> | null, fallback: string): string {
  return user?.name?.trim() || user?.email?.trim() || fallback;
}

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

/**
 * La cola de peticiones por cursor, para cargar el histórico de poco en poco.
 *
 * `list` devuelve la cola entera —la usan las fichas, la búsqueda global y los
 * informes, que necesitan cruzarla con lo demás—. Esta puerta es para pantallas
 * que solo miran: entrega una ventana y el cursor de la siguiente, de la más
 * reciente a la más antigua, para que una instalación con años de peticiones no
 * mande todo el archivo de una vez.
 *
 * Respeta lo mismo que la cola: lo retirado no sale, el archivo solo sale si se
 * pide, y fuera del taller no se devuelve nada.
 */
export const paginatedList = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(requestStatusValidator),
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if ((await memberOrNull(ctx)) === null) {
      return { page: [], isDone: true, continueCursor: "" };
    }

    const status = args.status;
    const paginated = status
      ? await ctx.db
          .query("partRequests")
          .withIndex("by_status_and_createdAt", (q) => q.eq("status", status))
          .order("desc")
          .paginate(args.paginationOpts)
      : await ctx.db
          .query("partRequests")
          .withIndex("by_createdAt")
          .order("desc")
          .paginate(args.paginationOpts);

    const live = paginated.page.filter(
      (request) => request.deletedAt === undefined,
    );
    const visible = args.includeArchived
      ? live
      : live.filter((request) => request.archivedAt === undefined);

    return {
      ...paginated,
      page: await Promise.all(
        visible.map(async (request) => ({
          ...request,
          attachments: await Promise.all(
            (request.attachments ?? []).map(async (attachment) => ({
              ...attachment,
              url: await ctx.storage.getUrl(attachment.storageId),
            })),
          ),
        })),
      ),
    };
  },
});

/**
 * Una petición concreta, para abrirla desde donde no hay cola.
 *
 * La cola no carga el archivo a propósito: sus adjuntos no se firman si no se
 * piden, y un archivo entero de URLs no es lo que nadie necesita al abrir el
 * módulo. Pero la ficha de una incidencia enlaza con el material que se pidió
 * para el caso, y ese material puede estar ya archivado. Esta es la puerta para
 * ese caso: una petición, la que se va a mirar, con sus adjuntos resueltos.
 *
 * Se abre también la archivada —en solo lectura la pinta la ficha— y no la
 * retirada: lo que está en la papelera se ve desde la papelera, no por aquí.
 * Quien no es del taller recibe `null`, como en la cola: esta puerta no enseña
 * más de lo que enseña la lista.
 */
export const detail = query({
  args: { requestId: v.id("partRequests") },
  handler: async (ctx, args) => {
    if ((await memberOrNull(ctx)) === null) return null;
    const request = await ctx.db.get(args.requestId);
    if (!request || request.deletedAt !== undefined) return null;
    return {
      ...request,
      attachments: await Promise.all(
        (request.attachments ?? []).map(async (attachment) => ({
          ...attachment,
          url: await ctx.storage.getUrl(attachment.storageId),
        })),
      ),
    };
  },
});

/**
 * La constancia de lo que le ha pasado a una petición: quién decidió qué y
 * cuándo. Incluye cada tanda de material que ha salido, que es lo que no se puede
 * reconstruir desde la petición —sus líneas guardan el acumulado por repuesto,
 * no quién entregó cada cosa—.
 *
 * Va aparte del documento porque es una lista que crece con cada decisión: no
 * tiene por qué viajar con cada lectura de la cola. Lo más reciente primero, que
 * es lo que se mira al abrir la ficha, y del taller para dentro: fuera de él no
 * se consulta.
 */
export const decisions = query({
  args: { requestId: v.id("partRequests") },
  handler: async (ctx, args) => {
    if ((await memberOrNull(ctx)) === null) return [];
    const rows = await ctx.db
      .query("requestDecisions")
      .withIndex("by_request", (q) => q.eq("requestId", args.requestId))
      .collect();
    // Lo más reciente primero. Las constancias nuevas ya no pueden compartir
    // hora (las apunta `recordDecision`), pero una base con historia de antes
    // puede tenerlas empatadas: se desempata por lo que no empata nunca —cuándo
    // se creó la fila y su identificador—, para que dos lecturas iguales no
    // enseñen el rastro en dos órdenes distintos.
    return rows.sort(
      (a, b) =>
        b.at - a.at ||
        b._creationTime - a._creationTime ||
        (a._id < b._id ? 1 : a._id > b._id ? -1 : 0),
    );
  },
});

/**
 * La hora con la que se apunta una constancia: la de ahora, pero siempre por
 * delante de la última de la misma petición.
 *
 * Dos entregas seguidas —dos tandas, o la que completa el material— pueden caer
 * en el mismo milisegundo, y entonces el rastro ordenado por hora tenía dos
 * filas empatadas: se enseñaban en el orden que quisiera la consulta, que no
 * tiene por qué ser el de los hechos. Avanzar un milisegundo no se nota en la
 * ficha y hace que «lo más reciente primero» signifique siempre lo mismo.
 *
 * La última se busca por orden de creación y no de hora: es la que se acaba de
 * escribir, aunque su hora venga desplazada por este mismo ajuste.
 */
async function decisionAt(
  ctx: MutationCtx,
  requestId: Id<"partRequests">,
): Promise<number> {
  const last = await ctx.db
    .query("requestDecisions")
    .withIndex("by_request", (q) => q.eq("requestId", requestId))
    .order("desc")
    .first();
  const now = Date.now();
  return last === null ? now : Math.max(now, last.at + 1);
}

/**
 * Apunta una constancia de la petición: quién, qué y cuándo. La hora sale de
 * `decisionAt`, que es lo que mantiene el rastro en orden aunque dos decisiones
 * caigan en el mismo milisegundo.
 */
async function recordDecision(
  ctx: MutationCtx,
  requestId: Id<"partRequests">,
  by: string,
  decision: RequestDecision,
): Promise<void> {
  await ctx.db.insert("requestDecisions", {
    requestId,
    by,
    decision,
    at: await decisionAt(ctx, requestId),
  });
}

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
        // Pedir material para un caso lo deja esperando: la incidencia no se
        // trabaja hasta que llegue. El paso y su rastro son de `incidentSync`,
        // que es quien habla con la máquina de la incidencia.
        await holdIncidentForParts(ctx, incident, {
          reference,
          by: actorLabel(requester, requesterName),
        });
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
      await recordDecision(
        ctx,
        args.requestId,
        await actorName(ctx, decisionActor),
        {
          reason:
            request.status === REQUEST_STATUSES.PENDING_SUPPLIER_QUOTE
              ? "pendingExternalQuote"
              : "other",
          note: reasonOneLine(reason),
        },
      );
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
    const resumed = requireRequestStep(
      request,
      "resume",
      () =>
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
    const returned = requireRequestStep(
      request,
      "returnMaterial",
      (status) =>
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

    // Devolver el material deja la incidencia, otra vez, sin lo que necesita:
    // si era la última petición entregada, vuelve a la espera de repuestos.
    if (request.incidentId) {
      await syncIncidentWithParts(ctx, request.incidentId, name);
    }

    await recordDecision(ctx, args.requestId, name, {
      reason: "materialReturned",
      note: reasonOneLine(reason) || "Material devuelto por el técnico.",
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

    // Sin material que vaya a llegar, la incidencia no se queda esperando: vuelve
    // a donde estaba (`partsSettled*`).
    if (request.incidentId) {
      await syncIncidentWithParts(ctx, request.incidentId, name);
    }

    await recordDecision(ctx, args.requestId, name, {
      reason: "requestCancelled",
      note: reasonOneLine(reason) || "Cancelada por decisión del responsable.",
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
    const approved = requireRequestStep(
      request,
      "approve",
      () =>
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
    const rejected = requireRequestStep(
      request,
      "reject",
      () =>
        `La petición ${request.reference} ya fue resuelta y no puede rechazarse.`,
    );

    const now = Date.now();
    const name = await actorName(ctx, userId);
    const reason = decisionReason(args.note);
    await ctx.db.patch(args.requestId, {
      status: rejected,
      decidedBy: name,
      decidedAt: now,
      ...(reason ? { decisionNote: reason } : {}),
    });

    // Un rechazo que deja la incidencia sin peticiones pendientes no la deja
    // esperando: eso lo decide `incidentSync`.
    if (request.incidentId) {
      await syncIncidentWithParts(ctx, request.incidentId, name);
    }
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

/**
 * La entrega, aplicada a las líneas y a la petición: lo que sale, lo que queda y
 * —si ya no queda nada— el paso de la máquina que la cierra.
 *
 * Va aparte porque la usan las dos formas de entregar, la de una línea y la de
 * todas: la cuenta no puede salir distinta según por dónde se entre. Mientras
 * falte material la petición sigue **aprobada** y lo entregado vive en sus
 * líneas; el estado `issued` significa «está todo en manos del técnico», que es
 * lo que necesitan la incidencia y el seguimiento para dejar de esperar.
 *
 * Cada tanda deja además su constancia (`requestDecisions`): quién la entregó,
 * cuándo y qué salió en ella. Las líneas guardan el acumulado por repuesto —cuánto
 * llevan entregado—, y eso no dice quién sacó cada cosa ni en qué momento; el
 * rastro sí, y es lo que se consulta cuando hay que responder por una entrega.
 *
 * `entregas` son unidades que se suman a lo ya entregado de cada línea. Quien
 * llama ya validó que caben en lo que queda: aquí solo se aplican.
 */
async function deliverMaterial(
  ctx: MutationCtx,
  request: Doc<"partRequests">,
  entregas: Map<Id<"spareParts">, number>,
  by: string,
  note: string | undefined,
): Promise<void> {
  const now = Date.now();
  const lines = request.lines.map((line) => {
    const extra = entregas.get(line.sparePartId) ?? 0;
    if (extra === 0) return line;
    return {
      ...line,
      deliveredQuantity: lineDelivered(line, request.status) + extra,
      deliveredAt: now,
    };
  });
  // Lo que sale en esta tanda, línea a línea: es lo que se apunta en la constancia
  // y lo que distingue una tanda de la siguiente.
  const salido = request.lines
    .map((line) => ({ ...line, quantity: entregas.get(line.sparePartId) ?? 0 }))
    .filter((line) => line.quantity > 0);

  // ¿Se ha entregado ya todo? Es la única pregunta que cierra la petición; el
  // resto de entregas parciales no cambian el estado, solo las líneas.
  const complete = requestDelivery(lines, request.status).complete;
  if (complete) {
    const issued = requireRequestStep(
      request,
      "issue",
      (status) =>
        `Solo se pueden entregar peticiones aprobadas (la ${request.reference} está en estado ${status}).`,
    );
    const reason = decisionReason(note);
    await ctx.db.patch(request._id, {
      lines,
      status: issued,
      issuedAt: now,
      ...(reason ? { issueNote: reason } : {}),
    });
  } else {
    await ctx.db.patch(request._id, { lines });
  }

  await recordDecision(ctx, request._id, by, {
    reason: complete
      ? REJECTION_REASONS.MATERIAL_DELIVERED
      : REJECTION_REASONS.MATERIAL_PARTIALLY_DELIVERED,
    note: deliveryNote(salido),
  });

  // La entrega completa cierra la espera: cuando ya no queda material pendiente
  // para la incidencia, pasa a «en reparación». Si aún falta otra petición,
  // sigue esperando.
  if (complete && request.incidentId) {
    await syncIncidentWithParts(ctx, request.incidentId, by);
  }
}

/** Marca una petición aprobada como entregada al técnico, toda de una vez. */
export const markIssued = mutation({
  args: {
    requestId: v.id("partRequests"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const issuerId = await requireDecisionCapability(
      ctx,
      "marcar peticiones como entregadas",
    );
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new ConvexError("La petición ya no existe.");
    // El paso se comprueba antes de tocar nada: desde una petición ya entregada
    // o sin aprobar no hay material que sacar.
    requireRequestStep(
      request,
      "issue",
      (status) =>
        `Solo se pueden entregar peticiones aprobadas (la ${request.reference} está en estado ${status}).`,
    );
    const entregas = new Map(
      request.lines
        .map(
          (line) =>
            [line.sparePartId, lineRemaining(line, request.status)] as const,
        )
        .filter(([, quantity]) => quantity > 0),
    );
    await deliverMaterial(
      ctx,
      request,
      entregas,
      await actorName(ctx, issuerId),
      args.note,
    );
  },
});

/**
 * Entrega el material de una petición de una en una: las unidades que se indican,
 * por línea.
 *
 * El almacén aprueba la petición entera —el stock se descuenta completo—, pero el
 * material puede salir por tandas: quien entrega apunta las dos piezas que se
 * lleva el técnico y las que siguen en el almacén no se dan por entregadas. La
 * petición continúa **aprobada** hasta la última unidad, y es entonces cuando
 * pasa a entregada y la incidencia deja de esperar (`deliverMaterial`).
 *
 * No se puede entregar de lo que no hay: cada cantidad se valida contra lo que
 * queda de su línea, y una línea que ya salió entera no admite más. La entrega
 * se firma con quien la hace, y la nota —si la hay— se guarda con la entrega
 * completa, que es la que cierra la petición.
 */
export const issueLines = mutation({
  args: {
    requestId: v.id("partRequests"),
    lines: v.array(
      v.object({
        sparePartId: v.id("spareParts"),
        quantity: v.number(),
      }),
    ),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const issuerId = await requireDecisionCapability(
      ctx,
      "marcar peticiones como entregadas",
    );
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new ConvexError("La petición ya no existe.");
    if (!canRequestStep(request.status, "issue")) {
      throw new ConvexError(
        `Solo se pueden entregar peticiones aprobadas (la ${request.reference} está en estado ${request.status}).`,
      );
    }
    if (args.lines.length === 0) {
      throw new ConvexError(
        "Indica qué repuestos se entregan en esta tanda y cuántas unidades de cada uno.",
      );
    }

    const entregas = new Map<Id<"spareParts">, number>();
    for (const entry of args.lines) {
      const line = request.lines.find(
        (candidate) => candidate.sparePartId === entry.sparePartId,
      );
      if (!line) {
        throw new ConvexError(
          "Uno de los repuestos indicados no forma parte de esta petición: actualiza la ficha y vuelve a intentarlo.",
        );
      }
      const quantity = Math.floor(entry.quantity);
      if (!Number.isFinite(entry.quantity) || quantity < 1) {
        throw new ConvexError(
          `Indica cuántas unidades de ${line.code} (${line.name}) se entregan: una o más.`,
        );
      }
      const remaining = lineRemaining(line, request.status);
      if (remaining === 0) {
        throw new ConvexError(
          `De ${line.code} (${line.name}) ya está entregado todo: no queda nada por sacar.`,
        );
      }
      const already = entregas.get(line.sparePartId) ?? 0;
      if (quantity + already > remaining) {
        throw new ConvexError(
          `De ${line.code} (${line.name}) quedan ${remaining} por entregar y se indican ${quantity + already}.`,
        );
      }
      entregas.set(line.sparePartId, already + quantity);
    }

    await deliverMaterial(
      ctx,
      request,
      entregas,
      await actorName(ctx, issuerId),
      args.note,
    );
  },
});

/* ------------------------------------------------------------------ */
/* Re-exportaciones de sub-módulos CQS (papelera)                     */
/* ------------------------------------------------------------------ */

export {
  withdraw,
  restore,
  deleteNow,
  purgeExpired,
  trash,
  withdrawn,
  type WithdrawnRequestItem,
} from "./_partRequests/trash";
