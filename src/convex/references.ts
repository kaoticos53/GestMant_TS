import { MutationCtx } from "./_generated/server";
import {
  formatReference,
  resumeSequence,
  type ReferenceKind,
} from "../lib/references";

/**
 * La mitad que habla con la base del reparto de referencias. `lib/references`
 * decide qué número toca —el más alto entre el contador y lo que hay en uso, más
 * uno— y aquí se le pregunta a Convex por esas dos cosas, se comprueba que la
 * referencia no esté puesta y se apunta el contador: es el único trozo que
 * necesita la tabla, y por eso vive aparte del dominio puro.
 *
 * No exporta funciones de Convex a propósito: no es un sitio al que llame el
 * panel, sino la costura de persistencia que comparten las cuatro series —la
 * incidencia, la petición de repuestos, la petición de compra y la orden—. Antes
 * cada módulo repartía el número a su manera: uno contaba filas, y como la
 * papelera borra de verdad lo retirado, la siguiente petición heredaba una
 * referencia ya usada que seguía citada en las órdenes de compra. Ahora hay una
 * sola forma de mirar, para las cuatro.
 */

/** La tabla de cada serie: el reparto se apoya en su índice `by_reference`. */
const TABLES = {
  incident: "incidents",
  partRequest: "partRequests",
  purchaseRequest: "purchaseRequests",
  purchaseOrder: "purchaseOrders",
} as const satisfies Record<ReferenceKind, string>;

/**
 * La referencia que le toca a la fila que se va a insertar ahora mismo.
 *
 * Se parte de lo que dice el contador de la serie —por dónde iba la numeración— y
 * de la referencia más alta que hay puesta (el índice va por referencia y, con el
 * mismo ancho de cifras, ese orden es el del número), se toma el más alto de los
 * dos y se avanza hasta la primera libre.
 *
 * El salto comprueba de verdad porque hay dos sitios donde el número más alto no
 * se ve a la primera: el orden de las referencias escritas deja de ser el numérico
 * al pasar de cuatro cifras («INC-9999» se lee antes que «INC-10000»), y una serie
 * que aún no tenga contador se numera solo con lo que hay en la tabla.
 *
 * Apuntar el contador aquí, en la misma transacción que la fila que va a usar el
 * número, tiene además una consecuencia buena: dos altas a la vez de la misma serie
 * chocan en la fila del contador y Convex repite una de las dos, así que la
 * numeración no se puede pisar ni de forma accidental.
 */
export async function freeReference(
  ctx: MutationCtx,
  kind: ReferenceKind,
): Promise<string> {
  const table = TABLES[kind];
  const counter = await ctx.db
    .query("referenceCounters")
    .withIndex("by_kind", (q) => q.eq("kind", kind))
    .unique();
  const highest = await ctx.db
    .query(table)
    .withIndex("by_reference")
    .order("desc")
    .first();

  let sequence = resumeSequence(kind, [highest?.reference], counter?.last);
  while (
    (await ctx.db
      .query(table)
      .withIndex("by_reference", (q) =>
        q.eq("reference", formatReference(kind, sequence)),
      )
      .first()) !== null
  ) {
    sequence += 1;
  }

  if (counter === null) {
    await ctx.db.insert("referenceCounters", { kind, last: sequence });
  } else {
    await ctx.db.patch(counter._id, { last: sequence });
  }
  return formatReference(kind, sequence);
}
