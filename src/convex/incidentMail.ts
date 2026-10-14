import { createVlyIntegrations } from "@vly-ai/integrations";
import { v } from "convex/values";
import {
  INCIDENT_WITHDRAWN_NOTICE,
  isWithdrawnNotice,
  mailNotice,
  mailableStatus,
  renderIncidentMail,
  type IncidentMailNotice,
} from "../lib/incidentMail";
import type { Doc } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { ensurePublicCode } from "./publicCodes";
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

    const key = process.env.VLY_INTEGRATION_KEY;
    if (!key) {
      const error =
        "El deployment no tiene VLY_INTEGRATION_KEY: el aviso a quien notificó no se puede enviar todavía.";
      await ctx.runMutation(internal.incidentMail.record, {
        incidentId: args.incidentId,
        status: notice,
        error,
      });
      return { status: "failed", error };
    }

    let failure: string | null = null;
    try {
      const vly = createVlyIntegrations({ deploymentToken: key });
      const result = await vly.email.send({
        to: [incident.reporterEmail],
        subject: email.subject,
        text: email.text,
        html: email.html,
      });
      if (!result.success) {
        failure = result.error ?? "La pasarela rechazó el envío.";
      }
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
    }

    await ctx.runMutation(internal.incidentMail.record, {
      incidentId: args.incidentId,
      status: notice,
      ...(failure === null ? { sentAt: Date.now() } : { error: failure }),
    });
    return failure === null
      ? { status: "sent" }
      : { status: "failed", error: failure };
  },
});
