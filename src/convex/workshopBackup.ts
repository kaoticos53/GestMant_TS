import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import {
  BACKUP_FORMAT,
  BACKUP_TABLES,
  BACKUP_VERSION,
  backupMailShareRow,
  parseWorkshopBackup,
  remapBackupDocument,
  restoreMailShareRow,
  type BackupSummary,
  type BackupTableName,
  type WorkshopBackupPayload,
} from "../lib/backup";
import { ROLES } from "./schema";
import { internal } from "./_generated/api";
import type { Id, TableNames } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
  type ActionCtx,
  type MutationCtx,
} from "./_generated/server";
import { logSecurityEvent } from "./audit";

const BATCH_DELETE = 64;
const MAX_CLEAR_PASSES = 400;

const NO_SESSION_MSG =
  "Debes iniciar sesión con una cuenta activa para gestionar copias de seguridad.";
const NO_ADMIN_MSG =
  "Solo el administrador puede exportar o restaurar copias de seguridad del taller.";

async function assertAdminUser(ctx: MutationCtx, userId: Id<"users">) {
  const user = await ctx.db.get(userId);
  if (!user || user.active === false || user.isAnonymous === true) {
    throw new ConvexError(NO_SESSION_MSG);
  }
  if (user.role !== ROLES.ADMIN) {
    throw new ConvexError(NO_ADMIN_MSG);
  }
  return user;
}

export const checkAdmin = internalQuery({
  args: { userId: v.id("users") },
  handler: async (
    ctx,
    args,
  ): Promise<{ allowed: boolean; actorName: string; reason?: string }> => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.active === false || user.isAnonymous === true) {
      return { allowed: false, actorName: "", reason: NO_SESSION_MSG };
    }
    if (user.role !== ROLES.ADMIN) {
      return { allowed: false, actorName: "", reason: NO_ADMIN_MSG };
    }
    return {
      allowed: true,
      actorName: user.name?.trim() || user.email?.trim() || "Administrador",
    };
  },
});

export const collectAllTables = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.active === false || user.isAnonymous === true) {
      throw new ConvexError(NO_SESSION_MSG);
    }
    if (user.role !== ROLES.ADMIN) {
      throw new ConvexError(NO_ADMIN_MSG);
    }

    const tables: Partial<
      Record<BackupTableName, Array<Record<string, unknown>>>
    > = {};
    const tableCounts: Partial<Record<BackupTableName, number>> = {};
    let totalRecords = 0;

    for (const table of BACKUP_TABLES) {
      const rows = await ctx.db.query(table as TableNames).collect();
      // Las copias de correo salen solo como metadatos: el contenido es del
      // expediente y no viaja en un JSON de backup.
      const exported =
        table === "mailShares"
          ? (rows as unknown as Array<Record<string, unknown>>).map(
              backupMailShareRow,
            )
          : (rows as unknown as Array<Record<string, unknown>>);
      tables[table] = exported;
      tableCounts[table] = exported.length;
      totalRecords += exported.length;
    }

    return { tables, tableCounts, totalRecords };
  },
});

export const clearBatch = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<number> => {
    await assertAdminUser(ctx, args.userId);
    let deleted = 0;
    for (const table of BACKUP_TABLES) {
      const rows = await ctx.db.query(table as TableNames).take(BATCH_DELETE);
      for (const row of rows) {
        await ctx.db.delete(row._id as Id<TableNames>);
        deleted += 1;
      }
    }
    return deleted;
  },
});

type InsertedPairs = Array<{ oldId: string; newId: string }>;

/** Argumentos de un lote: los mismos para escribirlo y para comprobarlo. */
const batchArgs = {
  userId: v.id("users"),
  table: v.string(),
  rowsJson: v.string(),
  idMapJson: v.string(),
};

/**
 * Inserta un lote de filas de una copia remapeando sus referencias. Es el único
 * camino que escribe una restauración: la comprobación previa lo recorre igual y
 * después lo deshace, para que lo validado sea exactamente lo que se escribe.
 */
async function insertBackupRows(
  ctx: MutationCtx,
  userId: Id<"users">,
  table: BackupTableName,
  rows: Array<Record<string, unknown>>,
  idMap: Map<string, string>,
): Promise<InsertedPairs> {
  const createdPairs: InsertedPairs = [];

  for (const rawRow of rows) {
    const oldId = typeof rawRow._id === "string" ? rawRow._id : undefined;

    // Una copia de correo sin su ficha no se restaura: sería una huérfana
    // artificial. Se omite y queda la traza, sin inventar un destino.
    if (table === "mailShares") {
      const oldDestinationId =
        typeof rawRow.destinationId === "string"
          ? rawRow.destinationId
          : undefined;
      const destinationId =
        oldDestinationId === undefined
          ? undefined
          : idMap.get(oldDestinationId);
      if (destinationId === undefined) {
        await logSecurityEvent(ctx, {
          actorId: userId,
          action: "mail_share_restore_skip",
          target: `mailShares:${String(rawRow.destinationReference ?? "")}`,
          metadata: { reason: "destination_missing" },
        });
        continue;
      }
      const insertedId = await ctx.db.insert(
        "mailShares",
        restoreMailShareRow(rawRow, destinationId) as never,
      );
      if (oldId) {
        idMap.set(oldId, String(insertedId));
        createdPairs.push({ oldId, newId: String(insertedId) });
      }
      continue;
    }

    const doc = remapBackupDocument(table, rawRow, idMap);
    const insertedId = await ctx.db.insert(table as TableNames, doc as never);
    if (oldId) {
      idMap.set(oldId, String(insertedId));
      createdPairs.push({ oldId, newId: String(insertedId) });
    }
  }

  return createdPairs;
}

/** Nombre de tabla del archivo, ya comprobado contra las permitidas. */
function restoreTable(tableName: string): BackupTableName {
  const table = BACKUP_TABLES.find((t) => t === tableName);
  if (!table) {
    throw new ConvexError(`Tabla de backup no permitida: ${tableName}`);
  }
  return table;
}

/** Lote deserializado de la copia: filas y remapeo acumulado. */
function readBatch(args: { rowsJson: string; idMapJson: string }) {
  const rows = JSON.parse(args.rowsJson) as Array<Record<string, unknown>>;
  const idEntries = JSON.parse(args.idMapJson) as Array<[string, string]>;
  return { rows, idMap: new Map<string, string>(idEntries) };
}

export const insertTableBatch = internalMutation({
  args: batchArgs,
  handler: async (ctx, args): Promise<InsertedPairs> => {
    await assertAdminUser(ctx, args.userId);
    const { rows, idMap } = readBatch(args);
    return await insertBackupRows(
      ctx,
      args.userId,
      restoreTable(args.table),
      rows,
      idMap,
    );
  },
});

/** Código con el que la comprobación previa se deshace a sí misma. */
const CHECK_ROLLBACK = "workshop_backup_check_rollback";

/**
 * Comprueba un lote como lo insertaría la restauración. Al final lanza para que
 * Convex revierta el lote entero —también la traza de una copia de correo
 * omitida—, así que no queda nada escrito: se descubre si el esquema acepta las
 * filas antes de vaciar el taller. El remapeo viaja en el error porque es la
 * única salida de una mutación deshecha, y los lotes siguientes lo necesitan
 * para no borrar referencias que sí existen en la copia.
 */
export const checkTableBatch = internalMutation({
  args: batchArgs,
  handler: async (ctx, args) => {
    await assertAdminUser(ctx, args.userId);
    const { rows, idMap } = readBatch(args);
    const pairs = await insertBackupRows(
      ctx,
      args.userId,
      restoreTable(args.table),
      rows,
      idMap,
    );
    throw new ConvexError({ code: CHECK_ROLLBACK, pairs });
  },
});

export const logAudit = internalMutation({
  args: {
    userId: v.id("users"),
    kind: v.union(v.literal("export"), v.literal("restore")),
    totalRecords: v.number(),
  },
  handler: async (ctx, args) => {
    await assertAdminUser(ctx, args.userId);
    await logSecurityEvent(ctx, {
      actorId: args.userId,
      action:
        args.kind === "export"
          ? "workshop_backup_export"
          : "workshop_backup_restore",
      target: "system:backup",
      metadata: { totalRecords: args.totalRecords },
    });
  },
});

/** Filas por mutación: mismo tamaño para comprobar y para escribir. */
const BACKUP_CHUNK_SIZE = 40;

type CheckRollback = { code?: unknown; pairs?: unknown };

/** Devuelve el remapeo del lote comprobado, o `null` si el error es real. */
function readCheckRollback(error: unknown): InsertedPairs | null {
  if (!(error instanceof ConvexError)) return null;
  const data = error.data as CheckRollback | null;
  if (!data || data.code !== CHECK_ROLLBACK || !Array.isArray(data.pairs)) {
    return null;
  }
  return data.pairs as InsertedPairs;
}

/**
 * Pasa un lote por la comprobación previa y devuelve su remapeo. La
 * comprobación siempre se deshace; si lo que llega no es esa revocación, el
 * esquema rechaza la copia y se avisa sin haber borrado nada.
 */
async function checkBackupBatch(
  ctx: ActionCtx,
  args: {
    userId: Id<"users">;
    table: BackupTableName;
    rowsJson: string;
    idMapJson: string;
  },
): Promise<InsertedPairs> {
  try {
    await ctx.runMutation(internal.workshopBackup.checkTableBatch, args);
  } catch (error) {
    const pairs = readCheckRollback(error);
    if (pairs !== null) return pairs;
    const detail = error instanceof Error ? error.message : String(error);
    throw new ConvexError(
      `La copia no se ha restaurado y el taller sigue como estaba: ${detail}`,
    );
  }
  throw new ConvexError(
    "La comprobación de la copia no se ha deshecho; no se ha restaurado nada.",
  );
}

/**
 * Recorre la copia tabla a tabla y lote a lote, en el orden topológico. En modo
 * `check` cada lote se inserta y se revierte; en modo `restore` se escribe de
 * verdad. Devuelve las filas que quedaron escritas.
 */
async function walkBackup(
  ctx: ActionCtx,
  userId: Id<"users">,
  tables: WorkshopBackupPayload["tables"],
  mode: "check" | "restore",
): Promise<number> {
  const idMap = new Map<string, string>();
  let written = 0;

  for (const table of BACKUP_TABLES) {
    const rows = tables[table];
    if (!rows || rows.length === 0) continue;

    for (let i = 0; i < rows.length; i += BACKUP_CHUNK_SIZE) {
      const args = {
        userId,
        table,
        rowsJson: JSON.stringify(rows.slice(i, i + BACKUP_CHUNK_SIZE)),
        idMapJson: JSON.stringify(Array.from(idMap.entries())),
      };
      const pairs =
        mode === "check"
          ? await checkBackupBatch(ctx, args)
          : await ctx.runMutation(
              internal.workshopBackup.insertTableBatch,
              args,
            );
      for (const pair of pairs) {
        idMap.set(pair.oldId, pair.newId);
      }
      // Solo cuentan las filas que de verdad volvieron: una copia de correo
      // omitida por no encontrar su ficha no es un registro restaurado.
      if (mode === "restore") written += pairs.length;
    }
  }

  return written;
}

/** Exporta una copia completa en JSON de todas las tablas operativas del taller. */
export const exportBackup = action({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ rawJson: string; summary: BackupSummary }> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError(NO_SESSION_MSG);
    }
    const perm = await ctx.runQuery(internal.workshopBackup.checkAdmin, {
      userId,
    });
    if (!perm.allowed) {
      throw new ConvexError(perm.reason ?? NO_ADMIN_MSG);
    }

    const collected = await ctx.runQuery(
      internal.workshopBackup.collectAllTables,
      { userId },
    );
    const exportedAt = Date.now();
    const payload = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt,
      exportedBy: perm.actorName,
      tables: collected.tables,
    };

    await ctx.runMutation(internal.workshopBackup.logAudit, {
      userId,
      kind: "export",
      totalRecords: collected.totalRecords,
    });

    return {
      rawJson: JSON.stringify(payload, null, 2),
      summary: {
        exportedAt,
        exportedBy: perm.actorName,
        totalRecords: collected.totalRecords,
        tableCounts: collected.tableCounts,
      },
    };
  },
});

/**
 * Restaura una copia de seguridad JSON completa remapeando referencias internas.
 *
 * Antes de vaciar nada recorre la copia entera en seco: un registro que el
 * esquema rechaza detiene la restauración con el taller todavía intacto.
 */
export const restoreBackup = action({
  args: { rawJson: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<{ restoredRecords: number; exportedAt: number }> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError(NO_SESSION_MSG);
    }
    const perm = await ctx.runQuery(internal.workshopBackup.checkAdmin, {
      userId,
    });
    if (!perm.allowed) {
      throw new ConvexError(perm.reason ?? NO_ADMIN_MSG);
    }

    const parsed = parseWorkshopBackup(args.rawJson);
    if (!parsed.ok) {
      throw new ConvexError(parsed.error);
    }

    // 1. Comprobar la copia entera antes de vaciar nada: recorre el mismo camino
    //    de inserción, pero cada lote se revierte. Una fila que el esquema
    //    rechaza se descubre aquí, con el taller todavía intacto, y no a mitad
    //    del vaciado.
    await walkBackup(ctx, userId, parsed.backup.tables, "check");

    // 2. Limpiar tablas restaurables sin tocar securityAuditLog ni users
    for (let pass = 0; pass < MAX_CLEAR_PASSES; pass++) {
      const deleted = await ctx.runMutation(
        internal.workshopBackup.clearBatch,
        { userId },
      );
      if (deleted === 0) break;
    }

    // 3. Insertar en orden topológico remapeando oldId -> newId
    const restoredRecords = await walkBackup(
      ctx,
      userId,
      parsed.backup.tables,
      "restore",
    );

    await ctx.runMutation(internal.workshopBackup.logAudit, {
      userId,
      kind: "restore",
      totalRecords: restoredRecords,
    });

    return {
      restoredRecords,
      exportedAt: parsed.backup.exportedAt,
    };
  },
});
