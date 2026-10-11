import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { MutationCtx, QueryCtx, mutation, query } from "./_generated/server";
import { archiveClosedIncidentsBefore } from "./archive";
import { readAuditAlertRoles } from "./auditAlerts";
import { notifyUsers } from "./notify";
import { grantsForRole, hasAnyCapability, hasCapability } from "./permissions";
import { assertReportImages } from "./reportUploads";
import { documentMoveAlert, summarizeAudit } from "../lib/audit";
import type { Capability } from "../lib/permissions";
import { DEFAULT_ROLE } from "../lib/roles";
import { richDocToPlainText, richDocToStore } from "../lib/richDoc";
import { NOTE_EDIT_WINDOW_MS, isNoteWithinEditWindow } from "../lib/workshop";
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
  if (!user) {
    throw new ConvexError("Debes iniciar sesión para gestionar incidencias.");
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
 * Reporta una incidencia. Es la única función pública del módulo: el
 * notificador no tiene por qué estar registrado en la aplicación.
 */
export const report = mutation({
  args: {
    reporterName: v.string(),
    reporterRole: v.optional(v.string()),
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

    // Referencia autoincremental INC-0001, sin duplicar si hay borrados
    const existing = await ctx.db.query("incidents").collect();
    const taken = new Set(existing.map((item) => item.reference));
    let sequence = existing.length + 1;
    while (taken.has(`INC-${String(sequence).padStart(4, "0")}`)) sequence += 1;
    const reference = `INC-${String(sequence).padStart(4, "0")}`;

    const now = Date.now();
    const incidentId = await ctx.db.insert("incidents", {
      reference,
      reporterName,
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
    await requireActor(ctx);
    const items = await ctx.db
      .query("incidents")
      .withIndex("by_createdAt")
      .order("desc")
      .collect();
    const visible = args.includeArchived
      ? items
      : items.filter((item) => item.archivedAt === undefined);
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
  const linkedRequest = (await ctx.db.query("partRequests").collect()).find(
    (request) => request.incidentId === incident._id,
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
