import { ConvexError, v } from "convex/values";
import {
  DEFAULT_WEEKLY_REPORT_ROLES,
  DEFAULT_WEEKLY_REPORT_WEEKDAY,
  MAX_WEEKDAY,
  MIN_WEEKDAY,
  WEEKLY_REPORT_HISTORY_LIMIT,
  composeWeeklyReport,
  countsInWeeklyReport,
  weeklyDeliveryBlocker,
  weeklyRecipients,
  weeklyReportWeekday,
  weeklyScheduleDecision,
  type WeeklyReport,
  type WeeklyReportSource,
} from "../lib/weeklyReport";
import { DEFAULT_WORK_WITHOUT_TRACE_DAYS } from "../lib/workshop";
import { internal } from "./_generated/api";
import { deliverMailLogged } from "./_mail/deliver";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type ActionCtx,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import {
  canCoordinate,
  coordinatorOnlyMessage,
  normalizeSettingsRoleKeys,
  requireCoordinator,
  settingsRoleOptions,
} from "./permissions";

/**
 * Resumen semanal del taller por correo: lo que se trabajó, lo que quedó sin
 * constancia y lo que se archivó.
 *
 * Este módulo es el **adaptador**: carga los documentos, se los pasa a
 * `../lib/weeklyReport` —donde está la composición, probada sin servidor— y
 * entrega el sobre, que aquí significa guardarlo y mandarlo por la pasarela de
 * integraciones de la plataforma. Qué entra en la semana, quién lo recibe, qué
 * dice el correo y si la pasada del cron toca hoy no se decide aquí: eso vive en
 * el módulo puro, y aquí solo se pregunta.
 *
 * El correo se guarda siempre en `weeklyReports`, se haya entregado o no: así el
 * panel puede enseñar qué salió cada semana y, cuando la pasarela falla (o el
 * deployment no tiene clave de integraciones), el motivo queda escrito en vez de
 * perderse en un log.
 */

/** Una sola fila de ajustes: se lee y se escribe siempre en el mismo sitio. */
const SETTINGS_KEY = "default";

/** Quién decide (y firma) los ajustes del resumen. */
async function requireReportManager(ctx: QueryCtx | MutationCtx) {
  return await requireCoordinator(ctx, "configurar el resumen semanal");
}

function actorName(user: { name?: string; email?: string }): string {
  return user.name?.trim() || user.email?.trim() || "Coordinación del taller";
}

async function readSettings(ctx: QueryCtx | MutationCtx) {
  return await ctx.db
    .query("reportSettings")
    .withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY))
    .unique();
}

/** Margen del aviso de trabajo sin constancia, para que el resumen use el mismo. */
async function currentMarginDays(ctx: QueryCtx | MutationCtx): Promise<number> {
  const row = await ctx.db
    .query("alertSettings")
    .withIndex("by_key", (q) => q.eq("key", "default"))
    .unique();
  return row?.days ?? DEFAULT_WORK_WITHOUT_TRACE_DAYS;
}

/**
 * Todo lo que el resumen necesita, cargado de la base: las colas completas (las
 * archivadas incluidas, que son justo la tercera sección), quién lo recibe y el
 * margen vigente. Los destinatarios se resuelven en el servidor: el navegador
 * nunca ve la lista completa de correos del taller. Lo retirado se queda fuera
 * —es lo que dice el módulo puro—, y aquí solo se le aplica.
 */
async function loadReportSource(
  ctx: QueryCtx | MutationCtx,
): Promise<WeeklyReportSource> {
  const incidents = await ctx.db.query("incidents").collect();
  const requests = await ctx.db.query("partRequests").collect();
  const users = await ctx.db.query("users").collect();
  const settings = await readSettings(ctx);
  const roleKeys = settings?.roleKeys ?? [...DEFAULT_WEEKLY_REPORT_ROLES];
  return {
    incidents: incidents.filter(countsInWeeklyReport),
    requests: requests.filter(countsInWeeklyReport),
    recipients: weeklyRecipients(users, roleKeys),
    marginDays: await currentMarginDays(ctx),
  };
}

/** El resumen compuesto a partir de la base de datos (lo comparten vista y envío). */
async function composeReport(
  ctx: QueryCtx | MutationCtx,
  now: number,
): Promise<WeeklyReport> {
  return composeWeeklyReport(await loadReportSource(ctx), {
    now,
    appUrl: process.env.SITE_URL,
  });
}

/** Ajustes vigentes; sin fila guardada se devuelven los de partida. */
export const settings = query({
  args: {},
  handler: async (ctx) => {
    await requireReportManager(ctx);
    const row = await readSettings(ctx);
    return {
      enabled: row?.enabled ?? true,
      weekday: row?.weekday ?? DEFAULT_WEEKLY_REPORT_WEEKDAY,
      roleKeys: row?.roleKeys ?? [...DEFAULT_WEEKLY_REPORT_ROLES],
      lastSentAt: row?.lastSentAt ?? null,
      lastSentTo: row?.lastSentTo ?? [],
      updatedAt: row?.updatedAt ?? null,
      updatedBy: row?.updatedBy ?? null,
    };
  },
});

/** Roles a los que se puede apuntar el resumen: los del sistema y los propios. */
export const roleOptions = query({
  args: {},
  handler: async (ctx) => {
    await requireReportManager(ctx);
    return await settingsRoleOptions(ctx);
  },
});

/** Enciende o apaga el resumen y fija su día y sus destinatarios. */
export const setSettings = mutation({
  args: {
    enabled: v.boolean(),
    weekday: v.number(),
    roleKeys: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireReportManager(ctx);
    // Qué días valen lo dice la composición; el aviso, quien lo pide.
    const weekday = weeklyReportWeekday(args.weekday);
    if (weekday === null) {
      throw new ConvexError(
        `El día del resumen debe estar entre el lunes (${MIN_WEEKDAY}) y el domingo (${MAX_WEEKDAY}).`,
      );
    }

    const roleKeys = await normalizeSettingsRoleKeys(ctx, args.roleKeys);

    const now = Date.now();
    const by = actorName(user);
    const row = await readSettings(ctx);
    if (row) {
      await ctx.db.patch(row._id, {
        enabled: args.enabled,
        weekday,
        roleKeys,
        updatedAt: now,
        updatedBy: by,
      });
      return;
    }
    await ctx.db.insert("reportSettings", {
      key: SETTINGS_KEY,
      enabled: args.enabled,
      weekday,
      roleKeys,
      updatedAt: now,
      updatedBy: by,
    });
  },
});

/** Últimas semanas compuestas, para el histórico del panel (la más nueva primero). */
export const history = query({
  args: {},
  handler: async (ctx) => {
    await requireReportManager(ctx);
    const rows = await ctx.db.query("weeklyReports").collect();
    return rows
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, WEEKLY_REPORT_HISTORY_LIMIT)
      .map((row) => ({
        key: row.key,
        from: row.from,
        to: row.to,
        subject: row.subject,
        status: row.status,
        recipients: row.recipients,
        summary: row.summary,
        error: row.error ?? null,
        sentAt: row.sentAt ?? null,
        createdAt: row.createdAt,
      }));
  },
});

/**
 * El correo que saldría ahora mismo, con los datos de la semana en curso. Es lo
 * que enseña el panel antes de enviar y exactamente lo que se manda de verdad.
 */
export const preview = query({
  args: {},
  handler: async (ctx) => {
    await requireReportManager(ctx);
    const report = await composeReport(ctx, Date.now());
    return {
      key: report.key,
      from: report.from,
      to: report.to,
      windowLabel: report.windowLabel,
      marginDays: report.marginDays,
      recipients: report.recipients,
      subject: report.subject,
      text: report.text,
      counts: report.summary,
    };
  },
});

/**
 * Contexto interno para el envío: el correo ya compuesto y sus destinatarios.
 * Las acciones no ven la base de datos, así que el trabajo fino se queda aquí.
 */
export const sendContext = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await composeReport(ctx, Date.now());
  },
});

/**
 * ¿Puede esta persona mandar el resumen a mano? Lo pregunta la acción con el
 * usuario de su propia sesión: dentro de una acción no se puede consultar la
 * configuración de roles sin pasar por una consulta, y la identidad del que
 * llama no viaja sola hasta aquí.
 */
export const canConfigure = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return false;
    return await canCoordinate(ctx, user);
  },
});

/** Ajustes vistos por el cron: sin pedir sesión (no hay nadie detrás). */
export const schedule = internalQuery({
  args: {},
  handler: async (ctx) => {
    const row = await readSettings(ctx);
    return {
      enabled: row?.enabled ?? true,
      weekday: row?.weekday ?? DEFAULT_WEEKLY_REPORT_WEEKDAY,
    };
  },
});

/** Guarda el resumen compuesto: una fila por semana (reenviarla la actualiza). */
export const record = internalMutation({
  args: {
    key: v.string(),
    from: v.number(),
    to: v.number(),
    subject: v.string(),
    text: v.string(),
    status: v.union(v.literal("sent"), v.literal("failed")),
    recipients: v.array(v.string()),
    summary: v.object({
      touched: v.number(),
      withoutTrace: v.number(),
      archived: v.number(),
    }),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const fields = {
      key: args.key,
      from: args.from,
      to: args.to,
      subject: args.subject,
      text: args.text,
      status: args.status,
      recipients: args.recipients,
      summary: args.summary,
      error: args.error,
      sentAt: args.status === "sent" ? now : undefined,
      createdAt: now,
    };
    const existing = await ctx.db
      .query("weeklyReports")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    if (existing) await ctx.db.patch(existing._id, fields);
    else await ctx.db.insert("weeklyReports", fields);

    // Los ajustes solo se tocan cuando el envío salió bien: así «último envío»
    // nunca miente sobre un correo que no se entregó. Sin fila guardada se crea
    // con los valores de partida, porque el envío del cron existe aunque nadie
    // haya abierto nunca la configuración.
    if (args.status === "sent") {
      const settingsRow = await readSettings(ctx);
      if (settingsRow) {
        await ctx.db.patch(settingsRow._id, {
          lastSentAt: now,
          lastSentTo: args.recipients,
        });
      } else {
        await ctx.db.insert("reportSettings", {
          key: SETTINGS_KEY,
          enabled: true,
          weekday: DEFAULT_WEEKLY_REPORT_WEEKDAY,
          roleKeys: [...DEFAULT_WEEKLY_REPORT_ROLES],
          lastSentAt: now,
          lastSentTo: args.recipients,
          updatedAt: now,
        });
      }
    }
    return args.key;
  },
});

/* ------------------------------------------------------------------ */
/* Envío por la pasarela de integraciones                              */
/* ------------------------------------------------------------------ */

interface DeliveryResult {
  ok: boolean;
  error?: string;
}

/**
 * Manda el correo por el servicio que el taller tenga configurado en sus ajustes
 * —la pasarela de la plataforma si no ha cambiado nada—. Sin clave no se intenta
 * nada: se devuelve el motivo para que quede escrito en el histórico, que es
 * donde se lee por qué una semana no salió.
 */
async function deliver(
  ctx: ActionCtx,
  email: {
    to: string[];
    subject: string;
    text: string;
    html: string;
  },
): Promise<DeliveryResult> {
  const config = await ctx.runQuery(internal.mailSettings.delivery, {});
  return await deliverMailLogged(
    ctx,
    config,
    email,
    "el correo del resumen",
    "resumen",
  );
}

/** Compone, envía y anota. Es el camino que comparten el cron y «enviar ahora». */
async function sendReport(ctx: ActionCtx): Promise<{
  status: "sent" | "failed";
  recipients: string[];
  subject: string;
  error?: string;
}> {
  const report = await ctx.runQuery(internal.weeklyReport.sendContext, {});
  // Sin destinatarios no hay a quién: la composición dice el motivo, y la
  // pasarela ni se llama.
  const blocker = weeklyDeliveryBlocker(report.recipients);
  const delivery =
    blocker === null
      ? await deliver(ctx, {
          to: report.recipients,
          subject: report.subject,
          text: report.text,
          html: report.html,
        })
      : { ok: false, error: blocker };

  await ctx.runMutation(internal.weeklyReport.record, {
    key: report.key,
    from: report.from,
    to: report.to,
    subject: report.subject,
    text: report.text,
    status: delivery.ok ? "sent" : "failed",
    recipients: report.recipients,
    summary: report.summary,
    error: delivery.ok ? undefined : delivery.error,
  });

  return {
    status: delivery.ok ? "sent" : "failed",
    recipients: report.recipients,
    subject: report.subject,
    error: delivery.ok ? undefined : delivery.error,
  };
}

/** Enviar ahora: a mano, desde el panel, con la semana en curso. */
export const sendNow = action({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError(
        "Debes iniciar sesión para enviar el resumen semanal.",
      );
    }
    const allowed = await ctx.runQuery(internal.weeklyReport.canConfigure, {
      userId,
    });
    if (!allowed) {
      throw new ConvexError(
        coordinatorOnlyMessage("configurar el resumen semanal"),
      );
    }
    return await sendReport(ctx);
  },
});

/**
 * Pasada del cron (cada mañana, desde `crons.ts`): solo envía si el resumen está
 * encendido y hoy es el día elegido (en UTC, como el propio cron). Así el día se
 * configura desde la app sin tocar el horario del cron.
 */
export const runScheduled = internalAction({
  args: {},
  handler: async (ctx) => {
    const schedule = await ctx.runQuery(internal.weeklyReport.schedule, {});
    // ¿Toca hoy? Lo decide la composición; aquí solo se obedece.
    const decision = weeklyScheduleDecision(schedule, Date.now());
    if (!decision.send) return { sent: false, reason: decision.reason };
    const result = await sendReport(ctx);
    return {
      sent: result.status === "sent",
      reason: result.error ?? decision.reason,
    };
  },
});
