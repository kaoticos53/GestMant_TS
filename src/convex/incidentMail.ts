import { v } from "convex/values";
import {
  INCIDENT_WITHDRAWN_NOTICE,
  isWithdrawnNotice,
  mailNotice,
  mailableStatus,
  renderIncidentMail,
  renderIncidentStaffMail,
  staffMailNotice,
  type IncidentMailNotice,
  type IncidentStaffNotice,
} from "../lib/incidentMail";
import type { Doc } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { deliverMailLogged } from "./_mail/deliver";
import { ensurePublicCode } from "./publicCodes";
import { INCIDENT_STATUSES } from "./schema";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "./_generated/server";

/**
 * Avisos por correo a quien notificó una incidencia.
 *
 * Sale por la pasarela de la plataforma —la misma que los códigos de acceso y el
 * resumen semanal—, que es cosa de una acción: una mutación no puede salir a la
 * red. Por eso los cambios de estado no esperan al correo: programan esta
 * función (`internal.incidentMail.notifyReporter`) y siguen con lo suyo, de modo
 * que la ficha responde aunque la pasarela esté de mal humor.
 *
 * Quien avisó no tiene cuenta: de él solo se sabe el nombre y, si lo dejó, su
 * correo. Lo que se manda es el recorte de seguimiento (`lib/incidentMail`), con
 * su código, no el expediente del taller.
 *
 * Se cuentan dos cosas: los cambios de estado que le importan y la retirada a la
 * papelera. La retirada no es un estado, pero es lo que deja su código sin
 * funcionar: avisarla es lo que evita que el código que se le dio deje de
 * contestar sin explicación.
 *
 * Cada envío queda apuntado en la ficha: el último aviso contado —para no
 * repetir el mismo correo cada vez que se toca la incidencia—, cuándo salió y,
 * si no salió, por qué. Sin clave de integraciones no se intenta nada: se anota
 * el motivo, como en el resumen semanal.
 */

/** Lo que hace falta de la incidencia para escribir el correo. */
export const context = internalQuery({
  args: { incidentId: v.id("incidents") },
  handler: async (ctx, args) => {
    const incident = await ctx.db.get(args.incidentId);
    if (!incident) return null;
    return {
      // El código es lo que se le enseña: la referencia interna no sale en el
      // correo. Una incidencia anterior a esta columna no tiene ninguno y se le
      // reparte al avisar (`ensureCode`).
      code: incident.publicCode ?? null,
      reporterName: incident.reporterName,
      reporterEmail: incident.reporterEmail ?? null,
      status: incident.status,
      equipmentKind: incident.equipmentKind ?? null,
      model: incident.model ?? null,
      location: incident.location ?? null,
      reportedAt: incident.reportedAt,
      assigneeName: incident.assigneeName ?? null,
      workshopAssigneeName: incident.workshopAssigneeName ?? null,
      // Cuándo se retiró, si está en la papelera: es lo que se le cuenta a quien
      // notificó —y lo que fecha ese aviso, para no repetirlo.
      deletedAt: incident.deletedAt ?? null,
      emailedStatus: incident.emailedStatus ?? null,
      emailedAt: incident.emailedAt ?? null,
    };
  },
});

/**
 * Reparte un código a una incidencia que no lo tenga y lo devuelve.
 *
 * Es para las incidencias que se notificaron antes de que existiera el código: sin
 * esto, al avisar a quien las notificó habría que hablarle de una referencia
 * interna que ya no sirve para consultar nada. Se le da uno y el correo sale con
 * lo mismo que el de cualquier otra: su código. Va aquí y no en una migración
 * porque el momento en que de verdad hace falta es este.
 */
export const ensureCode = internalMutation({
  args: { incidentId: v.id("incidents") },
  handler: async (ctx, args) => {
    const incident = await ctx.db.get(args.incidentId);
    if (!incident) return null;
    return await ensurePublicCode(ctx, incident);
  },
});

/**
 * Programa el aviso por correo a quien notificó. Se programa en vez de esperar:
 * el correo sale por la pasarela de la plataforma, y eso es cosa de una acción
 * —una mutación no puede salir a la red—, así que la ficha cierra su cambio de
 * estado sin quedarse mirando al cartero.
 *
 * Vive aquí, con el resto del correo, y no en el módulo que la llama: decidir si
 * hay algo que contar es cosa de `lib/incidentMail` —qué estados se cuentan y
 * cuál es el último avisado— y repartirlo es cosa de este módulo. Antes era una
 * función privada de las incidencias, y por eso el alta de una incidencia tenía
 * que llevar su propio camino para no escribir a nadie.
 *
 * No se programa nada si quien notificó no dejó correo, si lo que hay que contarle
 * no se cuenta por correo o si ya se le contó lo mismo.
 */
export async function scheduleReporterEmail(
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
 * Apunta cómo fue el aviso. Se guarda el estado avisado aunque el envío falle:
 * reintentarlo en cada cambio de la ficha no arregla una pasarela caída, y el
 * motivo queda escrito para que se vea qué pasó.
 */
export const record = internalMutation({
  args: {
    incidentId: v.id("incidents"),
    status: v.string(),
    sentAt: v.optional(v.number()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const incident = await ctx.db.get(args.incidentId);
    if (!incident) return;
    await ctx.db.patch(args.incidentId, {
      emailedStatus: args.status,
      ...(args.sentAt !== undefined ? { emailedAt: args.sentAt } : {}),
      emailError: args.error,
    });
  },
});

/** Lo que devuelve el aviso, para las pruebas y para el registro. */
export interface NotifyResult {
  status: "sent" | "failed" | "skipped";
  error?: string;
}

/**
 * Lo que hace falta de una incidencia para el aviso interno: la referencia, el
 * equipo, quién la lleva y lo que se contó, sin el correo de nadie ni el código
 * de seguimiento. Un aviso ya retirado no se reparte: el taller la saca de su
 * lista a la vez que se manda esto, y llegar tarde con «hay una incidencia nueva»
 * sería mentir.
 */
export const staffContext = internalQuery({
  args: { incidentId: v.id("incidents") },
  handler: async (ctx, args) => {
    const incident = await ctx.db.get(args.incidentId);
    if (!incident || incident.deletedAt !== undefined) return null;
    return {
      reference: incident.reference,
      reporterName: incident.reporterName,
      equipmentKind: incident.equipmentKind ?? null,
      model: incident.model ?? null,
      location: incident.location ?? null,
      description: incident.description,
      reportedAt: incident.reportedAt,
      assigneeName: incident.assigneeName ?? null,
      workshopAssigneeName: incident.workshopAssigneeName ?? null,
      // Lo último que se repartió, para no repetirlo si dos toques de la ficha
      // programaron el mismo aviso antes de que el primero se apuntara.
      staffNotifiedStatus: incident.staffNotifiedStatus ?? null,
    };
  },
});

/** Lo que se está contando, para el motivo de un fallo y para el histórico. */
function staffNoticeWhat(notice: IncidentStaffNotice): string {
  if (notice === INCIDENT_STATUSES.ASSIGNED)
    return "el aviso interno de la asignación";
  if (notice === INCIDENT_STATUSES.REPORTED)
    return "el aviso interno de la incidencia";
  return "el aviso interno del cierre";
}

/**
 * El aviso interno de una incidencia, a los roles que lo tengan marcado en los
 * ajustes del correo: cuando entra, cuando se asigna y cuando se cierra.
 *
 * Es otro correo que el de quien notificó, y no una copia: aquel habla de «tu
 * incidencia» y lleva el código de seguimiento, que es del invitado. Este lleva la
 * referencia interna, quién la lleva y el enlace al panel, que es lo que el taller
 * necesita para trabajar.
 *
 * Sin roles marcados no se compone nada. Si el correo sale mal, el motivo queda en
 * el histórico de envíos y no se apunta en la ficha: la incidencia no tiene la
 * culpa de que el servicio de correo esté de mal humor. Lo que sí se apunta es el
 * aviso dado, para no repetirlo con el siguiente toque de la ficha.
 */
export const notifyStaff = internalAction({
  args: {
    incidentId: v.id("incidents"),
    notice: v.union(
      v.literal(INCIDENT_STATUSES.REPORTED),
      v.literal(INCIDENT_STATUSES.ASSIGNED),
      v.literal(INCIDENT_STATUSES.RESOLVED),
      v.literal(INCIDENT_STATUSES.UNRESOLVED),
    ),
  },
  handler: async (ctx, args): Promise<NotifyResult> => {
    const recipients = await ctx.runQuery(
      internal.mailSettings.incidentRecipients,
      {},
    );
    if (recipients.length === 0) return { status: "skipped" };
    const incident = await ctx.runQuery(internal.incidentMail.staffContext, {
      incidentId: args.incidentId,
    });
    if (incident === null) return { status: "skipped" };
    if (incident.staffNotifiedStatus === args.notice)
      return { status: "skipped" };

    const email = renderIncidentStaffMail({
      ...incident,
      notice: args.notice,
      appUrl: process.env.SITE_URL,
    });
    const config = await ctx.runQuery(internal.mailSettings.delivery, {});
    const delivery = await deliverMailLogged(
      ctx,
      config,
      {
        to: recipients,
        subject: email.subject,
        text: email.text,
        html: email.html,
      },
      staffNoticeWhat(args.notice),
      "equipo",
      args.incidentId,
    );
    await ctx.runMutation(internal.incidentMail.recordStaffNotice, {
      incidentId: args.incidentId,
      notice: args.notice,
    });
    return delivery.ok
      ? { status: "sent" }
      : { status: "failed", error: delivery.error };
  },
});

/**
 * Apunta el aviso interno dado. Se guarda aunque el envío falle —como el de quien
 * notificó—: reintentarlo en cada cambio de la ficha no arregla un correo caído, y
 * el motivo ya está en el histórico.
 */
export const recordStaffNotice = internalMutation({
  args: { incidentId: v.id("incidents"), notice: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.incidentId, {
      staffNotifiedStatus: args.notice,
    });
  },
});

/**
 * Programa el aviso interno de lo que acaba de pasarle a la incidencia. Se
 * programa por lo mismo que el de quien notificó —mandar correo es cosa de una
 * acción— y no se repite el mismo aviso dos veces: reasignar a otra persona no
 * vuelve a mandar «asignada» a todo el taller.
 *
 * La decisión de qué estados se reparten vive en `lib/incidentMail`
 * (`staffMailNotice`), no aquí.
 */
export async function scheduleStaffEmail(
  ctx: MutationCtx,
  incident: Doc<"incidents">,
  notice: IncidentMailNotice,
): Promise<void> {
  const staffNotice = staffMailNotice(notice);
  if (staffNotice === null) return;
  if (incident.staffNotifiedStatus === staffNotice) return;
  await ctx.scheduler.runAfter(0, internal.incidentMail.notifyStaff, {
    incidentId: incident._id,
    notice: staffNotice,
  });
}

/**
 * Avisa a quien notificó de que su caso ha cambiado de estado. Programada desde
 * las mutaciones que cambian el estado, corre una vez por cambio y no repite el
 * mismo estado dos veces.
 */
export const notifyReporter = internalAction({
  args: { incidentId: v.id("incidents") },
  handler: async (ctx, args): Promise<NotifyResult> => {
    const incident = await ctx.runQuery(internal.incidentMail.context, {
      incidentId: args.incidentId,
    });
    // Nada que avisar: sin incidencia o sin correo al que escribir.
    if (incident === null || incident.reporterEmail === null) {
      return { status: "skipped" };
    }

    // Lo que se cuenta: la retirada manda sobre el estado —es lo último que le
    // ha pasado al caso y lo que deja la referencia sin funcionar—, y un paso
    // intermedio no se cuenta a quien notificó.
    const withdrawn = incident.deletedAt !== null;
    const notice = withdrawn ? INCIDENT_WITHDRAWN_NOTICE : incident.status;
    if (mailNotice(notice) === null) {
      return { status: "skipped" };
    }
    // Ya se le contó esto mismo: el estado, porque es el que tiene por último
    // avisado; la retirada, porque el aviso salió después de retirarla.
    const alreadyTold = withdrawn
      ? incident.emailedAt !== null && incident.emailedAt >= incident.deletedAt!
      : incident.emailedStatus === notice;
    if (alreadyTold) {
      return { status: "skipped" };
    }

    // El código con el que se firma el correo: el que tenga la ficha o, si es de
    // las que se notificaron antes de que hubiera códigos, uno repartido ahora.
    const code =
      incident.code ??
      (await ctx.runMutation(internal.incidentMail.ensureCode, {
        incidentId: args.incidentId,
      }));
    if (code === null) return { status: "skipped" };

    const email = renderIncidentMail({
      ...incident,
      code,
      notice,
      appUrl: process.env.SITE_URL,
    });

    // Por dónde sale lo decide el taller en sus ajustes: la pasarela de la
    // plataforma o el servicio que haya configurado. Aquí no se sabe cuál es, y
    // no hace falta: la entrega lo resuelve y devuelve el motivo si no pudo.
    const config = await ctx.runQuery(internal.mailSettings.delivery, {});
    const delivery = await deliverMailLogged(
      ctx,
      config,
      {
        to: [incident.reporterEmail],
        subject: email.subject,
        text: email.text,
        html: email.html,
      },
      "el aviso a quien notificó",
      "incidencia",
      args.incidentId,
    );

    await ctx.runMutation(internal.incidentMail.record, {
      incidentId: args.incidentId,
      status: notice,
      ...(delivery.ok ? { sentAt: Date.now() } : { error: delivery.error }),
    });
    return delivery.ok
      ? { status: "sent" }
      : { status: "failed", error: delivery.error };
  },
});
