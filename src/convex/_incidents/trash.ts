import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import {
  type MutationCtx,
  internalMutation,
  mutation,
  query,
} from "../_generated/server";
import { archiveClosedIncidentsBefore } from "../archive";
import { scheduleReporterEmail } from "../incidentMail";
import { trashRetentionDays } from "../trash";
import { INCIDENT_WITHDRAWN_NOTICE } from "../../lib/incidentMail";
import { isClosedIncident } from "../../lib/incidentFlow";
import { richDocToPlainText } from "../../lib/richDoc";
import { trashPurgeAt } from "../../lib/trash";
import { hasCapability } from "../permissions";
import { identityNotice, secureMutation } from "../_auth/secureMutation";
import {
  actorName,
  getIncident,
  historyEntry,
  isModerator,
  requireActor,
} from "./helpers";

const archiveArgs = { incidentId: v.id("incidents") };

export const archive = mutation({
  args: archiveArgs,
  handler: secureMutation(
    {
      capability: "manageIncidents",
      identityMessage: identityNotice(
        "Debes iniciar sesión con una cuenta registrada para gestionar incidencias.",
      ),
      denyMessage: (actor) =>
        isModerator(actor)
          ? "No tienes permisos para archivar incidencias. Revisa la configuración de tu rol con el administrador."
          : "Solo el coordinador puede archivar incidencias. Pídeselo al responsable del taller..",
    },
    archiveArgs,
    async (ctx, args, actor) => {
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
  ),
});

/** Devuelve una incidencia del archivo a la cola, con su traza. */
const unarchiveArgs = { incidentId: v.id("incidents") };

export const unarchive = mutation({
  args: unarchiveArgs,
  handler: secureMutation(
    {
      capability: "manageIncidents",
      identityMessage: identityNotice(
        "Debes iniciar sesión con una cuenta registrada para gestionar incidencias.",
      ),
      denyMessage: (actor) =>
        isModerator(actor)
          ? "No tienes permisos para archivar incidencias. Revisa la configuración de tu rol con el administrador."
          : "Solo el coordinador puede archivar incidencias. Pídeselo al responsable del taller..",
    },
    unarchiveArgs,
    async (ctx, args, actor) => {
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
  ),
});

const archiveClosedBeforeArgs = { before: v.number() };

export const archiveClosedBefore = mutation({
  args: archiveClosedBeforeArgs,
  handler: secureMutation(
    {
      capability: "manageIncidents",
      identityMessage: identityNotice(
        "Debes iniciar sesión con una cuenta registrada para gestionar incidencias.",
      ),
      denyMessage: (actor) =>
        isModerator(actor)
          ? "No tienes permisos para archivar incidencias. Revisa la configuración de tu rol con el administrador."
          : "Solo el coordinador puede archivar incidencias. Pídeselo al responsable del taller..",
    },
    archiveClosedBeforeArgs,
    async (ctx, args, actor) => {
      if (!Number.isFinite(args.before)) {
        throw new ConvexError("Indica una fecha de corte válida.");
      }
      return await archiveClosedIncidentsBefore(ctx, {
        before: args.before,
        by: actorName(actor),
      });
    },
  ),
});

/* ------------------------------------------------------------------ */
/* Papelera: retirar lo equivocado o duplicado, con plazo para volver   */
/* ------------------------------------------------------------------ */

/** Retirar una incidencia es tarea de coordinación, como archivarla. */
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

const withdrawArgs = {
  incidentId: v.id("incidents"),
  reason: v.optional(v.string()),
};

export const withdraw = mutation({
  args: withdrawArgs,
  handler: secureMutation(
    {
      capability: "manageIncidents",
      identityMessage: identityNotice(
        "Debes iniciar sesión con una cuenta registrada para gestionar incidencias.",
      ),
      denyMessage: (actor) =>
        isModerator(actor)
          ? "No tienes permisos para retirar incidencias. Revisa la configuración de tu rol con el administrador."
          : "Solo el coordinador puede retirar una incidencia. Pídeselo al responsable del taller..",
    },
    withdrawArgs,
    async (ctx, args, actor) => {
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
  ),
});

/**
 * Recupera una incidencia de la papelera: vuelve a la cola —o al archivo, si de
 * ahí salió— tal y como estaba, con su expediente y sus notas, y su referencia
 * vuelve a seguir el caso.
 */
const restoreArgs = { incidentId: v.id("incidents") };

export const restore = mutation({
  args: restoreArgs,
  handler: secureMutation(
    {
      capability: "manageIncidents",
      identityMessage: identityNotice(
        "Debes iniciar sesión con una cuenta registrada para gestionar incidencias.",
      ),
      denyMessage: (actor) =>
        isModerator(actor)
          ? "No tienes permisos para retirar incidencias. Revisa la configuración de tu rol con el administrador."
          : "Solo el coordinador puede retirar una incidencia. Pídeselo al responsable del taller..",
    },
    restoreArgs,
    async (ctx, args, actor) => {
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
  ),
});

/**
 * Borra ya una incidencia retirada, sin esperar el plazo: lo que alguien retiró
 * y ahora confirma que no quiere. Es la única forma de borrar de verdad, así que
 * pide que la incidencia esté retirada: lo que no ha pasado por la papelera no
 * se borra de un tirón.
 */
const deleteNowArgs = { incidentId: v.id("incidents") };

export const deleteNow = mutation({
  args: deleteNowArgs,
  handler: secureMutation(
    {
      capability: "manageIncidents",
      identityMessage: identityNotice(
        "Debes iniciar sesión con una cuenta registrada para gestionar incidencias.",
      ),
      denyMessage: (actor) =>
        isModerator(actor)
          ? "No tienes permisos para retirar incidencias. Revisa la configuración de tu rol con el administrador."
          : "Solo el coordinador puede retirar una incidencia. Pídeselo al responsable del taller..",
    },
    deleteNowArgs,
    async (ctx, args) => {
      const incident = await getIncident(ctx, args.incidentId);
      if (incident.deletedAt === undefined) {
        throw new ConvexError(
          "Retira la incidencia antes de borrarla: lo que no pasa por la papelera no se puede recuperar.",
        );
      }
      await purgeIncident(ctx, incident);
    },
  ),
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

/**
 * Una incidencia retirada, entera, para leerla antes de decidir: la papelera
 * enseña un resumen y desde aquí se abre su ficha —en solo lectura— antes de
 * recuperarla o borrarla. Devuelve `null` si lo que se pide ya no está en la
 * papelera: lo vivo se lee por su módulo, no por aquí.
 */
export const withdrawn = query({
  args: { incidentId: v.id("incidents") },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    if (!(await hasCapability(ctx, actor, "manageIncidents"))) {
      throw new ConvexError(
        "No tienes permisos para ver la papelera de incidencias.",
      );
    }

    const row = await ctx.db.get(args.incidentId);
    if (!row || row.deletedAt === undefined) return null;
    return row;
  },
});
