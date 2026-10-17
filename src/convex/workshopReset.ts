import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import type { Id, TableNames } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { ROLES } from "./schema";

/**
 * Vaciar el taller: dejar la base como recién instalada.
 *
 * La muestra de ejemplo se carga de una vez (`seed.seedDemoData`) para probar el
 * flujo completo, pero un taller de verdad —y sobre todo uno que se despliega en
 * producción— no la quiere: sus datos son los suyos y los pone a mano. Como la
 * base no marca cada fila de la muestra, la única forma de deshacer una carga de
 * ejemplo es vaciar lo que la muestra escribió. Eso es lo que hace este módulo,
 * y por eso se llama «vaciar», no «quitar lo de ejemplo»: se lleva todo el
 * trabajo del taller.
 *
 * Lo que se vacía es el trabajo —repuestos, equipos, incidencias, peticiones,
 * compras, mantenimiento, manuales, mensajes, avisos, adjuntos—, no el taller en
 * sí: las cuentas (`users`), los roles y sus permisos, y los ajustes de fondo
 * (`archiveSettings`, `alertSettings`, `reportSettings`, `trashFiles`...) se
 * quedan, para no dejar a quien lo vacía sin sesión ni con el taller a medio
 * configurar. El registro de auditoría no existe como tabla: se deriva de las
 * incidencias, que se van con lo demás.
 *
 * El borrado va por tandas (`clearBatch`) y lo conduce una acción: una sola
 * mutación no cabe con una muestra larga —cientos de incidencias y peticiones—,
 * así que la acción la repite hasta que no queda nada. Las claves del almacén
 * que quedan huérfanas al borrar sus filas no se tocan aquí: la limpieza
 * nocturna las barre cuando nadie las cita (`storageCleanup`).
 */

/** Cuántas filas borra de cada tabla en una pasada. */
const BATCH_PER_TABLE = 32;

/**
 * Las tablas del taller que se vacían. Es una lista explícita y no «todo el
 * esquema menos las cuentas» a propósito: así una tabla nueva no desaparece por
 * olvido —si se añade al esquema y es del taller, hay que traerla aquí—, y las
 * cuentas, los roles y los ajustes quedan fuera por construcción.
 */
const RESET_TABLES: TableNames[] = [
  "spareParts",
  "equipment",
  "incidents",
  "incidentDocuments",
  "incidentDocumentLog",
  "partRequests",
  "requestDecisions",
  "purchaseRequests",
  "purchaseOrders",
  "receptions",
  "maintenanceRecords",
  "manuals",
  "notifications",
  "messages",
  "reportUploads",
  "storageCleanupRuns",
  "reportUploadPurges",
  "trashFiles",
  "weeklyReports",
  // El freno de la consulta pública no es trabajo del taller, pero se cuenta por
  // código de incidencia: tras vaciar, un código nuevo no debería heredar el
  // cupo gastado del que tenía antes.
  "publicLookupLimits",
  // El flag de «muestra cargada» vive aquí: si no se va, volver a cargar datos
  // de ejemplo no haría nada.
  "appSettings",
];

const NO_PERMISSION_MESSAGE =
  "No tienes permisos para vaciar el taller. Pídeselo a quien administra el taller.";

const NO_SESSION_MESSAGE = "Debes iniciar sesión para vaciar el taller.";

/**
 * Comprueba antes de iniciar el vaciado si el usuario tiene sesión válida, activa
 * y rol de administrador del taller.
 */
export const checkResetPermission = internalQuery({
  args: { userId: v.id("users") },
  handler: async (
    ctx,
    args,
  ): Promise<{ allowed: boolean; reason?: "session" | "permission" }> => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.active === false || user.isAnonymous === true) {
      return { allowed: false, reason: "session" };
    }
    if (user.role !== ROLES.ADMIN) {
      return { allowed: false, reason: "permission" };
    }
    return { allowed: true };
  },
});

/**
 * Borra una tanda de cada tabla del taller. Devuelve cuántas filas se ha
 * llevado, que es como la acción sabe si queda algo: cuando una pasada no borra
 * nada, el taller está vacío.
 *
 * Comprueba el permiso en cada llamada: es interna, pero el `userId` viaja desde
 * la acción y no se fía de él para decidir —exige rol de administrador—.
 */
export const clearBatch = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<number> => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.active === false || user.isAnonymous === true) {
      throw new ConvexError(NO_SESSION_MESSAGE);
    }
    if (user.role !== ROLES.ADMIN) {
      throw new ConvexError(NO_PERMISSION_MESSAGE);
    }

    let deleted = 0;
    for (const table of RESET_TABLES) {
      const rows = await ctx.db.query(table).take(BATCH_PER_TABLE);
      for (const row of rows) {
        await ctx.db.delete(row._id as Id<TableNames>);
        deleted += 1;
      }
    }
    return deleted;
  },
});

/** Techo de pasadas: con tandas de 32 por tabla sobra, y evita un bucle infinito
 * si una tabla creciera sola entre pasada y pasada. */
const MAX_PASSES = 500;

/**
 * Vacía el taller: repite la tanda hasta que no queda nada y devuelve cuántas
 * filas se llevó. Se pide desde Ajustes del taller, con confirmación por delante.
 */
import { logSecurityEvent } from "./audit";

export const logResetAudit = internalMutation({
  args: {
    userId: v.id("users"),
    deleted: v.number(),
    passes: v.number(),
  },
  handler: async (ctx, args) => {
    await logSecurityEvent(ctx, {
      actorId: args.userId,
      action: "workshop_reset",
      target: "system:workshop",
      metadata: { deleted: args.deleted, passes: args.passes, at: Date.now() },
    });
  },
});

export const resetWorkshop = action({
  args: {},
  handler: async (ctx): Promise<{ deleted: number; passes: number }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError(NO_SESSION_MESSAGE);

    const check = await ctx.runQuery(
      internal.workshopReset.checkResetPermission,
      {
        userId,
      },
    );
    if (!check.allowed) {
      throw new ConvexError(
        check.reason === "session" ? NO_SESSION_MESSAGE : NO_PERMISSION_MESSAGE,
      );
    }

    let deleted = 0;
    let passes = 0;
    for (; passes < MAX_PASSES;) {
      const batch = await ctx.runMutation(internal.workshopReset.clearBatch, {
        userId,
      });
      passes += 1;
      deleted += batch;
      if (batch === 0) break;
    }

    await ctx.runMutation(internal.workshopReset.logResetAudit, {
      userId,
      deleted,
      passes,
    });

    return { deleted, passes };
  },
});
