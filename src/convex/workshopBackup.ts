import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import {
  BACKUP_FORMAT,
  BACKUP_TABLES,
  BACKUP_VERSION,
  parseWorkshopBackup,
  remapBackupDocument,
  type BackupSummary,
  type BackupTableName,
} from "../lib/backup";
import { ROLES } from "./schema";
import { internal } from "./_generated/api";
import type { Id, TableNames } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
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

    const tables: Partial<Record<BackupTableName, Array<Record<string, unknown>>>> = {};
    const tableCounts: Partial<Record<BackupTableName, number>> = {};
    let totalRecords = 0;

    for (const table of BACKUP_TABLES) {
      const rows = await ctx.db.query(table as TableNames).collect();
      tables[table] = rows as unknown as Array<Record<string, unknown>>;
      tableCounts[table] = rows.length;
      totalRecords += rows.length;
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
      const rows = await ctx.db
        .query(table as TableNames)
        .take(BATCH_DELETE);
      for (const row of rows) {
        await ctx.db.delete(row._id as Id<TableNames>);
        deleted += 1;
      }
    }
    return deleted;
  },
});

export const insertTableBatch = internalMutation({
  args: {
    userId: v.id("users"),
    table: v.string(),
    rowsJson: v.string(),
    idMapJson: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<Array<{ oldId: string; newId: string }>> => {
    await assertAdminUser(ctx, args.userId);

    const table = BACKUP_TABLES.find((t) => t === args.table);
    if (!table) {
      throw new ConvexError(`Tabla de backup no permitida: ${args.table}`);
    }

    const rows = JSON.parse(args.rowsJson) as Array<Record<string, unknown>>;
    const idEntries = JSON.parse(args.idMapJson) as Array<[string, string]>;
    const idMap = new Map<string, string>(idEntries);
    const createdPairs: Array<{ oldId: string; newId: string }> = [];

    for (const rawRow of rows) {
      const oldId = typeof rawRow._id === "string" ? rawRow._id : undefined;
      const doc = remapBackupDocument(table, rawRow, idMap);
      const insertedId = await ctx.db.insert(
        table as TableNames,
        doc as never,
      );
      if (oldId) {
        idMap.set(oldId, String(insertedId));
        createdPairs.push({ oldId, newId: String(insertedId) });
      }
    }

    return createdPairs;
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

/** Restaura una copia de seguridad JSON completa remapeando referencias internas. */
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

    // 1. Limpiar tablas restaurables sin tocar securityAuditLog ni users
    for (let pass = 0; pass < MAX_CLEAR_PASSES; pass++) {
      const deleted = await ctx.runMutation(
        internal.workshopBackup.clearBatch,
        { userId },
      );
      if (deleted === 0) break;
    }

    // 2. Insertar en orden topológico remapeando oldId -> newId
    const idMap = new Map<string, string>();
    let restoredRecords = 0;
    const CHUNK_SIZE = 40;

    for (const table of BACKUP_TABLES) {
      const rows = parsed.backup.tables[table];
      if (!rows || rows.length === 0) continue;

      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE);
        const createdPairs = await ctx.runMutation(
          internal.workshopBackup.insertTableBatch,
          {
            userId,
            table,
            rowsJson: JSON.stringify(chunk),
            idMapJson: JSON.stringify(Array.from(idMap.entries())),
          },
        );
        for (const pair of createdPairs) {
          idMap.set(pair.oldId, pair.newId);
        }
        restoredRecords += chunk.length;
      }
    }

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
