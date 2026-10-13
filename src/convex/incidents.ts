import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { MutationCtx, QueryCtx, internalMutation, mutation, query } from "./_generated/server";
import { archiveClosedIncidentsBefore } from "./archive";
import { readAuditAlertRoles } from "./auditAlerts";
import { notifyUsers } from "./notify";
import {
  grantsForRole,
  hasAnyCapability,
  hasCapability,
  memberOrNull,
} from "./permissions";
import { assertReportImages } from "./reportUploads";
import { trashRetentionDays } from "./trash";
import { documentMoveAlert, summarizeAudit } from "../lib/audit";
import {
  INCIDENT_WITHDRAWN_NOTICE,
  isWithdrawnNotice,
  looksLikeEmail,
  mailableStatus,
  normalizeReporterEmail,
} from "../lib/incidentMail";
import type { IncidentMailNotice } from "../lib/incidentMail";
import type { Capability } from "../lib/permissions";
import { DEFAULT_ROLE } from "../lib/roles";
import { richDocToPlainText, richDocToStore } from "../lib/richDoc";
import { trashPurgeAt } from "../lib/trash";
import {
  NOTE_EDIT_WINDOW_MS,
  isNoteWithinEditWindow,
  normalizeIncidentReference,
} from "../lib/workshop";
import {
  DOCUMENT_ACTIONS,
  INCIDENT_STATUSES,
  ROLES,
  documentActionValidator,
  type DocumentAction,
  incidentStatusValidator,
} from "./schema";

/** Manejo de incidentes: ciclo de vida, asignación, taller, archivo, documentos y notas. */

const H = 60 * 60 * 1000;
const DAY = 24 * H;

type Actor = Doc<"users">;
type LifecycleNote = NonNullable<Doc<"incidents">["lifecycleNotes"]>[number];

/** Coordinador del taller: responsable de repuestos o administrador. */
function isModerator(user: Actor | null): boolean {
  return user?.role === ROLES.ADMIN || user?.role === ROLES.MANAGER;
}

function actorName(user: Actor): string {
  return user.name?.trim() || user.email?.trim() || "Usuario del taller";
}

/** ¿La incidencia está en manos de este actor (técnico u orden de taller)? */
function isAssignedTo(actor: Actor, incident: Doc<"incidents">): boolean {
  return (
    incident.assigneeId === actor._id ||
    incident.workshopAssigneeId === actor._id
  );
}

/**
 * Los documentos adjuntos los mueve solo quien coordina la incidencia: son el
 * expediente del caso, no el cuaderno de trabajo de quien lo repara. Es también
 * el permiso para leer su rastro de auditoría, que forma parte del expediente.
 */
async function requireDocumentEditor(
  ctx: QueryCtx | MutationCtx,
): Promise<Actor> {
  const actor = await requireActor(ctx);
  if (!(await hasCapability(ctx, actor, "manageIncidents"))) {
    throw new ConvexError(
      isModerator(actor)
        ? "No tienes permisos para gestionar los documentos de una incidencia. Revisa la configuración de tu rol con el administrador."
        : "Solo el coordinador puede adjuntar, editar o quitar documentos de una incidencia.",
    );
  }
  return actor;
}

/**
 * Una nota solo la cambia quien la escribió, y solo dentro del plazo. Ni el rol
 * ni tener la incidencia asignada dan derecho a editar la de otro: el cuaderno
 * se corrige, no se reescribe. Lo que sí vale es haberla escrito y que después
 * te la hayan reasignado: el permiso viaja con la nota, no con la asignación.
 */
function requireNoteOwnership(
  actor: Actor,
  entry: LifecycleNote,
  now: number,
): void {
  if (entry.authorId === undefined) {
    throw new ConvexError(
      "Esta nota ya forma parte del historial de la incidencia y no se puede cambiar.",
    );
  }
  if (entry.authorId !== actor._id) {
    throw new ConvexError(
      "Solo quien escribió la nota puede corregirla o retirarla.",
    );
  }
  // Se cuenta desde que se escribió de verdad: `at` puede ser retroactiva.
  if (!isNoteWithinEditWindow(entry.createdAt ?? entry.at, now)) {
    throw new ConvexError(
      `El plazo para corregir una nota son ${Math.round(
        NOTE_EDIT_WINDOW_MS / 60_000,
      )} minutos, y la de esta incidencia ya ha terminado.`,
    );
  }
}

/**
 * Una nota retirada ya no está en el cuaderno: hay que recuperarla antes de
 * volver a tocarla (corregirla o retirarla otra vez).
 */
function requireLiveNote(entry: LifecycleNote): void {
  if (entry.deletedAt !== undefined) {
    throw new ConvexError(
      "Esa nota está retirada: recupérala desde la ficha de la incidencia para poder cambiarla.",
    );
  }
}

/** Posición de una nota en el hilo, localizada por su identificador propio. */
function noteIndex(notes: LifecycleNote[], noteId: string): number {
  const index = notes.findIndex((entry) => entry.id === noteId);
  if (index === -1) {
    throw new ConvexError("Esa nota ya no está en la incidencia.");
  }
  return index;
}

/**
 * Las notas sí son el cuaderno de trabajo: las escribe quien coordina y también
 * el técnico que tiene la incidencia asignada (o su orden de taller), que es
 * quien está delante del equipo anotando lo que prueba.
 */
async function requireNoteAuthor(
  ctx: MutationCtx,
  actor: Actor,
  incident: Doc<"incidents">,
): Promise<void> {
  if (await hasCapability(ctx, actor, "manageIncidents")) return;
  if (isAssignedTo(actor, incident)) return;
  throw new ConvexError(
    "Solo el técnico asignado o quien coordina la incidencia pueden añadir notas.",
  );
}

/**
 * Quién puede corregir los datos del equipo: el mismo que escribe en el
 * cuaderno —quien coordina y quien tiene la incidencia entre manos—, que es
 * quien puede llegar a saber el modelo y el número de serie de verdad.
 */
async function requireEquipmentEditor(
  ctx: MutationCtx,
  actor: Actor,
  incident: Doc<"incidents">,
): Promise<void> {
  if (await hasCapability(ctx, actor, "manageIncidents")) return;
  if (isAssignedTo(actor, incident)) return;
  throw new ConvexError(
    "Solo el técnico asignado o quien coordina la incidencia pueden corregir los datos del equipo.",
  );
}

/** Usuarios activos cuyo rol tiene esa capacidad.
 * (Los permisos de cada rol se resuelven una sola vez por rol.) */
async function idsWithCapability(
  ctx: QueryCtx | MutationCtx,
  capability: Capability,
): Promise<Id<"users">[]> {
  const users = await ctx.db.query("users").collect();
  const byRole = new Map<string, Promise<Record<Capability, boolean>>>();
  const grantsOf = (roleKey: string) => {
    let pending = byRole.get(roleKey);
    if (!pending) {
      pending = grantsForRole(ctx, roleKey);
      byRole.set(roleKey, pending);
    }
    return pending;
  };
  const ids: Id<"users">[] = [];
  for (const user of users) {
    if (user.active === false) continue;
    const grants = await grantsOf(user.role ?? DEFAULT_ROLE);
    if (grants[capability]) ids.push(user._id);
  }
  return ids;
}

/** Coordinadores del taller para los avisos: quien tiene «manageIncidents». */
async function moderatorIds(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<"users">[]> {
  return await idsWithCapability(ctx, "manageIncidents");
}

/**
 * Quién recibe los avisos del expediente: los usuarios activos cuyo rol está en
 * la audiencia configurada en «Ajustes del taller». Es un reparto, no un
 * permiso: quien esté en la lista los recibe aunque no pueda auditar, y quien
 * audite sin estar en ella no —el rastro completo sigue leyéndose en el módulo
 * de Auditoría—. De partida la lista es solo el administrador, que es quien
 * audita hoy.
 */
async function auditAlertRecipientIds(
  ctx: MutationCtx,
): Promise<Id<"users">[]> {
  const roles = new Set(await readAuditAlertRoles(ctx));
  if (roles.size === 0) return [];
  const users = await ctx.db.query("users").collect();
  return users
    .filter(
      (user) => user.active !== false && roles.has(user.role ?? DEFAULT_ROLE),
    )
    .map((user) => user._id);
}

/** Usuario autenticado o error. */
async function requireActor(ctx: QueryCtx | MutationCtx): Promise<Actor> {
  const userId = await getAuthUserId(ctx);
  const user = userId === null ? null : await ctx.db.get(userId);
  if (!user || user.active === false || user.isAnonymous === true) {
    throw new ConvexError(
      user?.active === false
        ? "Esta cuenta ha sido dada de baja o no está activa."
        : "Debes iniciar sesión con una cuenta registrada para gestionar incidencias.",
    );
  }
  return user;
}

async function getIncident(ctx: QueryCtx | MutationCtx, id: Id<"incidents">) {
  const incident = await ctx.db.get(id);
  if (!incident) throw new ConvexError("La incidencia ya no existe.");
  return incident;
}

/** Traza que cada paso deja en la ficha de la incidencia. */
function historyEntry(
  status: (typeof INCIDENT_STATUSES)[keyof typeof INCIDENT_STATUSES],
  at: number,
  by?: string,
  note?: string,
) {
  return {
    status,
    at,
    ...(by ? { by } : {}),
    ...(note ? { note } : {}),
  };
}

/**
 * Programa el aviso por correo a quien notificó. Se programa en vez de esperar:
 * el correo sale por la pasarela de la plataforma, y eso es cosa de una acción
 * —una mutación no puede salir a la red—, así que la ficha cierra su cambio de
 * estado sin quedarse mirando al cartero. No se programa nada si quien notificó
 * no dejó correo, si lo que hay que contarle no se cuenta por correo o si ya se
 * le contó lo mismo. La decisión fina vive en `convex/incidentMail`.
 */
async function scheduleReporterEmail(
  ctx: MutationCtx,
  incident: Doc<"incidents">,
  notice: IncidentMailNotice,
  /** La retirada: cuándo se está apuntando, que la ficha leída aún no lo sabe. */
  withdrawnAt?: number,
): Promise<void> {
  if (!incident.reporterEmail) return;
  if (isWithdrawnNotice(notice)) {
    // Sin fecha de retirada no hay nada que contar; y si el último aviso salió
    // después de retirarla, esta retirada ya se contó.
    const at = withdrawnAt ?? incident.deletedAt;
    if (at === undefined) return;
    if (incident.emailedAt !== undefined && incident.emailedAt >= at) return;
  } else {
    if (mailableStatus(notice) === null) return;
    if (incident.emailedStatus === notice) return;
  }
  await ctx.scheduler.runAfter(0, internal.incidentMail.notifyReporter, {
    incidentId: incident._id,
  });
}

/**
 * Reporta una incidencia. Es la única función pública del módulo: el
 * notificador no tiene por qué estar registrado en la aplicación.
 */
export const report = mutation({
  args: {
    reporterName: v.string(),
    reporterRole: v.optional(v.string()),
    // Correo de quien notifica, si lo deja: solo sirve para avisarle cuando el
    // caso cambie de estado (`convex/incidentMail`). Opcional a propósito.
    reporterEmail: v.optional(v.string()),
    location: v.optional(v.string()),
    equipmentKind: v.string(),
    model: v.string(),
    serialNumber: v.optional(v.string()),
    description: v.string(),
    reportedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const reporterName = args.reporterName.trim();
    if (!reporterName) {
      throw new ConvexError("Indica tu nombre y apellidos.");
    }
    const equipmentKind = args.equipmentKind.trim();
    if (!equipmentKind) throw new ConvexError("Indica el tipo de equipo.");
    const model = args.model.trim();
    if (!model) throw new ConvexError("Indica el modelo del equipo.");
    // El correo es opcional —avisar sin cuenta no debe exigir dejar datos de
    // contacto—, pero si se escribe tiene que servir para responder. Una errata
    // de dedo se avisa aquí, que es cuando todavía se puede corregir, y no
    // cuando el correo se rebota semanas después sin que nadie lo vea.
    const reporterEmail = args.reporterEmail?.trim()
      ? normalizeReporterEmail(args.reporterEmail)
      : undefined;
    if (reporterEmail !== undefined && !looksLikeEmail(reporterEmail)) {
      throw new ConvexError(
        "Ese correo no parece una dirección válida. Revísalo o déjalo en blanco.",
      );
    }
    // La descripción viene como documento del editor (párrafos, listas,
    // imágenes) y así se guarda; el mínimo se cuenta sobre lo que dice, no
    // sobre su estructura (si no, un documento sin texto colaría).
    const description = richDocToStore(args.description);
    if (
      description === undefined ||
      richDocToPlainText(description).length < 10
    ) {
      throw new ConvexError(
        "Describe la incidencia con un poco más de detalle (mínimo 10 caracteres).",
      );
    }
    // Las fotos las sube quien no tiene cuenta por el camino del formulario
    // público, y aquí se comprueba que cada una es de las que él mismo aceptó:
    // la puerta abierta no vale para colar cualquier archivo.
    await assertReportImages(ctx, description);
    if (args.reportedAt > Date.now() + DAY) {
      throw new ConvexError("La fecha de notificación no puede ser futura.");
    }

    // Referencia autoincremental INC-0001 eficiente (sin cargar toda la tabla en memoria)
    const latest = await ctx.db
      .query("incidents")
      .withIndex("by_createdAt")
      .order("desc")
      .take(100);

    // Protección anti-inundación básica
    const recentFromReporter = latest.find(
      (item) =>
        item.reporterName.toLowerCase() === reporterName.toLowerCase() &&
        item.createdAt > Date.now() - 30_000,
    );
    if (recentFromReporter) {
      throw new ConvexError(
        "Ya has notificado una incidencia recientemente. Por favor, espera 30 segundos antes de enviar otra.",
      );
    }

    // La referencia es con lo que se sigue el caso —lo que se teclea para
    // consultarlo—, así que no puede repetirse. Se parte de la más alta que hay
    // (el índice va por referencia y, con el mismo ancho, eso es el número) y se
    // avanza hasta la primera libre. Mirar solo las últimas 100 dejaría fuera la
    // referencia más alta cuando el histórico trae fechas repartidas, y el aviso
    // nuevo repetiría un número ya usado; con la referencia repetida, la consulta
    // de quien la recibió ya no sabría a qué incidencia contesta.
    const highest = await ctx.db
      .query("incidents")
      .withIndex("by_reference")
      .order("desc")
      .first();
    let seq = Number(/^INC-(\d+)$/.exec(highest?.reference ?? "")?.[1] ?? 0);
    let reference: string;
    do {
      seq += 1;
      reference = `INC-${String(seq).padStart(4, "0")}`;
    } while (
      (await ctx.db
        .query("incidents")
        .withIndex("by_reference", (q) => q.eq("reference", reference))
        .first()) !== null
    );

    const now = Date.now();
    const incidentId = await ctx.db.insert("incidents", {
      reference,
      reporterName,
      ...(reporterEmail ? { reporterEmail } : {}),
      ...(args.reporterRole?.trim()
        ? { reporterRole: args.reporterRole.trim() }
        : {}),
      ...(args.location?.trim() ? { location: args.location.trim() } : {}),
      equipmentKind,
      model,
      ...(args.serialNumber?.trim()
        ? { serialNumber: args.serialNumber.trim() }
        : {}),
      description,
      reportedAt: args.reportedAt,
      status: INCIDENT_STATUSES.REPORTED,
      history: [
        historyEntry(INCIDENT_STATUSES.REPORTED, args.reportedAt, reporterName),
      ],
      createdAt: now,
      updatedAt: now,
    });

    // Aviso a los interesados: coordinadores del taller
    const reporterUserId = await getAuthUserId(ctx);
    await notifyUsers(
      ctx,
      await moderatorIds(ctx),
      `Nueva incidencia ${reference}: ${equipmentKind} ${model}${
        args.location?.trim() ? ` · ${args.location.trim()}` : ""
      }`,
      incidentId,
      reporterUserId ?? undefined,
    );

    return reference;
  },
});

/**
 * Cola de incidencias (más recientes primero). Requiere sesión. Por defecto
 * deja fuera lo archivado: el archivo se consulta aparte.
 */
export const list = query({
  args: { includeArchived: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    // Invitado o cuenta de baja: vacío en vez de error (el panel pide esta lista
    // al montar). El resto de acciones sigue exigiendo una cuenta (`requireActor`).
    if ((await memberOrNull(ctx)) === null) return [];
    const items = await ctx.db
      .query("incidents")
      .withIndex("by_createdAt")
      .order("desc")
      .collect();
    // Lo retirado no está en ninguna de las dos caras de la cola: ni en el día a
    // día ni en el archivo. Vive en la papelera (`trash`), que es su propia
    // pantalla: colarlo aquí lo devolvería a las listas de las que se retiró.
    const live = items.filter((item) => item.deletedAt === undefined);
    const visible = args.includeArchived
      ? live
      : live.filter((item) => item.archivedAt === undefined);
    // Los documentos del expediente viajan con su enlace ya resuelto: la ficha
    // los abre tal cual, sin una consulta por documento. Es la misma forma que
    // devuelven los adjuntos de una petición.
    return await Promise.all(
      visible.map(async (item) => ({
        ...item,
        documents: await Promise.all(
          (item.documents ?? []).map(async (document) => ({
            ...document,
            url: document.storageId
              ? await ctx.storage.getUrl(document.storageId)
              : null,
          })),
        ),
      })),
    );
  },
});

/**
 * Lo que se enseña de una incidencia a quien no es del taller: el recorte del
 * seguimiento. Es una lista de campos explícita a propósito —y no «todo menos
 * esto»—: una columna nueva del esquema no se cuela aquí sola, y las notas
 * internas, el expediente y quién dio cada paso del historial se quedan dentro.
 */
function trackingOf(incident: Doc<"incidents">) {
  return {
    reference: incident.reference,
    status: incident.status,
    equipmentKind: incident.equipmentKind ?? null,
    model: incident.model ?? null,
    serialNumber: incident.serialNumber ?? null,
    location: incident.location ?? null,
    description: incident.description,
    reportedAt: incident.reportedAt,
    closedAt: incident.closedAt ?? null,
    // Quién la lleva: el técnico y, si ha pasado por taller, su responsable.
    assigneeName: incident.assigneeName ?? null,
    workshopAssigneeName: incident.workshopAssigneeName ?? null,
    // El historial, solo con el paso y su fecha: lo que cuenta cada paso y quién
    // lo dio es el cuaderno del taller, no lo que se le enseña al notificador.
    history: incident.history.map((entry) => ({
      status: entry.status,
      at: entry.at,
    })),
  };
}

/**
 * Consultar una incidencia por su referencia («INC-0004»). Es el camino de quien
 * la notificó y no es del taller: recibe esa referencia al avisar y con ella
 * sigue el caso. La cola entera no la ve —`list` le devuelve vacío—; esto, en
 * cambio, sí, y con lo justo.
 *
 * Pide sesión, y una de invitado vale: la referencia circula por un correo o por
 * un papel, y esto no es una puerta abierta para quien ni siquiera ha entrado.
 * Nunca devuelve la ficha entera: lo que sale de aquí es el recorte de
 * `trackingOf`, sin notas internas, documentos ni adjuntos.
 *
 * `null` si no hay ninguna con esa referencia —el panel lo cuenta como «no
 * encontramos ninguna»—, y también si lo escrito no lleva ningún número.
 */
export const byReference = query({
  args: { reference: v.string() },
  handler: async (ctx, args) => {
    if ((await getAuthUserId(ctx)) === null) {
      throw new ConvexError(
        "Debes iniciar sesión para consultar una incidencia por su referencia.",
      );
    }
    const reference = normalizeIncidentReference(args.reference);
    if (reference === null) return null;
    // `first` y no `unique`: una instalación con datos viejos puede tener la
    // misma referencia repetida, y eso tiene que contestar (la más antigua) en
    // vez de tumbar la consulta de quien la recibió.
    const incident = await ctx.db
      .query("incidents")
      .withIndex("by_reference", (q) => q.eq("reference", reference))
      .first();
    // Una incidencia retirada no se sigue: se retiró porque es duplicada o
    // equivocada, así que su referencia deja de contar el caso. Si se recupera
    // desde la papelera, vuelve a contestar como si nunca hubiera pasado.
    if (incident === null || incident.deletedAt !== undefined) return null;
    return trackingOf(incident);
  },
});

/** El coordinador elige a qué técnico asignar (solo coordinadores). */
export const assign = mutation({
  args: {
    incidentId: v.id("incidents"),
    assigneeId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    if (!(await hasCapability(ctx, actor, "manageIncidents"))) {
      throw new ConvexError(
        isModerator(actor)
          ? "No tienes permisos para asignar incidencias. Revisa la configuración de tu rol con el administrador."
          : "Solo el coordinador puede asignar incidencias a otros técnicos. Los técnicos pueden autoasignarse las pendientes.",
      );
    }
    const incident = await getIncident(ctx, args.incidentId);
    if (
      incident.status !== INCIDENT_STATUSES.REPORTED &&
      incident.status !== INCIDENT_STATUSES.ASSIGNED
    ) {
      throw new ConvexError(
        "Solo se puede asignar una incidencia pendiente o ya en curso.",
      );
    }
    const assignee = await ctx.db.get(args.assigneeId);
    if (!assignee)
      throw new ConvexError("El técnico seleccionado ya no existe.");

    const now = Date.now();
    const assigneeName = actorName(assignee);
    await ctx.db.patch(args.incidentId, {
      status: INCIDENT_STATUSES.ASSIGNED,
      assigneeId: assignee._id,
      assigneeName,
      updatedAt: now,
      history: [
        ...incident.history,
        historyEntry(
          INCIDENT_STATUSES.ASSIGNED,
          now,
          actorName(actor),
          `Asignada a ${assigneeName}`,
        ),
      ],
    });
    await scheduleReporterEmail(ctx, incident, INCIDENT_STATUSES.ASSIGNED);
    await notifyUsers(
      ctx,
      [assignee._id],
      `${incident.reference} asignada a ti${incident.location ? ` · ${incident.location}` : ""}`,
      incident._id,
      actor._id,
    );
  },
});

/**
 * Autoasignación: cualquier técnico que vea la cola se lleva una pendiente.
 * La capacidad se comprueba en el backend como en el resto del módulo: sin
 * «ver la cola de incidencias» ni «gestionar incidencias» el rol no puede
 * llevarse trabajo aunque no tenga el módulo en el menú.
 */
export const selfAssign = mutation({
  args: { incidentId: v.id("incidents") },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    if (
      !(await hasAnyCapability(ctx, actor, [
        "viewIncidents",
        "manageIncidents",
      ]))
    ) {
      throw new ConvexError(
        "Solo quien ve la cola de incidencias puede autoasignarse las pendientes. Revisa la configuración de tu rol con el administrador.",
      );
    }
    const incident = await getIncident(ctx, args.incidentId);
    if (incident.status !== INCIDENT_STATUSES.REPORTED) {
      throw new ConvexError(
        incident.assigneeName
          ? `Ya está asignada a ${incident.assigneeName}.`
          : "Esta incidencia ya no está pendiente de asignación.",
      );
    }

    const now = Date.now();
    const name = actorName(actor);
    await ctx.db.patch(args.incidentId, {
      status: INCIDENT_STATUSES.ASSIGNED,
      assigneeId: actor._id,
      assigneeName: name,
      updatedAt: now,
      history: [
        ...incident.history,
        historyEntry(
          INCIDENT_STATUSES.ASSIGNED,
          now,
          name,
          "Autoasignada por el técnico",
        ),
      ],
    });
    await scheduleReporterEmail(ctx, incident, INCIDENT_STATUSES.ASSIGNED);
    await notifyUsers(
      ctx,
      await moderatorIds(ctx),
      `${incident.reference} autoasignada por ${name}`,
      incident._id,
      actor._id,
    );
  },
});

/**
 * Verificación de una incidencia asignada:
 * - "onsite": se resuelve in situ → queda cerrada (resuelta).
 * - "workshop": hay que desplazar el equipo → entrada de incidencia a taller.
 * - "unresolved": se cierra sin resolución.
 * Al cerrar (in situ o sin resolución) y haber equipo relacionado, se crea la
 * ficha de historial en el equipo.
 */
export const verify = mutation({
  args: {
    incidentId: v.id("incidents"),
    outcome: v.union(
      v.literal("onsite"),
      v.literal("workshop"),
      v.literal("unresolved"),
    ),
    equipmentId: v.optional(v.id("equipment")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    const incident = await getIncident(ctx, args.incidentId);
    const canCoordinate = await hasCapability(ctx, actor, "manageIncidents");
    if (
      !canCoordinate &&
      incident.assigneeId !== actor._id &&
      incident.workshopAssigneeId !== actor._id
    ) {
      throw new ConvexError(
        "Solo el técnico asignado o el coordinador pueden verificar esta incidencia.",
      );
    }
    if (incident.status !== INCIDENT_STATUSES.ASSIGNED) {
      throw new ConvexError(
        "La incidencia debe estar asignada para verificarla.",
      );
    }
    if (args.equipmentId) {
      const equipment = await ctx.db.get(args.equipmentId);
      if (!equipment)
        throw new ConvexError("El equipo seleccionado ya no existe.");
    }

    const notes = richDocToStore(args.notes);
    const now = Date.now();
    const name = actorName(actor);

    if (args.outcome === "workshop") {
      await ctx.db.patch(args.incidentId, {
        status: INCIDENT_STATUSES.WORKSHOP,
        workshopAssigneeId: actor._id,
        workshopAssigneeName: name,
        ...(args.equipmentId ? { equipmentId: args.equipmentId } : {}),
        updatedAt: now,
        history: [
          ...incident.history,
          historyEntry(
            INCIDENT_STATUSES.WORKSHOP,
            now,
            name,
            notes ? `Derivada a taller · ${notes}` : "Derivada a taller",
          ),
        ],
      });
      await notifyUsers(
        ctx,
        [
          ...(await moderatorIds(ctx)),
          ...(incident.assigneeId ? [incident.assigneeId] : []),
        ],
        `${incident.reference} derivada a taller (${name})`,
        incident._id,
        actor._id,
      );
      await scheduleReporterEmail(ctx, incident, INCIDENT_STATUSES.WORKSHOP);
      return;
    }

    // Cierre in situ o sin resolución: se crea la ficha si hay equipo
    const status =
      args.outcome === "onsite"
        ? INCIDENT_STATUSES.RESOLVED
        : INCIDENT_STATUSES.UNRESOLVED;
    const equipmentId = args.equipmentId ?? incident.equipmentId;
    const maintenanceId = equipmentId
      ? await createHistorySheet(ctx, {
          incident,
          equipmentId,
          status,
          notes,
          technician: name,
          closedAt: now,
        })
      : undefined;

    await ctx.db.patch(args.incidentId, {
      status,
      ...(args.equipmentId ? { equipmentId: args.equipmentId } : {}),
      ...(notes ? { notes } : {}),
      closedAt: now,
      ...(maintenanceId ? { maintenanceId } : {}),
      updatedAt: now,
      history: [
        ...incident.history,
        historyEntry(
          status,
          now,
          name,
          args.outcome === "onsite"
            ? notes
              ? `Resuelta in situ · ${notes}`
              : "Resuelta in situ"
            : notes
              ? `Cerrada sin resolución · ${notes}`
              : "Cerrada sin resolución",
        ),
      ],
    });

    const label =
      status === INCIDENT_STATUSES.RESOLVED ? "resuelta" : "sin resolución";
    await notifyUsers(
      ctx,
      [
        ...(await moderatorIds(ctx)),
        ...(incident.assigneeId ? [incident.assigneeId] : []),
      ],
      `${incident.reference} cerrada ${label} por ${name}`,
      incident._id,
      actor._id,
    );
    await scheduleReporterEmail(ctx, incident, status);
  },
});

/**
 * Entrada de incidencia a taller: el coordinador (o el técnico que la deriva)
 * la asigna al mismo u otro técnico.
 */
export const assignWorkshop = mutation({
  args: {
    incidentId: v.id("incidents"),
    assigneeId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    const incident = await getIncident(ctx, args.incidentId);
    const canCoordinate = await hasCapability(ctx, actor, "manageIncidents");
    if (!canCoordinate && incident.workshopAssigneeId !== actor._id) {
      throw new ConvexError(
        "Solo el coordinador o el técnico de la orden pueden reasignar la entrada a taller.",
      );
    }
    if (incident.status !== INCIDENT_STATUSES.WORKSHOP) {
      throw new ConvexError(
        "La incidencia no tiene ninguna entrada de taller abierta.",
      );
    }
    const assignee = await ctx.db.get(args.assigneeId);
    if (!assignee)
      throw new ConvexError("El técnico seleccionado ya no existe.");

    const now = Date.now();
    const assigneeName = actorName(assignee);
    await ctx.db.patch(args.incidentId, {
      workshopAssigneeId: assignee._id,
      workshopAssigneeName: assigneeName,
      updatedAt: now,
      history: [
        ...incident.history,
        historyEntry(
          INCIDENT_STATUSES.WORKSHOP,
          now,
          actorName(actor),
          `Orden de taller asignada a ${assigneeName}`,
        ),
      ],
    });
    await notifyUsers(
      ctx,
      [assignee._id],
      `Orden de taller de ${incident.reference} asignada a ti`,
      incident._id,
      actor._id,
    );
  },
});

/**
 * Cierre de la entrada de taller: resuelta o sin resolución, con los datos
 * del técnico. Si hay equipo relacionado se crea la ficha de historial.
 */
export const close = mutation({
  args: {
    incidentId: v.id("incidents"),
    outcome: v.union(v.literal("resolved"), v.literal("unresolved")),
    equipmentId: v.optional(v.id("equipment")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    const incident = await getIncident(ctx, args.incidentId);
    const canCoordinate = await hasCapability(ctx, actor, "manageIncidents");
    if (
      !canCoordinate &&
      incident.workshopAssigneeId !== actor._id &&
      incident.assigneeId !== actor._id
    ) {
      throw new ConvexError(
        "Solo el técnico de la orden o el coordinador pueden cerrar esta incidencia.",
      );
    }
    if (incident.status !== INCIDENT_STATUSES.WORKSHOP) {
      throw new ConvexError(
        "La incidencia no tiene una entrada de taller abierta.",
      );
    }
    if (args.equipmentId) {
      const equipment = await ctx.db.get(args.equipmentId);
      if (!equipment)
        throw new ConvexError("El equipo seleccionado ya no existe.");
    }

    const notes = richDocToStore(args.notes);
    const now = Date.now();
    const name = actorName(actor);
    const status =
      args.outcome === "resolved"
        ? INCIDENT_STATUSES.RESOLVED
        : INCIDENT_STATUSES.UNRESOLVED;
    const equipmentId = args.equipmentId ?? incident.equipmentId;
    const maintenanceId = equipmentId
      ? await createHistorySheet(ctx, {
          incident,
          equipmentId,
          status,
          notes,
          technician: name,
          closedAt: now,
        })
      : undefined;

    await ctx.db.patch(args.incidentId, {
      status,
      ...(args.equipmentId ? { equipmentId: args.equipmentId } : {}),
      ...(notes ? { notes } : {}),
      closedAt: now,
      ...(maintenanceId ? { maintenanceId } : {}),
      updatedAt: now,
      history: [
        ...incident.history,
        historyEntry(
          status,
          now,
          name,
          notes
            ? `Trabajo en taller finalizado · ${notes}`
            : "Trabajo en taller finalizado",
        ),
      ],
    });

    const label =
      status === INCIDENT_STATUSES.RESOLVED ? "resuelta" : "sin resolución";
    await notifyUsers(
      ctx,
      [
        ...(await moderatorIds(ctx)),
        ...(incident.assigneeId ? [incident.assigneeId] : []),
        ...(incident.workshopAssigneeId ? [incident.workshopAssigneeId] : []),
      ],
      `${incident.reference} cerrada ${label} por ${name}`,
      incident._id,
      actor._id,
    );
    await scheduleReporterEmail(ctx, incident, status);
  },
});

/* ------------------------------------------------------------------ */
/* Datos del equipo: corregir lo que se notificó mal o a medias         */
/* ------------------------------------------------------------------ */

/**
 * Corrige el modelo y el nº de serie del equipo de una incidencia. Quien la
 * notifica no tiene el equipo delante y lo describe de memoria: a veces se
 * equivoca y a veces deja el nº de serie en blanco. Quien sí lo tiene delante
 * —el técnico que la lleva o quien coordina— es el único que puede ponerlos
 * bien, y son justo los dos datos que identifican la máquina en la ficha de
 * historial y con los que se compone su intervención.
 *
 * Vale para cualquier estado: el dato es del equipo, no de un paso del flujo, y
 * corregirlo después de cerrar sigue valiendo para el historial de la máquina
 * (que se compone con estos mismos campos). Deja su traza en la ficha, como los
 * demás pasos, diciendo qué cambió.
 *
 * Un campo sin enviar se deja como está, y enviarlo en blanco es quitarlo —así
 * se corrige el dato que era erróneo, y no por descuido al mandar solo uno de
 * los dos—. El modelo, en cambio, no puede quedarse vacío: es lo que identifica
 * la máquina en su historial, y el formulario de notificación tampoco lo admite
 * en blanco.
 */
export const updateEquipment = mutation({
  args: {
    incidentId: v.id("incidents"),
    model: v.optional(v.string()),
    serialNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    const incident = await getIncident(ctx, args.incidentId);
    await requireEquipmentEditor(ctx, actor, incident);

    const model =
      args.model === undefined ? incident.model : args.model.trim() || undefined;
    if (model === undefined) {
      throw new ConvexError(
        "Escribe el modelo del equipo: es lo que identifica la máquina en su historial.",
      );
    }
    const serialNumber =
      args.serialNumber === undefined
        ? incident.serialNumber
        : args.serialNumber.trim() || undefined;
    if (model === incident.model && serialNumber === incident.serialNumber) {
      throw new ConvexError(
        "Esos son los datos que ya tiene la incidencia: cambia el modelo o el nº de serie.",
      );
    }

    const now = Date.now();
    const name = actorName(actor);
    // El rastro dice qué cambió, no solo que cambió: es lo que permite leer la
    // ficha de un vistazo y saber de dónde salió el dato que hay ahora.
    const changes = [
      ...(model !== incident.model ? [`modelo ${model}`] : []),
      ...(serialNumber !== incident.serialNumber
        ? [serialNumber ? `nº de serie ${serialNumber}` : "sin nº de serie"]
        : []),
    ];

    await ctx.db.patch(args.incidentId, {
      // Vaciar es una corrección, no un descuido: si el dato que había era
      // erróneo, se quita (y `undefined` es como se quita un campo aquí).
      model,
      serialNumber,
      updatedAt: now,
      history: [
        ...incident.history,
        historyEntry(
          incident.status,
          now,
          name,
          `Datos del equipo corregidos · ${changes.join(" · ")}`,
        ),
      ],
    });
  },
});

/* ------------------------------------------------------------------ */
/* Archivo: sacar del día a día lo cerrado y antiguo, sin perderlo      */
/* ------------------------------------------------------------------ */

/** ¿Está cerrada? El archivo es solo para lo ya terminado. */
function isClosedIncident(status: string): boolean {
  return (
    status === INCIDENT_STATUSES.RESOLVED ||
    status === INCIDENT_STATUSES.UNRESOLVED
  );
}

/** Archivar el histórico es tarea de coordinación. */
async function requireArchiveCapability(ctx: MutationCtx): Promise<Actor> {
  const actor = await requireActor(ctx);
  if (!(await hasCapability(ctx, actor, "manageIncidents"))) {
    throw new ConvexError(
      isModerator(actor)
        ? "No tienes permisos para archivar incidencias. Revisa la configuración de tu rol con el administrador."
        : "Solo el coordinador puede archivar incidencias. Pídeselo al responsable del taller.",
    );
  }
  return actor;
}

/**
 * Manda una incidencia cerrada al archivo: desaparece de la cola del día a
 * día pero se sigue encontrando desde el módulo de archivo. Archivar dos veces
 * la misma incidencia no es un error.
 */
export const archive = mutation({
  args: { incidentId: v.id("incidents") },
  handler: async (ctx, args) => {
    const actor = await requireArchiveCapability(ctx);
    const incident = await getIncident(ctx, args.incidentId);
    if (incident.archivedAt !== undefined) return;
    if (!isClosedIncident(incident.status)) {
      throw new ConvexError(
        "Solo se pueden archivar incidencias cerradas (resueltas o sin resolución).",
      );
    }

    const now = Date.now();
    const name = actorName(actor);
    await ctx.db.patch(args.incidentId, {
      archivedAt: now,
      archivedBy: name,
      updatedAt: now,
      history: [
        ...incident.history,
        historyEntry(incident.status, now, name, "Archivada"),
      ],
    });
  },
});

/** Devuelve una incidencia del archivo a la cola, con su traza. */
export const unarchive = mutation({
  args: { incidentId: v.id("incidents") },
  handler: async (ctx, args) => {
    const actor = await requireArchiveCapability(ctx);
    const incident = await getIncident(ctx, args.incidentId);
    if (incident.archivedAt === undefined) return;

    const now = Date.now();
    const name = actorName(actor);
    await ctx.db.patch(args.incidentId, {
      archivedAt: undefined,
      archivedBy: undefined,
      updatedAt: now,
      history: [
        ...incident.history,
        historyEntry(incident.status, now, name, "Recuperada del archivo"),
      ],
    });
  },
});

/**
 * Archivado masivo a mano: todo lo cerrado antes de la fecha de corte. Es la
 * limpieza de fondo del histórico (por meses o años), sin tocar nada que siga
 * vivo. Devuelve cuántas incidencias se han archivado. Las reglas de qué se
 * archiva viven en `archive.ts`, compartidas con el archivado automático.
 */
export const archiveClosedBefore = mutation({
  args: { before: v.number() },
  handler: async (ctx, args) => {
    const actor = await requireArchiveCapability(ctx);
    if (!Number.isFinite(args.before)) {
      throw new ConvexError("Indica una fecha de corte válida.");
    }
    return await archiveClosedIncidentsBefore(ctx, {
      before: args.before,
      by: actorName(actor),
    });
  },
});

/* ------------------------------------------------------------------ */
/* Papelera: retirar lo equivocado o duplicado, con plazo para volver   */
/* ------------------------------------------------------------------ */

/** Retirar una incidencia es tarea de coordinación, como archivarla. */
async function requireWithdrawCapability(ctx: MutationCtx): Promise<Actor> {
  const actor = await requireActor(ctx);
  if (!(await hasCapability(ctx, actor, "manageIncidents"))) {
    throw new ConvexError(
      isModerator(actor)
        ? "No tienes permisos para retirar incidencias. Revisa la configuración de tu rol con el administrador."
        : "Solo el coordinador puede retirar una incidencia. Pídeselo al responsable del taller.",
    );
  }
  return actor;
}

/**
 * Tope de una pasada de la papelera: no borra de golpe todo lo que haya
 * caducado. Como las demás pasadas, si queda más, la siguiente sigue por donde
 * esta lo dejó.
 */
const PURGE_LIMIT = 100;

/**
 * Borra de verdad una incidencia retirada: su expediente y los avisos que la
 * señalaban. Es lo irreversible, así que solo lo llaman el borrado a mano y la
 * pasada de la papelera, nunca la retirada.
 *
 * Dos cosas se quedan a propósito: el rastro de auditoría de los documentos
 * (`incidentDocumentLog` no se borra nunca: es la única constancia de un adjunto
 * retirado) y la ficha de historial del equipo, que es del equipo y no de la
 * incidencia. Los archivos del expediente sí se van con ella: nadie los cita ya.
 */
async function purgeIncident(
  ctx: MutationCtx,
  incident: Doc<"incidents">,
): Promise<void> {
  const documents = await ctx.db
    .query("incidentDocuments")
    .withIndex("by_incident", (q) => q.eq("incidentId", incident._id))
    .collect();
  for (const document of documents) {
    if (document.storageId) await ctx.storage.delete(document.storageId);
    await ctx.db.delete(document._id);
  }
  // Los avisos que señalaban a esta incidencia se van con ella: sin la ficha,
  // pulsarlos no llevaría a ninguna parte.
  const notifications = await ctx.db.query("notifications").collect();
  for (const notification of notifications) {
    if (notification.incidentId === incident._id) {
      await ctx.db.delete(notification._id);
    }
  }
  await ctx.db.delete(incident._id);
}

/**
 * Retira una incidencia: quien la notificó se equivocó o es el duplicado de
 * otra. No se borra —eso sería irreversible— sino que sale de la cola y espera
 * en la papelera con el mismo plazo que lo retirado del almacén, por si hay que
 * volver a por ella (`lib/trash`).
 *
 * Vale para cualquier estado: lo que se retira es el caso entero, no un paso del
 * flujo. Retirar dos veces la misma incidencia no es un error.
 */
export const withdraw = mutation({
  args: { incidentId: v.id("incidents"), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const actor = await requireWithdrawCapability(ctx);
    const incident = await getIncident(ctx, args.incidentId);
    if (incident.deletedAt !== undefined) return;

    const now = Date.now();
    const name = actorName(actor);
    const reason = args.reason?.trim();
    await ctx.db.patch(args.incidentId, {
      deletedAt: now,
      deletedBy: name,
      ...(reason ? { deletedReason: reason } : {}),
      // El plazo vigente se cuenta ahora, no al recuperarla: lo retirado cumple
      // el plazo con el que entró, igual que en la papelera del almacén.
      purgeAt: trashPurgeAt(now, await trashRetentionDays(ctx)),
      updatedAt: now,
      history: [
        ...incident.history,
        historyEntry(incident.status, now, name, "Retirada a la papelera"),
      ],
    });

    // Y se le cuenta a quien notificó: su referencia deja de seguir el caso, y
    // eso no puede descubrirlo mirando. Sale con la fecha de la retirada, que es
    // lo que distingue este aviso del de un cambio de estado.
    await scheduleReporterEmail(
      ctx,
      incident,
      INCIDENT_WITHDRAWN_NOTICE,
      now,
    );
  },
});

/**
 * Recupera una incidencia de la papelera: vuelve a la cola —o al archivo, si de
 * ahí salió— tal y como estaba, con su expediente y sus notas, y su referencia
 * vuelve a seguir el caso.
 */
export const restore = mutation({
  args: { incidentId: v.id("incidents") },
  handler: async (ctx, args) => {
    const actor = await requireWithdrawCapability(ctx);
    const incident = await getIncident(ctx, args.incidentId);
    if (incident.deletedAt === undefined) return;

    const now = Date.now();
    const name = actorName(actor);
    await ctx.db.patch(args.incidentId, {
      deletedAt: undefined,
      deletedBy: undefined,
      deletedReason: undefined,
      purgeAt: undefined,
      updatedAt: now,
      history: [
        ...incident.history,
        historyEntry(incident.status, now, name, "Recuperada de la papelera"),
      ],
    });
  },
});

/**
 * Borra ya una incidencia retirada, sin esperar el plazo: lo que alguien retiró
 * y ahora confirma que no quiere. Es la única forma de borrar de verdad, así que
 * pide que la incidencia esté retirada: lo que no ha pasado por la papelera no
 * se borra de un tirón.
 */
export const deleteNow = mutation({
  args: { incidentId: v.id("incidents") },
  handler: async (ctx, args) => {
    await requireWithdrawCapability(ctx);
    const incident = await getIncident(ctx, args.incidentId);
    if (incident.deletedAt === undefined) {
      throw new ConvexError(
        "Retira la incidencia antes de borrarla: lo que no pasa por la papelera no se puede recuperar.",
      );
    }
    await purgeIncident(ctx, incident);
  },
});

/**
 * La pasada de la papelera de incidencias: borra de verdad lo que cumplió su
 * plazo sin que nadie lo recuperara. Va por tandas, como la del almacén, y no
 * toca nada más: lo que está dentro de plazo espera a su noche.
 */
export const purgeExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("incidents")
      .withIndex("by_purgeAt", (q) => q.lt("purgeAt", Date.now()))
      .take(PURGE_LIMIT);

    let purged = 0;
    for (const incident of rows) {
      // El índice solo guarda lo retirado; aun así, un `purgeAt` suelto —un dato
      // viejo— no borra una incidencia que está en la cola.
      if (incident.deletedAt === undefined) continue;
      await purgeIncident(ctx, incident);
      purged += 1;
    }
    return purged;
  },
});

/** Una incidencia en la papelera, tal y como la enseña el módulo Archivo. */
export interface WithdrawnIncidentItem {
  id: Id<"incidents">;
  reference: string;
  status: Doc<"incidents">["status"];
  equipmentKind: string | null;
  model: string | null;
  location: string | null;
  /** Lo notificado, en texto plano: en la lista se lee de una línea. */
  description: string;
  deletedAt: number;
  deletedBy: string | null;
  deletedReason: string | null;
  purgeAt: number;
  /** Salió del archivo: recuperarla la devuelve allí, no a la cola. */
  archived: boolean;
  /**
   * Cómo fue el aviso a quien notificó —su correo, cuándo salió y, si no salió,
   * por qué—: es lo que la papelera enseña para saber si se le explicó que su
   * referencia dejaba de funcionar (`reporterNoticeText`).
   */
  reporterEmail: string | null;
  emailedAt: number | null;
  emailError: string | null;
}

/**
 * La papelera de incidencias, para el módulo Archivo: lo retirado —lo que antes
 * se borra, delante— y el plazo vigente. La ve quien coordina: es la pantalla
 * desde la que se deshace, y lo retirado no es del día a día de nadie.
 */
export const trash = query({
  args: {},
  handler: async (ctx) => {
    const actor = await requireActor(ctx);
    if (!(await hasCapability(ctx, actor, "manageIncidents"))) {
      throw new ConvexError(
        "No tienes permisos para ver la papelera de incidencias.",
      );
    }

    const rows = await ctx.db
      .query("incidents")
      .withIndex("by_deletedAt")
      .collect();
    const items: WithdrawnIncidentItem[] = rows
      .filter((row) => row.deletedAt !== undefined)
      .map((row) => ({
        id: row._id,
        reference: row.reference,
        status: row.status,
        equipmentKind: row.equipmentKind ?? null,
        model: row.model ?? null,
        location: row.location ?? null,
        description: richDocToPlainText(row.description),
        deletedAt: row.deletedAt!,
        deletedBy: row.deletedBy ?? null,
        deletedReason: row.deletedReason ?? null,
        // Sin fecha de borrado —dato viejo— se cuenta desde que se retiró.
        purgeAt: row.purgeAt ?? row.deletedAt!,
        archived: row.archivedAt !== undefined,
        reporterEmail: row.reporterEmail ?? null,
        emailedAt: row.emailedAt ?? null,
        emailError: row.emailError ?? null,
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

/* ------------------------------------------------------------------ */
/* Documentos y notas a lo largo del ciclo de vida                     */
/* ------------------------------------------------------------------ */

/**
 * Anota un cambio en el rastro de auditoría de los documentos. Se escribe desde
 * las tres mutaciones que tocan el expediente y con la misma marca de tiempo que
 * el cambio, para que el rastro no cuente la historia con otro reloj.
 */
async function logDocumentChange(
  ctx: MutationCtx,
  args: {
    incidentId: Id<"incidents">;
    documentId: Id<"incidentDocuments">;
    action: DocumentAction;
    name: string;
    previousName?: string;
    actor: Actor;
    at: number;
  },
): Promise<void> {
  await ctx.db.insert("incidentDocumentLog", {
    incidentId: args.incidentId,
    documentId: args.documentId,
    action: args.action,
    name: args.name,
    ...(args.previousName ? { previousName: args.previousName } : {}),
    by: actorName(args.actor),
    byId: args.actor._id,
    at: args.at,
  });
}

/**
 * Avisa a la audiencia del expediente de un movimiento que no debe pasar
 * desapercibido: un documento retirado —su movimiento es la única constancia
 * que queda de él— o cualquier movimiento del expediente de una incidencia ya
 * cerrada. Un alta o una edición al día no avisan a nadie. La decisión y el
 * texto viven en `lib/audit`, con sus pruebas; a quién le llega se decide en
 * «Ajustes del taller» (por defecto, quien audita).
 *
 * A diferencia del resto de avisos de la aplicación, aquí no se excluye a quien
 * provoca el movimiento: el aviso no cuenta una novedad a quien la conoce, es
 * la constancia de un cambio sensible en el expediente. Un taller con un solo
 * administrador no tendría de otra forma ninguna señal de que su expediente se
 * ha movido.
 */
async function notifyDocumentMove(
  ctx: MutationCtx,
  args: {
    incident: Doc<"incidents">;
    action: DocumentAction;
    name: string;
    previousName?: string;
  },
): Promise<void> {
  const text = documentMoveAlert({
    action: args.action,
    reference: args.incident.reference,
    name: args.name,
    ...(args.previousName ? { previousName: args.previousName } : {}),
    closed: isClosedIncident(args.incident.status),
  });
  if (text === null) return;
  await notifyUsers(
    ctx,
    await auditAlertRecipientIds(ctx),
    text,
    args.incident._id,
  );
}

/**
 * URL de subida para el archivo de un documento del expediente. Sube quien
 * puede mover el expediente: el archivo es parte de él, así que no lo deja
 * cualquiera. La URL caduca sola en unas horas; el archivo se enlaza con
 * `attachDocument` en cuanto llega su `storageId`.
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireDocumentEditor(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Adjunta un documento a la incidencia: el archivo de verdad (`storageId`), su
 * nombre visible, la nota opcional y el autor, que es quien lo adjunta —queda
 * firmado en el expediente—.
 *
 * El archivo es opcional para poder seguir llamando a esto con documentos de
 * solo nombre (la muestra y las pruebas del expediente): los que adjunta la
 * aplicación siempre suben uno antes.
 */
export const attachDocument = mutation({
  args: {
    incidentId: v.id("incidents"),
    name: v.string(),
    storageId: v.optional(v.id("_storage")),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireDocumentEditor(ctx);
    const incident = await getIncident(ctx, args.incidentId);
    const author = actorName(actor);
    // Una sola marca de tiempo para la fila y para la copia de la ficha: si no,
    // pueden quedar separadas por un milisegundo y no cuadrar entre sí.
    const now = Date.now();
    const id = await ctx.db.insert("incidentDocuments", {
      incidentId: args.incidentId,
      name: args.name.trim(),
      ...(args.storageId ? { storageId: args.storageId } : {}),
      note: richDocToStore(args.note),
      author,
      createdAt: now,
    });
    await ctx.db.patch(args.incidentId, {
      updatedAt: now,
      documents: [
        ...(incident.documents ?? []),
        {
          _id: id,
          name: args.name.trim(),
          ...(args.storageId ? { storageId: args.storageId } : {}),
          note: richDocToStore(args.note),
          author,
          createdAt: now,
        },
      ],
    });
    await logDocumentChange(ctx, {
      incidentId: args.incidentId,
      documentId: id,
      action: DOCUMENT_ACTIONS.ATTACHED,
      name: args.name.trim(),
      actor,
      at: now,
    });
    await notifyDocumentMove(ctx, {
      incident,
      action: DOCUMENT_ACTIONS.ATTACHED,
      name: args.name.trim(),
    });
    return id;
  },
});

/** Añade una nota fechada a la incidencia (autor y momento). */
export const addNote = mutation({
  args: {
    incidentId: v.id("incidents"),
    note: v.string(),
    at: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Quien firma la nota es el mismo actor al que se le comprueba el permiso.
    const actor = await requireActor(ctx);
    const incident = await getIncident(ctx, args.incidentId);
    await requireNoteAuthor(ctx, actor, incident);
    // El cuaderno admite formato (negritas, listas, imágenes), así que lo que
    // se guarda es el documento del editor, ya recortado de párrafos vacíos: si
    // al final no dice nada, no hay nota.
    const noteText = richDocToStore(args.note);
    if (noteText === undefined) {
      throw new ConvexError("Escribe una nota válida.");
    }
    const now = Date.now();
    const when = args.at ?? now;
    // `at` es la fecha que se ve en el hilo (puede ser retroactiva) y
    // `createdAt` es cuándo se escribió de verdad: desde ahí se cuenta el plazo
    // para poder corregirla.
    const entry: LifecycleNote = {
      note: noteText,
      author: actorName(actor),
      authorId: actor._id,
      id: crypto.randomUUID(),
      at: when,
      createdAt: now,
    };
    await ctx.db.patch(args.incidentId, {
      updatedAt: now,
      // El ciclo de vida se lee siempre en orden cronológico, aunque una nota
      // llegue con una fecha anterior (p. ej. al reconstruir el historial).
      lifecycleNotes: [...(incident.lifecycleNotes ?? []), entry].sort(
        (a, b) => a.at - b.at,
      ),
    });
    return entry.id;
  },
});

/**
 * Corrige el texto de una nota propia. La fecha del hilo no se toca, así que la
 * nota no cambia de sitio en el cuaderno aunque se escribiera retroactiva: solo
 * queda anotado cuándo se corrigió. Tampoco se pierde lo que decía antes: cada
 * corrección archiva el texto anterior con su momento, y el historial viaja con
 * la nota (también si se retira y se recupera).
 */
export const updateNote = mutation({
  args: {
    incidentId: v.id("incidents"),
    noteId: v.string(),
    note: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    const incident = await getIncident(ctx, args.incidentId);
    const notes = incident.lifecycleNotes ?? [];
    const index = noteIndex(notes, args.noteId);
    const now = Date.now();
    requireNoteOwnership(actor, notes[index], now);
    requireLiveNote(notes[index]);

    // El cuaderno admite formato (negritas, listas, imágenes), así que lo que
    // se guarda es el documento del editor, ya recortado de párrafos vacíos: si
    // al final no dice nada, no hay corrección que hacer.
    const noteText = richDocToStore(args.note);
    if (noteText === undefined) {
      throw new ConvexError("Escribe una nota válida.");
    }
    // Guardar sin cambiar nada no corrige ni fecha nada: el historial solo
    // recoge correcciones de verdad.
    if (noteText === notes[index].note) return;

    const updated = [...notes];
    updated[index] = {
      ...notes[index],
      note: noteText,
      editedAt: now,
      versions: [
        ...(notes[index].versions ?? []),
        { note: notes[index].note, at: now },
      ],
    };
    await ctx.db.patch(args.incidentId, {
      updatedAt: now,
      lifecycleNotes: updated,
    });
  },
});

/**
 * Devuelve la nota a una versión anterior de su propio historial: vuelve a
 * decir lo que decía antes sin borrar nada de lo que pasó. Es una corrección al
 * revés, así que la firma el mismo autor y dentro del mismo plazo que cualquier
 * otra, y el texto que había antes se archiva igual; pero queda anotado que fue
 * una restauración, quién la hizo y a qué versión se volvió. Quien lee el
 * cuaderno —o el informe— ve que la nota se devolvió a lo que decía tal día, no
 * que su autor la reescribiera a mano.
 *
 * Restaurar no alarga el plazo: se cuenta desde que la nota se escribió, así
 * que devolver una versión no reabre una nota que ya era histórico.
 */
export const restoreNoteVersion = mutation({
  args: {
    incidentId: v.id("incidents"),
    noteId: v.string(),
    /**
     * Posición de la versión en el historial guardado. Se identifica por su
     * sitio y no por su fecha porque dos correcciones seguidas pueden caer en
     * el mismo instante (mismo milisegundo) y la fecha no distinguiría una de
     * otra; el historial solo crece por el final, así que la posición no se
     * mueve.
     */
    versionIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    const incident = await getIncident(ctx, args.incidentId);
    const notes = incident.lifecycleNotes ?? [];
    const index = noteIndex(notes, args.noteId);
    const now = Date.now();
    requireNoteOwnership(actor, notes[index], now);
    requireLiveNote(notes[index]);

    const versions = notes[index].versions ?? [];
    const version = Number.isInteger(args.versionIndex)
      ? versions[args.versionIndex]
      : undefined;
    if (!version) {
      throw new ConvexError(
        "Esa versión ya no está en el historial de la nota.",
      );
    }
    // La nota ya dice eso: volver a restaurarla no inventa una corrección.
    if (version.note === notes[index].note) return;

    const updated = [...notes];
    updated[index] = {
      ...notes[index],
      note: version.note,
      editedAt: now,
      versions: [...versions, { note: notes[index].note, at: now }],
      restoredAt: now,
      restoredBy: actorName(actor),
      restoredVersion: args.versionIndex,
    };
    await ctx.db.patch(args.incidentId, {
      updatedAt: now,
      lifecycleNotes: updated,
    });
  },
});

/**
 * Retira una nota propia del cuaderno: deja de verse, pero no se pierde. Una
 * nota se borra por error con más facilidad de la que se escribe, así que
 * retirarla es reversible —queda anotado quién la retiró y cuándo, y se puede
 * recuperar desde la propia ficha— en vez de hacerla desaparecer sin remedio.
 */
export const removeNote = mutation({
  args: {
    incidentId: v.id("incidents"),
    noteId: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    const incident = await getIncident(ctx, args.incidentId);
    const notes = incident.lifecycleNotes ?? [];
    const index = noteIndex(notes, args.noteId);
    const now = Date.now();
    requireNoteOwnership(actor, notes[index], now);
    requireLiveNote(notes[index]);

    const updated = [...notes];
    updated[index] = {
      ...notes[index],
      deletedAt: now,
      deletedBy: actorName(actor),
    };
    await ctx.db.patch(args.incidentId, {
      updatedAt: now,
      lifecycleNotes: updated,
    });
  },
});

/**
 * Devuelve al cuaderno una nota retirada: vuelve tal y como estaba y en su
 * sitio (no se reordena, porque nunca salió del hilo). La recupera quien la
 * escribió —que es quien puede borrarla— o quien coordina la incidencia, que es
 * el caso de un taller donde el autor ya no está para arreglar su propio
 * descuido. No hay plazo: recuperar algo perdido no reescribe nada.
 */
export const restoreNote = mutation({
  args: {
    incidentId: v.id("incidents"),
    noteId: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    const incident = await getIncident(ctx, args.incidentId);
    const notes = incident.lifecycleNotes ?? [];
    const index = noteIndex(notes, args.noteId);
    const note = notes[index];
    if (note.deletedAt === undefined) {
      throw new ConvexError("Esa nota ya está en el cuaderno.");
    }
    const isAuthor = note.authorId !== undefined && note.authorId === actor._id;
    const canCoordinate = await hasCapability(ctx, actor, "manageIncidents");
    if (!isAuthor && !canCoordinate) {
      throw new ConvexError(
        "Solo quien escribió la nota o quien coordina la incidencia pueden recuperarla.",
      );
    }

    // Vuelve tal y como estaba: se van solo las marcas de la retirada.
    const restored: LifecycleNote = { ...note };
    delete restored.deletedAt;
    delete restored.deletedBy;
    const updated = [...notes];
    updated[index] = restored;
    await ctx.db.patch(args.incidentId, {
      updatedAt: Date.now(),
      lifecycleNotes: updated,
    });
  },
});

/**
 * Edita el nombre, la nota o el archivo de un documento adjunto. Si llega un
 * `storageId` nuevo, sustituye al que tuviera y el anterior se borra del
 * almacén: reemplazar un archivo es dejarlo fuera, no guardarlo dos veces. El
 * reemplazo queda firmado en el rastro con su propio movimiento, porque no es
 * ni un renombrado ni una corrección de la nota.
 */
export const updateDocument = mutation({
  args: {
    incidentId: v.id("incidents"),
    documentId: v.id("incidentDocuments"),
    name: v.optional(v.string()),
    note: v.optional(v.string()),
    /** Archivo nuevo que sustituye al del documento. */
    storageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const actor = await requireDocumentEditor(ctx);
    const incident = await getIncident(ctx, args.incidentId);
    const doc = (incident.documents ?? []).find(
      (item) => item._id === args.documentId,
    );
    if (!doc) {
      throw new ConvexError("Ese documento no pertenece a esta incidencia.");
    }
    const newName = args.name?.trim() || doc.name;
    const newNote = richDocToStore(args.note);
    if (!newName) {
      throw new ConvexError("El nombre del documento es obligatorio.");
    }
    // Volver a mandar el mismo archivo no es reemplazarlo: el cambio real es
    // que el documento pase a apuntar a otro.
    const replacedFile =
      args.storageId !== undefined && args.storageId !== doc.storageId;
    const newStorageId = args.storageId ?? doc.storageId;
    const now = Date.now();
    await ctx.db.patch(args.documentId, {
      name: newName,
      note: newNote,
      ...(newStorageId ? { storageId: newStorageId } : {}),
    });
    await ctx.db.patch(args.incidentId, {
      updatedAt: now,
      documents: (incident.documents ?? []).map((item) =>
        item._id === args.documentId
          ? {
              ...item,
              name: newName,
              note: newNote,
              ...(newStorageId ? { storageId: newStorageId } : {}),
            }
          : item,
      ),
    });
    // Con el archivo nuevo ya enlazado, el sustituido se va del almacén. Del
    // que estuvo queda su movimiento en el rastro y, si el reemplazo vino con
    // un renombrado, el nombre con el que se adjuntó.
    if (replacedFile && doc.storageId) {
      await ctx.storage.delete(doc.storageId);
    }
    // Guardar sin cambiar nada no deja rastro: el registro es de cambios
    // reales, no de pulsaciones del botón.
    if (replacedFile || newName !== doc.name || newNote !== doc.note) {
      const action = replacedFile
        ? DOCUMENT_ACTIONS.REPLACED
        : DOCUMENT_ACTIONS.EDITED;
      await logDocumentChange(ctx, {
        incidentId: args.incidentId,
        documentId: args.documentId,
        action,
        name: newName,
        // Solo cuando cambió el nombre visible: así el rastro distingue un
        // renombrado de una corrección de la nota del adjunto.
        ...(newName !== doc.name ? { previousName: doc.name } : {}),
        actor,
        at: now,
      });
      await notifyDocumentMove(ctx, {
        incident,
        action,
        name: newName,
        ...(newName !== doc.name ? { previousName: doc.name } : {}),
      });
    }
  },
});

/** Quita un documento adjunto sin borrar notas ni el resto de la incidencia. */
export const removeDocument = mutation({
  args: {
    incidentId: v.id("incidents"),
    documentId: v.id("incidentDocuments"),
  },
  handler: async (ctx, args) => {
    const actor = await requireDocumentEditor(ctx);
    const incident = await getIncident(ctx, args.incidentId);
    const doc = (incident.documents ?? []).find(
      (item) => item._id === args.documentId,
    );
    if (!doc) {
      throw new ConvexError("Ese documento ya no está en esta incidencia.");
    }
    const now = Date.now();
    await ctx.db.delete(args.documentId);
    await ctx.db.patch(args.incidentId, {
      updatedAt: now,
      documents: (incident.documents ?? []).filter(
        (item) => item._id !== args.documentId,
      ),
    });
    // El archivo se va con la ficha: retirar un documento del expediente es
    // dejarlo fuera, no esconderlo. Lo que queda es su movimiento en el rastro,
    // que es la constancia de quién lo quitó y con qué nombre estuvo.
    if (doc.storageId) await ctx.storage.delete(doc.storageId);
    // Al rastro se le da el nombre que tenía: es lo único que quedará de él.
    await logDocumentChange(ctx, {
      incidentId: args.incidentId,
      documentId: args.documentId,
      action: DOCUMENT_ACTIONS.REMOVED,
      name: doc.name,
      actor,
      at: now,
    });
    await notifyDocumentMove(ctx, {
      incident,
      action: DOCUMENT_ACTIONS.REMOVED,
      name: doc.name,
    });
  },
});

/**
 * Rastro de auditoría de los documentos de una incidencia, del más reciente al
 * más antiguo: quién adjuntó, editó o quitó cada uno y cuándo. Es información
 * de coordinación —y la única constancia de un adjunto retirado—, así que la
 * lee quien puede gestionar el expediente, no cualquiera que vea la cola.
 */
export const documentTrail = query({
  args: { incidentId: v.id("incidents") },
  handler: async (ctx, args) => {
    await requireDocumentEditor(ctx);
    const entries = await ctx.db
      .query("incidentDocumentLog")
      .withIndex("by_incident", (q) => q.eq("incidentId", args.incidentId))
      .collect();
    // Del más reciente al más antiguo, con la fecha del cambio como
    // referencia y el orden de escritura como desempate: dos cambios del mismo
    // milisegundo (adjuntar y renombrar del tirón) se leen siempre igual. El
    // rastro de una incidencia es corto y se lee entero.
    return entries.sort(
      (a, b) => b.at - a.at || b._creationTime - a._creationTime,
    );
  },
});

/**
 * El rastro de varias incidencias de una vez, para el lote de informes de un
 * periodo: una sola lectura del rastro, recortada a las incidencias pedidas, en
 * vez de una consulta por incidencia. Mismo permiso que `documentTrail` —el
 * expediente lo lee quien coordina—, y se ordena igual: del movimiento más
 * reciente al más antiguo, con el orden de escritura como desempate.
 */
export const documentTrails = query({
  args: { incidentIds: v.array(v.id("incidents")) },
  handler: async (ctx, args) => {
    await requireDocumentEditor(ctx);
    if (args.incidentIds.length === 0) return [];
    const wanted = new Set(args.incidentIds);
    // El rastro de documentos del taller es corto y se lee entero: recortarlo
    // por la lista de incidencias es más barato que una consulta por cada una.
    const entries = await ctx.db
      .query("incidentDocumentLog")
      .withIndex("by_at")
      .order("desc")
      .collect();
    return entries
      .filter((entry) => wanted.has(entry.incidentId))
      .sort((a, b) => b.at - a.at || b._creationTime - a._creationTime);
  },
});

/**
 * Auditoría de documentos de todo el taller: cada alta, edición y retirada que
 * ha quedado anotada en el rastro, con filtros por persona, por fechas y por
 * tipo de movimiento. A diferencia de `documentTrail`, que cuenta la historia
 * de una incidencia, esto recorre el expediente de todas: es una lectura de
 * administración, así que la pide quien tiene la capacidad bloqueada
 * `viewAudit` (solo el administrador).
 *
 * Se devuelve del movimiento más reciente al más antiguo, la lista de personas
 * que firman movimientos —siempre completa, del histórico entero, para que
 * elegir una no vacíe el desplegable desde el que se elige— y el resumen de lo
 * que pasa el filtro.
 */
export const documentAudit = query({
  args: {
    /** Persona que hizo el movimiento. */
    userId: v.optional(v.id("users")),
    /** Primer instante incluido. */
    from: v.optional(v.number()),
    /** Último instante incluido (el día final se manda hasta su último ms). */
    to: v.optional(v.number()),
    /** Tipo de movimiento. */
    action: v.optional(documentActionValidator),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    if (!(await hasCapability(ctx, actor, "viewAudit"))) {
      throw new ConvexError(
        "Solo el administrador puede consultar la auditoría de documentos.",
      );
    }

    const { userId, from, to, action } = args;

    // El histórico entero, del más reciente al más antiguo, por la fecha del
    // movimiento. Se lee completo a propósito: los filtros no pueden recortar
    // la lectura, porque de ella salen también el total sin filtrar y la lista
    // de firmantes —elegir a una persona no debe vaciar el desplegable desde el
    // que se la elige—. El rastro de documentos del taller es corto.
    const all = await ctx.db
      .query("incidentDocumentLog")
      .withIndex("by_at")
      .order("desc")
      .collect();

    const matches = all.filter(
      (entry) =>
        (userId === undefined || entry.byId === userId) &&
        (from === undefined || entry.at >= from) &&
        (to === undefined || entry.at <= to) &&
        (action === undefined || entry.action === action),
    );

    const people = new Map<
      Id<"users">,
      { id: Id<"users">; name: string; movements: number }
    >();
    for (const entry of all) {
      const found = people.get(entry.byId);
      if (found) {
        found.movements += 1;
        continue;
      }
      people.set(entry.byId, {
        id: entry.byId,
        name: entry.by,
        movements: 1,
      });
    }
    const authors = [...people.values()].sort(
      (a, b) => b.movements - a.movements || a.name.localeCompare(b.name, "es"),
    );

    // La ficha de cada incidencia afectada, para nombrarla y poder abrirla.
    const incidents = new Map<Id<"incidents">, Doc<"incidents">>();
    for (const entry of matches) {
      if (incidents.has(entry.incidentId)) continue;
      const incident = await ctx.db.get(entry.incidentId);
      if (incident) incidents.set(entry.incidentId, incident);
    }

    return {
      entries: matches.map((entry) => {
        const incident = incidents.get(entry.incidentId);
        return {
          _id: entry._id,
          incidentId: entry.incidentId,
          reference: incident?.reference ?? "—",
          title: incident
            ? `${incident.equipmentKind} ${incident.model}`.trim()
            : "",
          status: incident?.status,
          archived: incident?.archivedAt !== undefined,
          documentId: entry.documentId,
          action: entry.action,
          name: entry.name,
          previousName: entry.previousName,
          by: entry.by,
          byId: entry.byId,
          at: entry.at,
        };
      }),
      authors,
      summary: summarizeAudit(
        matches.map((entry) => ({
          action: entry.action,
          byId: entry.byId,
          incidentId: entry.incidentId,
        })),
      ),
      /** Movimientos en el histórico completo, para decir cuánto se está filtrando. */
      unfilteredTotal: all.length,
    };
  },
});

/**
 * Ficha de historial: con todos los datos de la incidencia y del técnico se
 * registra una intervención en el equipo relacionado.
 */
async function createHistorySheet(
  ctx: MutationCtx,
  args: {
    incident: Doc<"incidents">;
    equipmentId: Id<"equipment">;
    status: "resolved" | "unresolved";
    notes?: string;
    technician: string;
    closedAt: number;
  },
): Promise<Id<"maintenanceRecords">> {
  const { incident } = args;
  // Lo retirado no se cita: una petición que está en la papelera es la que se
  // pidió por error o se duplicó, así que el historial del equipo no la cuenta
  // como el material que se puso.
  const linkedRequest = (await ctx.db.query("partRequests").collect()).find(
    (request) =>
      request.incidentId === incident._id && request.deletedAt === undefined,
  );

  const reported = new Date(incident.reportedAt).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const closed = new Date(args.closedAt).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const lines = [
    `Incidencia ${incident.reference}: notificada por ${incident.reporterName}${
      incident.reporterRole ? ` (${incident.reporterRole})` : ""
    } el ${reported}${incident.location ? ` en ${incident.location}` : ""}.`,
    `Equipo: ${incident.equipmentKind} ${incident.model}${
      incident.serialNumber ? ` · S/N ${incident.serialNumber}` : ""
    }.`,
    `Avería descrita: ${richDocToPlainText(incident.description)}`,
    args.notes ? `Notas del técnico: ${args.notes}` : "",
    `Cierre: ${
      args.status === "resolved" ? "resuelta" : "sin resolución"
    } por ${args.technician} el ${closed}.`,
    linkedRequest ? `Material: petición ${linkedRequest.reference}.` : "",
  ].filter(Boolean);

  return await ctx.db.insert("maintenanceRecords", {
    equipmentId: args.equipmentId,
    kind: "repair",
    title: `Incidencia ${incident.reference}`,
    description: lines.join("\n"),
    performedAt: args.closedAt,
    technician: args.technician,
    ...(linkedRequest ? { requestId: linkedRequest._id } : {}),
    createdAt: args.closedAt,
    updatedAt: args.closedAt,
  });
}

/** Estados disponibles para los filtros de la cola (documentación de UI). */
export const statusValidator = incidentStatusValidator;
