import { createVlyIntegrations } from "@vly-ai/integrations";
import {
  buildMailRequest,
  mailProviderLabel,
  mailRelayFailureHint,
  normalizeRecipients,
  type MailMessage,
  type MailOrigin,
  type MailTransport,
} from "../../lib/mail";
import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";

/**
 * Entregar un correo del taller, por el servicio que esté configurado.
 *
 * Es el único sitio del backend que sale a la red con un correo. Antes había dos
 * —el aviso de una incidencia y el resumen semanal—, y cada uno hablaba con la
 * pasarela de la plataforma por su cuenta: el día que el taller apuntara su
 * correo a otro servicio, uno de los dos seguiría yendo por donde no toca. Aquí
 * vive la decisión una sola vez, y los dos la preguntan.
 *
 * Solo hay un camino especial: la pasarela de la plataforma va por su SDK, que
 * firma con la clave del deployment y pone el remitente. Los demás servicios son
 * una petición HTTP normal, compuesta en `lib/mail`.
 *
 * Lo que se devuelve no es un error lanzado: quien llama apunta el motivo donde
 * toca —la ficha de la incidencia, el histórico del resumen— y sigue con lo suyo.
 * Un correo que no sale no puede tumbar el cambio de estado que lo provocó.
 */

/** La configuración ya resuelta: ajustes del taller más secretos del servidor. */
export interface MailDeliveryConfig extends MailTransport {
  enabled: boolean;
}

/** Cómo fue el intento. */
export interface MailDelivery {
  ok: boolean;
  error?: string;
}

/** Un texto de respuesta que se pueda leer en una pantalla: corto y en una línea. */
function shortDetail(value: string): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean === "") return "";
  return clean.length > 300 ? `${clean.slice(0, 300)}…` : clean;
}

/**
 * Manda el correo por el servicio configurado. `what` es lo que se está
 * enviando, en minúsculas y con artículo —«el aviso a quien notificó», «el correo
 * del resumen»—, para que el motivo de un fallo se lea como una frase y no como
 * el mensaje de una librería.
 */
export async function deliverMail(
  config: MailDeliveryConfig,
  message: MailMessage,
  what: string,
): Promise<MailDelivery> {
  if (!config.enabled) {
    return {
      ok: false,
      error: `El correo saliente está apagado en los ajustes del taller: ${what} no se puede enviar.`,
    };
  }

  const bcc = config.bcc.trim().toLowerCase();

  if (config.provider === "vly") {
    const key = config.apiKey.trim();
    if (key === "") {
      return {
        ok: false,
        error: `El deployment no tiene VLY_INTEGRATION_KEY: ${what} no se puede enviar todavía.`,
      };
    }
    try {
      const vly = createVlyIntegrations({ deploymentToken: key });
      const result = await vly.email.send({
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
        ...(bcc === "" ? {} : { bcc }),
      });
      if (result.success) return { ok: true };
      return {
        ok: false,
        error: result.error ?? "La pasarela rechazó el envío.",
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  const built = buildMailRequest(config, message);
  if (!built.ok) return { ok: false, error: built.error };

  const label = mailProviderLabel(config.provider);
  try {
    const response = await fetch(built.request.url, {
      method: built.request.method,
      headers: built.request.headers,
      body: built.request.body,
    });
    if (response.ok) return { ok: true };
    const detail = shortDetail(await response.text().catch(() => ""));
    return {
      ok: false,
      error: `El servicio de correo (${label}) respondió HTTP ${response.status}${
        detail === "" ? "." : `: ${detail}`
      }`,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    // Un fallo de conexión no dice dónde se arregla: se añade qué mirar, para
    // que la ficha de la incidencia y el histórico no dejen al taller a ciegas.
    const hint = mailRelayFailureHint(config.provider, detail);
    return {
      ok: false,
      error: `No se pudo hablar con el servicio de correo (${label}): ${detail}${
        hint === null ? "" : ` ${hint}`
      }`,
    };
  }
}

/**
 * Lo mismo que `deliverMail`, y además lo apunta en el histórico.
 *
 * Los tres sitios que mandan correo —el aviso de una incidencia, el resumen
 * semanal y la prueba de los ajustes— entran por aquí: así el histórico no
 * depende de que cada uno se acuerde de apuntar lo suyo, y un envío que falla
 * también queda escrito, con el motivo que devolvió el servicio.
 *
 * `origin` dice de dónde sale el envío y `relatedId` a qué incidencia se refiere,
 * cuando la hay: con eso el histórico se puede leer sin abrir nada más.
 */
export async function deliverMailLogged(
  ctx: ActionCtx,
  config: MailDeliveryConfig,
  message: MailMessage,
  what: string,
  origin: MailOrigin,
  relatedId?: string,
): Promise<MailDelivery> {
  const result = await deliverMail(config, message, what);
  const bcc = config.bcc.trim().toLowerCase();
  await ctx.runMutation(internal.mailLog.record, {
    what,
    origin,
    provider: config.provider,
    to: normalizeRecipients(message.to),
    bcc: bcc === "" ? [] : [bcc],
    subject: message.subject,
    ok: result.ok,
    ...(result.ok || result.error === undefined ? {} : { error: result.error }),
    ...(relatedId === undefined ? {} : { relatedId }),
  });
  return result;
}
