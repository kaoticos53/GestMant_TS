import { ConvexError } from "convex/values";
import { Doc } from "./_generated/dataModel";
import { MutationCtx } from "./_generated/server";
import { PUBLIC_CODE_LENGTH, publicCodeFrom } from "../lib/publicCode";

/**
 * La mitad que habla con la base del reparto de códigos. `lib/publicCode` decide
 * qué forma tiene un código; aquí se tira el azar, se mira que el que ha salido no
 * esté ya puesto y se apunta en la ficha. Es la costura de persistencia, como
 * `references.ts` lo es de las referencias internas.
 *
 * Lo que NO hace, a propósito: contar. Un contador daría códigos adivinables —el
 * siguiente al que se acaba de repartir—, que es justo lo que el código viene a
 * evitar. Se tira al azar y, si sale uno cogido, se vuelve a tirar.
 *
 * Con ocho caracteres hay más combinaciones que incidencias puede tener un taller
 * en varias vidas, así que en la práctica no se repite ninguno: el bucle está para
 * que un choque sea un reintento y no dos casos con el mismo código, no porque se
 * espere. Si aun así no encuentra hueco, se dice —es más honesto que entregar una
 * ficha sin código o la de otro—.
 */

/** Cuántas veces se prueba antes de darse por vencido. */
const ATTEMPTS = 5;

/**
 * Un código libre para la incidencia que se va a insertar ahora mismo.
 *
 * Comprueba de verdad contra el índice porque es lo único que garantiza que dos
 * incidencias no compartan código: la muestra y los datos de una instalación
 * vieja pueden tener códigos que no repartió esta función.
 */
export async function freePublicCode(ctx: MutationCtx): Promise<string> {
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    const code = publicCodeFrom(
      crypto.getRandomValues(new Uint8Array(PUBLIC_CODE_LENGTH)),
    );
    const taken = await ctx.db
      .query("incidents")
      .withIndex("by_publicCode", (q) => q.eq("publicCode", code))
      .first();
    if (taken === null) return code;
  }
  throw new ConvexError(
    "No se pudo repartir un código libre para la incidencia. Vuelve a intentarlo.",
  );
}

/**
 * El código de una incidencia que quizá no tenga uno.
 *
 * Las incidencias anteriores a esta columna se quedaron sin código —no hay nada
 * que migrar a mano: se les da uno la primera vez que hace falta—, y ese momento
 * es el aviso por correo. Sin esto, quien notificó una de esas seguiría recibiendo
 * un correo con una referencia interna que ya no sirve para consultar nada.
 */
export async function ensurePublicCode(
  ctx: MutationCtx,
  incident: Doc<"incidents">,
): Promise<string> {
  if (incident.publicCode !== undefined) return incident.publicCode;
  const code = await freePublicCode(ctx);
  await ctx.db.patch(incident._id, { publicCode: code });
  return code;
}
