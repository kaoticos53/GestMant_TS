import { ConvexError } from "convex/values";
import { internalMutation, MutationCtx } from "./_generated/server";
import { admitLookup, expiredBefore } from "../lib/publicLookup";

/**
 * La mitad que habla con la base del freno de la consulta pública.
 * `lib/publicLookup` decide cuántas consultas caben en la hora y qué se le dice a
 * quien se pasa; aquí se lee la fila del código, se cuenta y se escribe. Es la
 * costura de persistencia, como `publicCodes.ts` lo es del reparto de códigos.
 *
 * Se llama desde la consulta por código (`incidents.byCode`), que por eso es una
 * mutación y no una consulta: una consulta de Convex no puede escribir, y un
 * freno que no apunta lo que cuenta no frena nada —cada llamada empezaría de
 * cero—. Va antes de buscar la incidencia, para que también cuenten los códigos
 * que no llevan a nada: si no, quien fuera probando códigos no gastaría cupo.
 *
 * El error es un `ConvexError` con el texto que se le enseña a quien consulta
 * —«vuelve a intentarlo en N minutos»—, igual que el del formulario de avisos
 * cuando alguien insiste.
 *
 * Y aquí abajo está la otra mitad del freno, la que no frena: la purga con la que
 * la tabla no se queda con lo que ya no cuenta.
 */
export async function admitPublicLookup(
  ctx: MutationCtx,
  code: string,
  now: number = Date.now(),
): Promise<void> {
  // Una fila por código: la ventana en curso. Si no hay ninguna, esta consulta
  // abre la primera; si la que hay ya cumplió su hora, la vuelve a abrir.
  const current = await ctx.db
    .query("publicLookupLimits")
    .withIndex("by_code", (q) => q.eq("code", code))
    .first();

  const admission = admitLookup(
    current === null
      ? undefined
      : { windowStart: current.windowStart, count: current.count },
    now,
  );

  // Agotado el cupo no se escribe nada: se lanza el motivo y la transacción no
  // deja rastro, así que las consultas rechazadas no alargan la espera.
  if (!admission.allowed) throw new ConvexError(admission.error);

  if (current === null) {
    await ctx.db.insert("publicLookupLimits", {
      code,
      windowStart: admission.window.windowStart,
      count: admission.window.count,
    });
  } else {
    await ctx.db.patch(current._id, {
      windowStart: admission.window.windowStart,
      count: admission.window.count,
    });
  }
}

/**
 * Cuántas filas caducadas se lleva cada noche. Como las otras pasadas del
 * taller, va por tandas: si la tabla hubiera crecido antes de que existiera esta
 * purga —o si un día se consultan miles de códigos—, la primera noche se lleva
 * una tanda y las siguientes siguen, en vez de intentar leerlo todo de golpe.
 */
const PURGE_LIMIT = 100;

/**
 * La purga de la noche: borra las ventanas caducadas, y solo esas.
 *
 * Es una tabla de estado efímero —una fila por código consultado— y sin esta
 * pasada guardaría el rastro de todos los códigos que se hayan seguido alguna
 * vez, no los de la última hora. Los `if` de arriba no la necesitan para frenar:
 * una ventana caducada ya se reinicia sola en la siguiente consulta. Se borra
 * porque lo que no se lee no se guarda, y porque una tabla que solo crece es una
 * tabla que algún día hay que vaciar a mano.
 *
 * El corte es el de `lib/publicLookup` (`expiredBefore`), el mismo que decide
 * cuándo una ventana deja de contar: así lo que se borra es exactamente lo que ya
 * no frena a nadie, y ninguna consulta gana ni pierde cupo por esta pasada. Va
 * por tandas y devuelve cuántas filas se llevó, que es lo que miran las pruebas.
 */
export const purgeExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("publicLookupLimits")
      .withIndex("by_windowStart", (q) =>
        q.lte("windowStart", expiredBefore(Date.now())),
      )
      .take(PURGE_LIMIT);

    for (const row of rows) {
      await ctx.db.delete(row._id);
    }
    return rows.length;
  },
});
