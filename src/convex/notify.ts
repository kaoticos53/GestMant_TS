import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

/**
 * El aviso in-app del taller: una fila en `notifications` por persona. Vive aquí
 * —y no en el módulo que lo usó primero— porque lo comparten las incidencias, las
 * peticiones y la limpieza del almacén: los tres avisan por la misma campana y
 * ninguno tiene por qué saber de los otros.
 */

/**
 * Aviso in-app a los interesados (se excluye siempre quien provoca el aviso).
 * `incidentId` es opcional: un aviso que no es de una incidencia —el de la
 * limpieza del almacén— no lleva a ninguna ficha.
 */
export async function notifyUsers(
  ctx: MutationCtx,
  userIds: Id<"users">[],
  text: string,
  incidentId?: Id<"incidents">,
  exceptUserId?: Id<"users">,
) {
  const now = Date.now();
  const unique = new Set(userIds);
  for (const userId of unique) {
    if (userId === exceptUserId) continue;
    await ctx.db.insert("notifications", {
      userId,
      text,
      read: false,
      ...(incidentId ? { incidentId } : {}),
      createdAt: now,
    });
  }
}
