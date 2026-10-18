import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import {
  DEFAULT_MAIL_SETTINGS,
  MAIL_PROVIDER_META,
  MAX_MAIL_SECRET,
  buildMailCheckRequest,
  formatSender,
  isMailProvider,
  looksLikeEmail,
  mailCheckSummary,
  mailProviderLabel,
  validateMailSettings,
  type MailCheckResult,
  type MailProvider,
} from "../lib/mail";
import type { Doc } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type QueryCtx,
} from "./_generated/server";
import { weeklyRecipients } from "../lib/weeklyReport";
import { deliverMailLogged } from "./_mail/deliver";
import {
  normalizeSettingsRoleKeys,
  requireAdmin,
  settingsRoleOptions,
} from "./permissions";

/**
 * El correo saliente del taller, configurable desde Ajustes.
 *
 * Hasta ahora salía por la pasarela de la plataforma y no había nada que
 * decidir: la clave iba en el deployment y el remitente lo ponía otro. Un taller
 * que ya tiene su propio correo —o que contrata Resend, SendGrid, Mailgun o
 * Brevo— necesita decir por dónde sale sin recompilar y sin entrar al servidor,
 * y eso es esta pantalla: el servicio, el remitente, la clave y una prueba.
 *
 * Tres reglas que no son de estilo:
 *
 * - **La clave no vuelve al navegador.** Se guarda en la fila, y la consulta de
 *   los ajustes devuelve solo si hay, de dónde sale y sus últimos cuatro
 *   caracteres. Quien la necesita es la entrega, que es interna.
 * - **Cambiar de servicio no arrastra la clave del anterior.** Una clave de
 *   Resend no le dice nada a SendGrid: si se queda dentro, el primer envío
 *   devuelve un 401 que no explica nada. Al cambiar de servicio, la clave se
 *   aparta y la pantalla pide la del nuevo.
 * - **Un ajuste a medias no se guarda.** La validación es la misma que usa la
 *   pantalla (`lib/mail`), así que lo que rechaza el servidor es exactamente lo
 *   que la pantalla ya marca.
 *
 * Las claves se leen de la fila o, si no hay, de la variable del servidor
 * (`RESEND_API_KEY`, `SENDGRID_API_KEY`, `MAILGUN_API_KEY`, `BREVO_API_KEY`,
 * `VLY_INTEGRATION_KEY`). Así un taller puede configurarlo desde el panel y otro
 * dejarlo en el entorno del deployment, sin guardar secretos en la base.
 */

/** Una sola fila de ajustes: se lee y se escribe siempre en el mismo sitio. */
const SETTINGS_KEY = "default";

const NO_ADMIN_MESSAGE =
  "Solo el administrador puede configurar o probar el correo del taller.";

/** La fila guardada, o nada si el taller nunca ha tocado el correo. */
async function readRow(ctx: QueryCtx): Promise<Doc<"mailSettings"> | null> {
  return await ctx.db
    .query("mailSettings")
    .withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY))
    .unique();
}

/** El valor de la variable del servidor del servicio indicado (o vacío). */
function envKey(provider: MailProvider): string {
  const name = MAIL_PROVIDER_META[provider].apiKeyEnv;
  if (name === null) return "";
  return (process.env[name] ?? "").trim();
}

/** Los ajustes vigentes: los guardados o, sin fila, los de partida del código. */
function effectiveSettings(row: Doc<"mailSettings"> | null) {
  const provider =
    row !== null && isMailProvider(row.provider)
      ? row.provider
      : DEFAULT_MAIL_SETTINGS.provider;
  return {
    provider,
    enabled: row?.enabled ?? DEFAULT_MAIL_SETTINGS.enabled,
    fromName: row?.fromName ?? DEFAULT_MAIL_SETTINGS.fromName,
    fromEmail: row?.fromEmail ?? DEFAULT_MAIL_SETTINGS.fromEmail,
    replyTo: row?.replyTo ?? DEFAULT_MAIL_SETTINGS.replyTo,
    bcc: row?.bcc ?? DEFAULT_MAIL_SETTINGS.bcc,
    incidentRoles: row?.incidentRoles ?? [],
    domain: row?.domain ?? DEFAULT_MAIL_SETTINGS.domain,
    relayUrl: row?.relayUrl ?? DEFAULT_MAIL_SETTINGS.relayUrl,
    smtpUser: row?.smtpUser ?? DEFAULT_MAIL_SETTINGS.smtpUser,
  };
}

/**
 * De dónde sale la clave: de la fila, del entorno o de ningún sitio. Solo se
 * dice cuál de las tres y los últimos cuatro caracteres; lo demás no sale.
 */
function keyState(
  row: Doc<"mailSettings"> | null,
  provider: MailProvider,
): {
  hasKey: boolean;
  keyHint: string;
  keySource: "guardada" | "entorno" | "ninguna";
  envVar: string | null;
  envConfigured: boolean;
} {
  const envVar = MAIL_PROVIDER_META[provider].apiKeyEnv;
  const fromEnv = envKey(provider);
  const stored =
    provider === "vly" || row?.provider !== provider ? "" : (row?.apiKey ?? "");
  const hasKey = stored.trim() !== "" || fromEnv !== "";
  return {
    hasKey,
    keyHint: stored.trim() === "" ? "" : `…${stored.slice(-4)}`,
    keySource:
      stored.trim() !== ""
        ? "guardada"
        : fromEnv !== ""
          ? "entorno"
          : "ninguna",
    envVar,
    envConfigured: envVar !== null && fromEnv !== "",
  };
}

/** Lo que ve la pantalla: los ajustes sin ningún secreto dentro. */
function publicView(row: Doc<"mailSettings"> | null) {
  const settings = effectiveSettings(row);
  const key = keyState(row, settings.provider);
  const relayTokenStored =
    settings.provider === "relay" && row?.provider === "relay"
      ? (row?.relayToken ?? "")
      : "";
  return {
    ...settings,
    hasKey: key.hasKey,
    keyHint: key.keyHint,
    keySource: key.keySource,
    envVar: key.envVar,
    envConfigured: key.envConfigured,
    hasRelayToken: relayTokenStored.trim() !== "",
    relayTokenHint:
      relayTokenStored.trim() === "" ? "" : `…${relayTokenStored.slice(-4)}`,
    updatedAt: row?.updatedAt ?? null,
    updatedBy: row?.updatedBy ?? null,
    lastTestAt: row?.lastTestAt ?? null,
    lastTestTo: row?.lastTestTo ?? null,
    lastTestOk: row?.lastTestOk ?? null,
    lastTestError: row?.lastTestError ?? null,
  };
}

/**
 * Los roles a los que se puede apuntar el aviso interno, con su etiqueta de hoy.
 * Es la misma lista que usan los demás ajustes por rol: sistema primero y los
 * propios por nombre. Solo el administrador configura el correo.
 */
export const roleOptions = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx, "configurar el correo del taller");
    return await settingsRoleOptions(ctx);
  },
});

/**
 * Los ajustes vigentes, con lo que la pantalla puede saber de la clave. Solo el
 * administrador: el correo del taller no es cosa de cada rol.
 */
export const settings = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx, "configurar el correo del taller");
    return publicView(await readRow(ctx));
  },
});

/** Sirve para leer los ajustes en la prueba, sin pasar por la pantalla. */
export const delivery = internalQuery({
  args: {},
  handler: async (ctx) => {
    const row = await readRow(ctx);
    const settings = effectiveSettings(row);
    const provider = settings.provider;
    // La clave guardada solo cuenta si es del servicio elegido: la de otro
    // servicio es basura que produciría un 401 sin explicación.
    const stored =
      provider === "vly" || row?.provider !== provider
        ? ""
        : (row?.apiKey ?? "");
    const storedToken =
      provider === "relay" && row?.provider === "relay"
        ? (row?.relayToken ?? "")
        : "";
    return {
      enabled: settings.enabled,
      provider,
      fromName: settings.fromName,
      fromEmail: settings.fromEmail,
      replyTo: settings.replyTo,
      bcc: settings.bcc,
      domain: settings.domain,
      relayUrl: settings.relayUrl,
      smtpUser: settings.smtpUser,
      apiKey: stored.trim() !== "" ? stored.trim() : envKey(provider),
      relayToken:
        storedToken.trim() !== "" ? storedToken.trim() : envKey("relay"),
    };
  },
});

/**
 * Elige qué roles reciben el aviso interno de una incidencia nueva.
 *
 * Se guarda en la misma fila que el resto del correo y se toca aparte: el
 * formulario del servidor guarda su remitente y su clave sin pasar por aquí, y
 * así guardar el remitente no borra a quién se avisa. Un rol que ya no existe se
 * rechaza en vez de quedarse en la lista apuntando a nadie.
 */
export const setIncidentRoles = mutation({
  args: { roleKeys: v.array(v.string()) },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(
      ctx,
      "elegir qué roles reciben los avisos de incidencia",
    );
    const roleKeys = await normalizeSettingsRoleKeys(ctx, args.roleKeys);
    const now = Date.now();
    const by = admin.name?.trim() || admin.email?.trim() || "Administración";
    const row = await readRow(ctx);
    if (row === null) {
      await ctx.db.insert("mailSettings", {
        key: SETTINGS_KEY,
        ...DEFAULT_MAIL_SETTINGS,
        incidentRoles: roleKeys,
        updatedAt: now,
        updatedBy: by,
      });
    } else {
      await ctx.db.patch(row._id, {
        incidentRoles: roleKeys,
        updatedAt: now,
        updatedBy: by,
      });
    }
    return publicView(await readRow(ctx));
  },
});

/**
 * Los correos del taller a los que les toca el aviso interno de una incidencia:
 * los de las personas en activo con cuenta cuyo rol está marcado. La regla es la
 * misma que reparte el resumen semanal (`weeklyRecipients`): ni invitados, ni
 * cuentas dadas de baja, ni direcciones repetidas.
 *
 * Sin roles marcados no hay a quién escribir, y la acción ni se molesta en
 * componer el correo.
 */
export const incidentRecipients = internalQuery({
  args: {},
  handler: async (ctx) => {
    const row = await readRow(ctx);
    const roleKeys = row?.incidentRoles ?? [];
    if (roleKeys.length === 0) return [];
    const users = await ctx.db.query("users").collect();
    return weeklyRecipients(users, roleKeys);
  },
});

/** ¿Este usuario puede tocar el correo? Lo preguntan las acciones. */
export const canConfigure = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<boolean> => {
    const user = await ctx.db.get(args.userId);
    return (
      user !== null &&
      user.active !== false &&
      user.isAnonymous !== true &&
      user.role === "admin"
    );
  },
});

/** El secreto que queda: el nuevo si lo hay, el anterior si no, o ninguno. */
function nextSecret(
  value: string | undefined,
  clear: boolean | undefined,
  previous: string | undefined,
  what: string,
): string | undefined {
  if (clear === true) return undefined;
  const trimmed = (value ?? "").trim();
  if (trimmed === "") return previous;
  if (trimmed.length > MAX_MAIL_SECRET) {
    throw new ConvexError(`${what} es demasiado larga.`);
  }
  if (/[\r\n]/.test(trimmed)) {
    throw new ConvexError(`${what} no puede llevar saltos de línea.`);
  }
  return trimmed;
}

/**
 * Guarda los ajustes del correo. Los secretos viajan aparte del resto: la
 * pantalla manda uno nuevo solo cuando se escribe, y el resto del tiempo dice
 * «conserva el que hay». Sin esa separación, guardar el remitente borraría la
 * clave sin querer.
 */
export const save = mutation({
  args: {
    provider: v.string(),
    enabled: v.boolean(),
    fromName: v.string(),
    fromEmail: v.string(),
    replyTo: v.string(),
    bcc: v.string(),
    domain: v.string(),
    relayUrl: v.string(),
    smtpUser: v.optional(v.string()),
    apiKey: v.optional(v.string()),
    clearApiKey: v.optional(v.boolean()),
    relayToken: v.optional(v.string()),
    clearRelayToken: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx, "configurar el correo del taller");
    const checked = validateMailSettings(args);
    if (!checked.ok) throw new ConvexError(checked.error);
    const value = checked.value;
    const row = await readRow(ctx);
    // La clave pertenece al servicio: al cambiarlo, la anterior no se hereda.
    const sameProvider = row !== null && row.provider === value.provider;
    const previousKey = sameProvider ? row?.apiKey : undefined;
    const previousToken = sameProvider ? row?.relayToken : undefined;
    const apiKey =
      value.provider === "vly"
        ? undefined
        : nextSecret(
            args.apiKey,
            args.clearApiKey,
            previousKey,
            "La clave del servicio",
          );
    const relayToken =
      value.provider === "relay"
        ? nextSecret(
            args.relayToken,
            args.clearRelayToken,
            previousToken,
            "El testigo del relevo",
          )
        : undefined;

    const record = {
      provider: value.provider,
      enabled: value.enabled,
      fromName: value.fromName,
      fromEmail: value.fromEmail,
      replyTo: value.replyTo,
      bcc: value.bcc,
      domain: value.domain,
      relayUrl: value.relayUrl,
      smtpUser: value.smtpUser,
      updatedAt: Date.now(),
      updatedBy: admin.name?.trim() || admin.email?.trim() || "Administración",
      ...(apiKey === undefined ? {} : { apiKey }),
      ...(relayToken === undefined ? {} : { relayToken }),
    };

    if (row === null) {
      await ctx.db.insert("mailSettings", { key: SETTINGS_KEY, ...record });
    } else {
      // Lo que deja de aplicar se borra del todo: al volver a un servicio no
      // reaparece una clave vieja que ya nadie sabe de dónde salió.
      await ctx.db.patch(row._id, {
        ...record,
        ...(apiKey === undefined ? { apiKey: undefined } : {}),
        ...(relayToken === undefined ? { relayToken: undefined } : {}),
      });
    }
    return publicView(await readRow(ctx));
  },
});

/** Apunta cómo fue la última prueba, para que la pantalla lo enseñe. */
export const recordTest = internalMutation({
  args: {
    to: v.string(),
    ok: v.boolean(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const row = await readRow(ctx);
    if (row === null) return;
    await ctx.db.patch(row._id, {
      lastTestAt: Date.now(),
      lastTestTo: args.to,
      lastTestOk: args.ok,
      lastTestError: args.ok ? undefined : args.error,
    });
  },
});

/** Para no meter HTML de nadie en el cuerpo de los correos. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * La comprobación previa del correo: le pide al relevo que se conecte y se
 * autentique contra el servidor SMTP con lo que hay guardado, **sin mandar
 * ningún correo**. Es el paso de antes de mandar la prueba: sirve para saber si
 * la contraseña de aplicación de Gmail es la buena, si el puerto está abierto o
 * si el certificado valida, sin gastar un mensaje ni tocar ningún buzón.
 *
 * Solo la entiende el relevo —el backend no puede hablar SMTP y un servicio con
 * API no tiene por dónde conectarse—, así que con los demás se dice que su
 * comprobación es el correo de prueba, en vez de fingir que se ha comprobado algo.
 *
 * No se apunta en el histórico de envíos: allí se apunta lo que salió, y aquí no
 * ha salido nada.
 */
export const check = action({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    ok: boolean;
    provider: MailProvider;
    detail?: string;
    error?: string;
  }> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError(
        "Debes iniciar sesión para comprobar el correo del taller.",
      );
    }
    const allowed = await ctx.runQuery(internal.mailSettings.canConfigure, {
      userId,
    });
    if (!allowed) throw new ConvexError(NO_ADMIN_MESSAGE);

    const config = await ctx.runQuery(internal.mailSettings.delivery, {});
    const provider = config.provider;
    if (!config.enabled) {
      return {
        ok: false,
        provider,
        error: "El correo saliente está apagado en los ajustes del taller.",
      };
    }

    const built = buildMailCheckRequest(config);
    if (!built.ok) return { ok: false, provider, error: built.error };

    try {
      const response = await fetch(built.request.url, {
        method: built.request.method,
        headers: built.request.headers,
        body: built.request.body,
      });
      const text = await response.text().catch(() => "");
      let payload: {
        ok?: boolean;
        error?: string;
        check?: MailCheckResult | null;
      } = {};
      try {
        payload = JSON.parse(text) as typeof payload;
      } catch {
        // Un relevo que no contesta JSON se cuenta por su código, abajo.
      }
      if (!response.ok || payload.ok !== true) {
        return {
          ok: false,
          provider,
          error:
            payload.error ??
            `El relevo respondió HTTP ${response.status} a la comprobación.`,
        };
      }
      const result = payload.check;
      const detail =
        result !== undefined &&
        result !== null &&
        typeof result.host === "string" &&
        typeof result.port === "number"
          ? mailCheckSummary(result)
          : undefined;
      return {
        ok: true,
        provider,
        ...(detail === undefined ? {} : { detail }),
      };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        provider,
        error: `No se pudo hablar con el relevo: ${detail}`,
      };
    }
  },
});

/**
 * Un correo de prueba, para no descubrir que la clave está mal el día que hay
 * una incidencia esperando aviso. Se manda al correo que escriba el
 * administrador —no a la lista del taller— y no toca ninguna ficha.
 */
export const sendTest = action({
  args: { to: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: boolean; error?: string; provider: MailProvider }> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError(
        "Debes iniciar sesión para probar el correo del taller.",
      );
    }
    const allowed = await ctx.runQuery(internal.mailSettings.canConfigure, {
      userId,
    });
    if (!allowed) throw new ConvexError(NO_ADMIN_MESSAGE);

    const to = args.to.trim().toLowerCase();
    if (!looksLikeEmail(to)) {
      throw new ConvexError(
        "Esa dirección no parece un correo: revisa lo que has escrito.",
      );
    }

    const config = await ctx.runQuery(internal.mailSettings.delivery, {});
    const label = mailProviderLabel(config.provider);
    const sender =
      config.provider === "vly"
        ? "la pasarela de la plataforma"
        : formatSender(config);
    const subject = "Prueba de correo · Pulso Taller";
    const text = [
      "Este correo lo has pedido desde Ajustes del taller, para comprobar que el envío funciona.",
      "",
      `Sale por: ${label}`,
      `Remitente: ${sender}`,
      `Hora del envío: ${new Date().toISOString()}`,
      "",
      "Si lo has recibido, la configuración del correo está bien: los avisos de incidencia y el resumen semanal saldrán por este mismo camino.",
    ].join("\n");
    const html = [
      "<p>Este correo lo has pedido desde <strong>Ajustes del taller</strong>, para comprobar que el envío funciona.</p>",
      "<ul>",
      `<li>Sale por: ${escapeHtml(label)}</li>`,
      `<li>Remitente: ${escapeHtml(sender)}</li>`,
      `<li>Hora del envío: ${escapeHtml(new Date().toISOString())}</li>`,
      "</ul>",
      "<p>Si lo has recibido, la configuración del correo está bien: los avisos de incidencia y el resumen semanal saldrán por este mismo camino.</p>",
    ].join("\n");

    const result = await deliverMailLogged(
      ctx,
      config,
      { to: [to], subject, text, html },
      "el correo de prueba",
      "prueba",
    );
    await ctx.runMutation(internal.mailSettings.recordTest, {
      to,
      ok: result.ok,
      error: result.error,
    });
    return {
      ok: result.ok,
      ...(result.ok ? {} : { error: result.error }),
      provider: config.provider,
    };
  },
});
