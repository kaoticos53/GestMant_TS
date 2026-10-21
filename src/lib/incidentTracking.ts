import type { IncidentStatus } from "./workshop";

/**
 * Lo que la ficha de seguimiento le cuenta a quien consulta su caso.
 *
 * El seguimiento enseña un recorte (`trackingOf`, en `convex/incidents`): estado,
 * equipo, fechas y el paso a paso. Ese recorte dice *qué* ha pasado, pero no
 * *qué significa* —«En espera de repuestos» no le dice nada a quien avisó la
 * avería si no sabe que el taller no puede seguir hasta que llegue el material—,
 * y por eso la explicación vive aquí, junto a las cuentas del tiempo, en vez de
 * repartida por el componente.
 *
 * Son textos, no decisiones: no cambian el flujo ni qué se puede consultar. Lo
 * que sí es una decisión —y se queda en el backend— es qué campos salen en el
 * recorte; esto solo pone en palabras lo que ya ha salido.
 */

/**
 * Qué significa el estado para quien sigue el caso, en una frase.
 *
 * Está escrito para el notificador, no para el taller: sin referencias internas,
 * sin nombres de pasos del flujo y sin prometer plazos que el taller no ha dado.
 * Los dos estados de cierre explican qué hacer después, que es la duda que queda
 * cuando el caso termina.
 */
export const TRACKING_STATUS_NOTE: Record<IncidentStatus, string> = {
  reported:
    "El aviso ha entrado en la cola del taller; todavía no tiene un técnico asignado.",
  assigned: "Ya hay un técnico encargado del caso, que valora cómo resolverlo.",
  workshop:
    "El equipo ha entrado en el taller: el trabajo se hace allí, no en su sitio.",
  waitingParts:
    "No se puede seguir hasta que llegue el material que el taller ha pedido; el caso no está parado por otra cosa.",
  repairing:
    "El material ya está y el trabajo sigue, en el taller o en el propio sitio.",
  externalRepair:
    "El equipo se ha enviado a un servicio técnico especializado externo para su reparación.",
  resolved: "El caso está cerrado con la reparación hecha.",
  unresolved:
    "Se cerró sin poder resolverlo. Si vuelve a pasar, notifícalo otra vez: el aviso anterior ya no sirve para seguir el caso nuevo.",
};

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * «menos de una hora», «1 hora», «3 días»: lo que dura —o duró— un caso.
 *
 * Se cuenta en horas hasta el día y en días a partir de ahí: un caso de taller se
 * lee «tres días», no «setenta y dos horas», y uno recién abierto no se lee «0
 * días», que parece que no ha pasado nada. Por eso lo que no llega a una hora se
 * dice tal cual en vez de redondear a cero.
 */
export function trackingDuration(ms: number): string {
  if (ms < HOUR) return "menos de una hora";
  if (ms < DAY) {
    const hours = Math.floor(ms / HOUR);
    return `${hours} ${hours === 1 ? "hora" : "horas"}`;
  }
  const days = Math.floor(ms / DAY);
  return `${days} ${days === 1 ? "día" : "días"}`;
}

/**
 * Un repuesto que el caso todavía espera: qué es, cuánto falta y desde cuándo.
 *
 * Es lo que el seguimiento deja salir de una petición de repuesto: la línea —el
 * nombre y la cantidad— y la fecha en que se pidió. Nada más. Ni la referencia de
 * la petición, ni quién la hizo, ni el proveedor, ni el precio: eso es el
 * expediente del taller, y quien avisó la avería no lo necesita para saber qué
 * falta.
 */
export interface PendingPart {
  name: string;
  quantity: number;
  /** Cuándo se pidió: la fecha de la petición que lo trae. */
  since: number;
}

/**
 * Desde cuándo espera un repuesto: «pedido hace 3 días».
 *
 * Se cuenta con la misma escala que el caso (`trackingDuration`) para que la
 * ficha no diga «3 días» arriba y «72 horas» debajo, y el «ahora» se pasa desde
 * fuera por lo mismo que en el resto del módulo: las pruebas no dependen del
 * reloj.
 */
export function pendingPartWait(since: number, now: number): string {
  return `pedido hace ${trackingDuration(Math.max(0, now - since))}`;
}

/**
 * Cuándo se pidió el repuesto que lleva más tiempo esperando —lo que la ficha
 * enseña como fecha exacta, ya formateada por quien la pinta—, o `null` si no hay
 * ninguno pendiente.
 */
export function pendingPartsOldest(
  parts: readonly PendingPart[],
): number | null {
  if (parts.length === 0) return null;
  return parts.reduce(
    (oldest, part) => (part.since < oldest ? part.since : oldest),
    parts[0].since,
  );
}

/**
 * Lo que se dice cuando el caso espera material pero la petición no trae líneas
 * que enseñar —se abrió describiendo la avería y el repuesto se asocia después—:
 * mejor decirlo que dejar el hueco en blanco justo donde hay que explicar qué
 * falta.
 */
export const PENDING_PARTS_UNSPECIFIED =
  "El taller todavía no ha detallado qué repuestos necesita: los está identificando.";

/**
 * El tiempo del caso, en una frase: lo que lleva abierto, o lo que tardó en
 * cerrarse.
 *
 * Abierto y cerrado no son la misma pregunta —uno mira hacia delante y el otro
 * hacia atrás—, así que no comparten frase: «lleva abierta 3 días» y «se cerró 3
 * días después de notificarla» se leen distinto aunque el número sea el mismo.
 *
 * El «ahora» se pasa desde fuera para que las pruebas no dependan del reloj, y
 * las fechas negativas se recortan a cero: un reloj desajustado no debe producir
 * un «lleva abierta -2 días».
 */
export function trackingAgeNote({
  reportedAt,
  closedAt,
  now,
}: {
  reportedAt: number;
  closedAt: number | null;
  now: number;
}): string {
  if (closedAt !== null) {
    const elapsed = trackingDuration(Math.max(0, closedAt - reportedAt));
    return `Se cerró ${elapsed} después de notificarla.`;
  }
  return `Lleva abierta ${trackingDuration(Math.max(0, now - reportedAt))}.`;
}
