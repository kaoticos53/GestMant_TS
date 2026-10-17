/**
 * El freno de la consulta pública: cuántas veces se puede seguir un mismo código
 * por hora.
 *
 * La consulta por código no pide sesión —quien avisó de la avería no tiene
 * cuenta—, así que es otra puerta abierta como el formulario de avisos, y lleva
 * el mismo tipo de freno. Lo que cambia es qué se cuenta: allí es la persona
 * —el nombre con el que firma—; aquí no hay nombre, solo el código que se está
 * consultando, porque es lo único que el servidor conoce de quien llama.
 *
 * Dos decisiones que no son de estilo:
 *
 * - **La ventana es fija y empieza en la primera consulta**, no deslizante. Con
 *   una ventana que se moviera sola, quien consultase una vez cada pocos
 *   minutos no llegaría a agotar nunca el cupo y el freno no frenaría nada; con
 *   una ventana fija, el cupo se recupera de golpe al cumplirse la hora, que es
 *   lo que se puede explicar en una frase («vuelve a intentarlo en 20 minutos»).
 * - **El código es la clave**, no quien consulta. Sin sesión no hay identidad, y
 *   el servidor no ve la dirección desde la que se llama; inventar una clave con
 *   lo que no se tiene sería un freno que no frena. Contar por código protege al
 *   caso de que alguien lo machaque —un sondeo automático, un enlace que se abre
 *   en bucle— y deja intactos los demás casos, que es lo que se espera de un
 *   límite pensado para la puerta pública y no para el taller.
 *
 * Las cuentas viven aquí, sin base de datos ni reloj propio: reciben la ventana
 * anterior y la hora, y devuelven la ventana nueva o el motivo del «aún no». El
 * adaptador (`convex/publicLookupLimits`) es quien lee la fila, la escribe y
 * lanza el error.
 */

/** Lo que dura la ventana: una hora. */
export const LOOKUP_WINDOW_MS = 60 * 60 * 1000;

/**
 * Consultas que admite un mismo código por ventana. Con una hora de ventana, es
 * de sobra para seguir un caso —quien lo mira a mano lo hace unas pocas veces— y
 * no deja pasar un sondeo que pregunte solo.
 */
export const LOOKUP_LIMIT_PER_HOUR = 30;

/** La ventana que guarda la base: cuándo empezó y cuántas consultas lleva. */
export interface LookupWindow {
  windowStart: number;
  count: number;
}

/** Lo que sale de admitir una consulta: la ventana nueva, o el motivo del freno. */
export type LookupAdmission =
  | { allowed: true; window: LookupWindow }
  | { allowed: false; retryInMinutes: number; error: string };

/** El aviso que se le enseña a quien consulta, con lo que le queda de espera. */
export function lookupLimitError(retryInMinutes: number): string {
  const minutos =
    retryInMinutes === 1 ? "1 minuto" : `${retryInMinutes} minutos`;
  return `Has consultado este código demasiadas veces seguidas (${LOOKUP_LIMIT_PER_HOUR} consultas por hora). Vuelve a intentarlo en ${minutos}.`;
}

/**
 * El instante en el que una ventana ya ha caducado: la que empezó antes —o justo
 * entonces— no cuenta.
 *
 * Es la frontera que abre una ventana nueva en `admitLookup`, y la que usa la
 * purga de la noche para saber qué filas puede borrar. La regla vive aquí, una
 * sola vez, porque las dos tienen que coincidir: una fila caducada se reinicia
 * sola en la siguiente consulta, así que borrarla no le da cupo a nadie —ni se lo
 * quita—, y una que aún cuenta no se puede tocar sin devolverle el cupo a quien
 * estaba frenado.
 */
export function expiredBefore(now: number): number {
  return now - LOOKUP_WINDOW_MS;
}

/**
 * Decide si la consulta pasa y con qué ventana queda contada.
 *
 * Sin ventana —la primera vez que se consulta un código, o después de un
 * vaciado del taller— se abre una nueva. Con la ventana cumplida se abre otra,
 * que empieza en esta consulta. Dentro de la ventana se cuenta mientras quede
 * cupo; agotado, no se cuenta ni se alarga: se dice cuánto falta para que la
 * ventana termine, que es cuando vuelve el cupo.
 */
export function admitLookup(
  previous: LookupWindow | undefined,
  now: number,
): LookupAdmission {
  if (previous === undefined || previous.windowStart <= expiredBefore(now)) {
    return { allowed: true, window: { windowStart: now, count: 1 } };
  }
  if (previous.count < LOOKUP_LIMIT_PER_HOUR) {
    return {
      allowed: true,
      window: { windowStart: previous.windowStart, count: previous.count + 1 },
    };
  }
  // Los minutos se redondean hacia arriba y nunca bajan de uno: al que le queda
  // medio minuto se le dice «1 minuto», no «0 minutos», que se lee como un
  // freno que ya no está.
  const retryInMinutes = Math.max(
    1,
    Math.ceil((previous.windowStart + LOOKUP_WINDOW_MS - now) / 60_000),
  );
  return {
    allowed: false,
    retryInMinutes,
    error: lookupLimitError(retryInMinutes),
  };
}
