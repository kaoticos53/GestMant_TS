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
  internalAction,
  internalMutation,
  internalQuery,
  type ActionCtx,
  type MutationCtx,
} from "./_generated/server";
import { logSecurityEvent } from "./audit";
import { backupFaults } from "./backupFaults";

const BATCH_DELETE = 64;
const MAX_CLEAR_PASSES = 400;

/** Caracteres por trozo de la foto previa: un taller grande no cabe en un doc. */
const SNAPSHOT_CHUNK_CHARS = 200_000;

/** Sin latido este tiempo, la acción que guardó la foto ya no está viva. */
const SNAPSHOT_STALE_MS = 30_000;

/** Cada cuánto late una restauración en marcha mientras la foto está en juego. */
const SNAPSHOT_HEARTBEAT_MS = 5_000;

/**
 * Techo de la lectura de una foto: ni un número de trozos absurdo ni un JSON
 * mayor que la memoria razonable de la acción. Una foto que no quepa no se lee
 * a medias: se declara inservible y se descarta con traza.
 */
const MAX_SNAPSHOT_CHUNKS = 2_000;
const MAX_SNAPSHOT_CHARS = 64 * 1024 * 1024;

/** La foto está sellada pero no se puede reconstruir con garantías. */
class UnusableSnapshotError extends Error {}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

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
  args: {
    userId: v.id("users"),
    /**
     * Sin proyectar: el estado que se guarda antes de vaciar no es una copia de
     * seguridad, así que las copias de correo viajan con su cuerpo, sus adjuntos
     * y su `.eml` para poder devolver el taller tal y como estaba.
     */
    raw: v.optional(v.boolean()),
  },
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
        table === "mailShares" && !args.raw
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
    const table = restoreTable(args.table);
    // Punto de ruptura de las pruebas de recuperación: simula un backend que
    // corta entre el vaciado y el último lote. En producción no se rellena.
    if (backupFaults.failOnTable === table) {
      throw new ConvexError(
        "El backend ha cortado a mitad de la inserción (fallo simulado).",
      );
    }
    const { rows, idMap } = readBatch(args);
    return await insertBackupRows(ctx, args.userId, table, rows, idMap);
  },
});

/**
 * Reinserta un lote del estado que había antes de vaciar. Es la vuelta atrás de
 * una restauración cortada, así que no se proyecta nada: las copias de correo
 * vuelven con su cuerpo, sus adjuntos y su `.eml`, y su destino se remapea como
 * cualquier otra referencia.
 */
export const insertSnapshotBatch = internalMutation({
  args: batchArgs,
  handler: async (ctx, args): Promise<InsertedPairs> => {
    await assertAdminUser(ctx, args.userId);
    const table = restoreTable(args.table);
    const { rows, idMap } = readBatch(args);
    const createdPairs: InsertedPairs = [];

    for (const rawRow of rows) {
      const oldId = typeof rawRow._id === "string" ? rawRow._id : undefined;
      const doc = remapBackupDocument(table, rawRow, idMap);
      if (table === "mailShares" && typeof doc.destinationId === "string") {
        const mapped = idMap.get(doc.destinationId);
        if (mapped !== undefined) doc.destinationId = mapped;
      }
      const insertedId = await ctx.db.insert(table as TableNames, doc as never);
      if (oldId) {
        idMap.set(oldId, String(insertedId));
        createdPairs.push({ oldId, newId: String(insertedId) });
      }
    }

    return createdPairs;
  },
});

/**
 * Comprueba un lote como lo insertaría la restauración. Al final lanza para que
 * Convex revierta el lote entero —también la traza de una copia de correo
 * omitida—, así que no queda nada escrito: se descubre si el esquema acepta las
 * filas antes de vaciar el taller. El remapeo viaja en el error (`pairs`) porque
 * es la única salida de una mutación deshecha, y los lotes siguientes lo
 * necesitan para no borrar referencias que sí existen en la copia.
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
    throw new ConvexError({ pairs });
  },
});

/** Un trozo de la foto del taller, guardada antes de vaciar. */
export const saveSnapshotChunk = internalMutation({
  args: {
    userId: v.id("users"),
    batch: v.string(),
    seq: v.number(),
    payload: v.string(),
    savedAt: v.number(),
  },
  handler: async (ctx, args) => {
    await assertAdminUser(ctx, args.userId);
    await ctx.db.insert("workshopRestoreSnapshots", {
      batch: args.batch,
      seq: args.seq,
      payload: args.payload,
      savedBy: args.userId,
      savedAt: args.savedAt,
      aliveAt: args.savedAt,
    });
  },
});

/**
 * Sella la foto: están todos sus trozos y la restauración puede empezar. En la
 * cabecera quedan el número de trozos y la suma de verificación del JSON.
 */
export const sealSnapshot = internalMutation({
  args: {
    userId: v.id("users"),
    batch: v.string(),
    chunkCount: v.number(),
    checksum: v.string(),
  },
  handler: async (ctx, args) => {
    await assertAdminUser(ctx, args.userId);
    const head = await ctx.db
      .query("workshopRestoreSnapshots")
      .withIndex("by_batch", (q) => q.eq("batch", args.batch).eq("seq", 0))
      .unique();
    if (!head) return false;
    await ctx.db.patch(head._id, {
      complete: true,
      chunkCount: args.chunkCount,
      checksum: args.checksum,
      aliveAt: Date.now(),
    });
    return true;
  },
});

/** El latido de una restauración en marcha; si la acción muere, deja de llegar. */
export const touchRestoreSnapshot = internalMutation({
  args: { userId: v.id("users"), batch: v.string() },
  handler: async (ctx, args) => {
    await assertAdminUser(ctx, args.userId);
    const head = await ctx.db
      .query("workshopRestoreSnapshots")
      .withIndex("by_batch", (q) => q.eq("batch", args.batch).eq("seq", 0))
      .unique();
    if (!head) return false;
    await ctx.db.patch(head._id, { aliveAt: Date.now() });
    return true;
  },
});

/**
 * Marca que la copia ya está escrita entera. Si la acción muere después, la
 * recuperación ve la marca y retira la foto sin deshacer la restauración.
 */
export const markSnapshotApplied = internalMutation({
  args: {
    userId: v.id("users"),
    batch: v.string(),
    totalRecords: v.number(),
  },
  handler: async (ctx, args) => {
    await assertAdminUser(ctx, args.userId);
    const head = await ctx.db
      .query("workshopRestoreSnapshots")
      .withIndex("by_batch", (q) => q.eq("batch", args.batch).eq("seq", 0))
      .unique();
    if (!head) return false;
    await ctx.db.patch(head._id, {
      appliedAt: Date.now(),
      appliedRecords: args.totalRecords,
    });
    return true;
  },
});

/** La foto pendiente, si la hay: quién la guardó, cuándo y si está completa. */
export const pendingRestoreSnapshot = internalQuery({
  args: {},
  handler: async (ctx) => {
    const last = await ctx.db
      .query("workshopRestoreSnapshots")
      .withIndex("by_savedAt")
      .order("desc")
      .first();
    if (!last) return null;
    const head = await ctx.db
      .query("workshopRestoreSnapshots")
      .withIndex("by_batch", (q) => q.eq("batch", last.batch).eq("seq", 0))
      .unique();
    if (!head) return null;
    return {
      batch: head.batch,
      savedBy: head.savedBy,
      savedAt: head.savedAt,
      aliveAt: head.aliveAt ?? head.savedAt,
      complete: head.complete === true,
      chunkCount: head.chunkCount ?? 0,
      checksum: head.checksum ?? null,
      applied: head.appliedAt !== undefined,
      appliedRecords: head.appliedRecords ?? 0,
    };
  },
});

/**
 * Quién ejecuta la recuperación de una foto: su dueño si sigue siendo un
 * administrador activo y, si no —cuenta desactivada o borrada—, cualquier otro
 * administrador activo. `savedBy` no se toca: es la traza de quién la guardó.
 */
export const resolveSnapshotAdmin = internalQuery({
  args: { savedBy: v.id("users") },
  handler: async (ctx, args) => {
    const saved = await ctx.db.get(args.savedBy);
    if (
      saved &&
      saved.active !== false &&
      saved.isAnonymous !== true &&
      saved.role === ROLES.ADMIN
    ) {
      return args.savedBy;
    }
    const fallback = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", ROLES.ADMIN))
      .filter((q) =>
        q.and(
          q.neq(q.field("active"), false),
          q.neq(q.field("isAnonymous"), true),
        ),
      )
      .first();
    return fallback?._id ?? null;
  },
});

/** Un trozo de la foto, o `null` cuando ya no hay más. */
export const readSnapshotChunk = internalQuery({
  args: { batch: v.string(), seq: v.number() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("workshopRestoreSnapshots")
      .withIndex("by_batch", (q) =>
        q.eq("batch", args.batch).eq("seq", args.seq),
      )
      .unique();
    return row?.payload ?? null;
  },
});

/**
 * Retira una foto inservible y deja la traza en la misma mutación: o quedan las
 * dos cosas —foto fuera y descarte auditado— o no queda ninguna.
 */
export const discardSnapshot = internalMutation({
  args: {
    userId: v.id("users"),
    batch: v.string(),
    savedBy: v.id("users"),
    reason: v.string(),
    chunkCount: v.optional(v.number()),
    checksum: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<number> => {
    await assertAdminUser(ctx, args.userId);
    const rows = await ctx.db
      .query("workshopRestoreSnapshots")
      .withIndex("by_batch", (q) => q.eq("batch", args.batch))
      .collect();
    for (const row of rows) await ctx.db.delete(row._id);
    const saved = await ctx.db.get(args.savedBy);
    await logSecurityEvent(ctx, {
      actorId: args.userId,
      action: "workshop_backup_discard",
      target: "system:backup",
      metadata: {
        reason: args.reason,
        snapshotSavedBy: args.savedBy,
        snapshotSavedByEmail: saved?.email ?? null,
        snapshotChunks: args.chunkCount ?? null,
        snapshotChecksum: args.checksum ?? null,
      },
    });
    return rows.length;
  },
});

/** Retira la foto cuando ya no hace falta (restauración hecha o recuperada). */
export const clearSnapshot = internalMutation({
  args: { userId: v.id("users"), batch: v.string() },
  handler: async (ctx, args) => {
    await assertAdminUser(ctx, args.userId);
    const rows = await ctx.db
      .query("workshopRestoreSnapshots")
      .withIndex("by_batch", (q) => q.eq("batch", args.batch))
      .collect();
    for (const row of rows) await ctx.db.delete(row._id);
    return rows.length;
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

/**
 * Deja constancia de una restauración recuperada: quién la ejecutó y quién
 * había guardado la foto, que desaparece al retirarla. Así la traza del dueño
 * de la foto sobrevive a la recuperación.
 */
export const logRecovery = internalMutation({
  args: {
    userId: v.id("users"),
    savedBy: v.id("users"),
    totalRecords: v.number(),
    /** `true` si la copia ya estaba puesta y solo se retiró la foto. */
    applied: v.boolean(),
  },
  handler: async (ctx, args) => {
    await assertAdminUser(ctx, args.userId);
    const saved = await ctx.db.get(args.savedBy);
    await logSecurityEvent(ctx, {
      actorId: args.userId,
      action: "workshop_backup_recover",
      target: "system:backup",
      metadata: {
        totalRecords: args.totalRecords,
        snapshotSavedBy: args.savedBy,
        snapshotSavedByEmail: saved?.email ?? null,
        snapshotApplied: args.applied,
      },
    });
  },
});

/** Filas por mutación: mismo tamaño para comprobar y para escribir. */
const BACKUP_CHUNK_SIZE = 40;

type BatchArgs = {
  userId: Id<"users">;
  table: BackupTableName;
  rowsJson: string;
  idMapJson: string;
};

/**
 * Pasa un lote por la comprobación previa y devuelve su remapeo. La
 * comprobación siempre se deshace lanzando el remapeo: si lo que llega no es
 * eso, el esquema rechaza la copia y se avisa sin haber borrado nada.
 */
async function checkBackupBatch(
  ctx: ActionCtx,
  args: BatchArgs,
): Promise<InsertedPairs> {
  try {
    await ctx.runMutation(internal.workshopBackup.checkTableBatch, args);
  } catch (error) {
    const data =
      error instanceof ConvexError ? (error.data as { pairs?: unknown }) : null;
    if (Array.isArray(data?.pairs)) return data.pairs as InsertedPairs;
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
 * Recorre unas tablas —las de una copia o las del estado guardado— en el orden
 * topológico, lote a lote, y acumula el remapeo entre lotes. Devuelve las filas
 * que el lote correspondiente dice haber escrito.
 */
async function walkChunks(
  userId: Id<"users">,
  tables: WorkshopBackupPayload["tables"],
  run: (args: BatchArgs) => Promise<InsertedPairs>,
  onChunk?: () => Promise<void>,
): Promise<number> {
  const idMap = new Map<string, string>();
  let written = 0;

  for (const table of BACKUP_TABLES) {
    const rows = tables[table];
    if (!rows || rows.length === 0) continue;

    for (let i = 0; i < rows.length; i += BACKUP_CHUNK_SIZE) {
      await onChunk?.();
      const pairs = await run({
        userId,
        table,
        rowsJson: JSON.stringify(rows.slice(i, i + BACKUP_CHUNK_SIZE)),
        idMapJson: JSON.stringify(Array.from(idMap.entries())),
      });
      for (const pair of pairs) idMap.set(pair.oldId, pair.newId);
      // Solo cuentan las filas que de verdad volvieron: una copia de correo
      // omitida por no encontrar su ficha no es un registro restaurado.
      written += pairs.length;
    }
  }

  return written;
}

/**
 * Recorre la copia: en modo `check` cada lote se inserta y se revierte; en modo
 * `restore` se escribe de verdad. Devuelve las filas que quedaron escritas.
 */
async function walkBackup(
  ctx: ActionCtx,
  userId: Id<"users">,
  tables: WorkshopBackupPayload["tables"],
  mode: "check" | "restore",
  onChunk?: () => Promise<void>,
): Promise<number> {
  return await walkChunks(
    userId,
    tables,
    (args) =>
      mode === "check"
        ? checkBackupBatch(ctx, args)
        : ctx.runMutation(internal.workshopBackup.insertTableBatch, args),
    onChunk,
  );
}

type PendingSnapshot = {
  batch: string;
  savedBy: Id<"users">;
  savedAt: number;
  aliveAt: number;
  complete: boolean;
  chunkCount: number;
  checksum: string | null;
  applied: boolean;
  appliedRecords: number;
};

/**
 * Latido de una foto en juego. Se manda como mucho cada
 * `SNAPSHOT_HEARTBEAT_MS`: mientras llega, la acción sigue viva; si la acción
 * muere, deja de llegar y la recuperación sabe que puede actuar.
 */
function snapshotHeartbeat(
  ctx: ActionCtx,
  userId: Id<"users">,
  batch: string,
  leaseToken: string,
): () => Promise<void> {
  let last = Date.now();
  return async () => {
    if (Date.now() - last < SNAPSHOT_HEARTBEAT_MS) return;
    last = Date.now();
    // La foto y la reserva de mantenimiento laten juntas: si la acción muere,
    // las dos caducan y el taller vuelve a admitir operaciones y escrituras. La
    // reserva va primero: si ya no es nuestra, no se refresca la foto y la
    // recuperación no espera de más.
    await ctx.runMutation(internal.workshopMaintenance.renewMaintenanceLease, {
      userId,
      kind: "restore",
      token: leaseToken,
    });
    await ctx.runMutation(internal.workshopBackup.touchRestoreSnapshot, {
      userId,
      batch,
    });
  };
}

/** Vacía las tablas restaurables sin tocar `securityAuditLog` ni `users`. */
async function clearWorkshop(
  ctx: ActionCtx,
  userId: Id<"users">,
  beat?: () => Promise<void>,
): Promise<void> {
  for (let pass = 0; pass < MAX_CLEAR_PASSES; pass++) {
    await beat?.();
    const deleted = await ctx.runMutation(internal.workshopBackup.clearBatch, {
      userId,
    });
    if (deleted === 0) break;
  }
}

/**
 * Vuelve a dejar el taller como estaba con un estado guardado. Es la red de
 * seguridad si la inserción de la copia se corta a mitad: retira lo que se
 * hubiera alcanzado a escribir y reescribe el estado anterior, también en el
 * orden topológico. Si el estado venía de la base, retira además su foto.
 */
async function applySnapshot(
  ctx: ActionCtx,
  userId: Id<"users">,
  tables: WorkshopBackupPayload["tables"],
  batch: string | undefined,
  leaseToken: string,
): Promise<number> {
  const beat =
    batch === undefined
      ? undefined
      : snapshotHeartbeat(ctx, userId, batch, leaseToken);
  await clearWorkshop(ctx, userId, beat);
  const written = await walkChunks(
    userId,
    tables,
    (args) =>
      ctx.runMutation(internal.workshopBackup.insertSnapshotBatch, args),
    beat,
  );
  if (batch !== undefined) {
    await ctx.runMutation(internal.workshopBackup.clearSnapshot, {
      userId,
      batch,
    });
  }
  return written;
}

/**
 * Trocea la foto del taller en documentos por debajo del límite de Convex. La
 * suite baja el tamaño para probar una foto de varios trozos sin sembrar un
 * taller enorme; en producción manda la constante.
 */
function snapshotChunks(raw: string): string[] {
  const size = backupFaults.snapshotChunkChars ?? SNAPSHOT_CHUNK_CHARS;
  const chunks: string[] = [];
  for (let i = 0; i < raw.length; i += size) {
    chunks.push(raw.slice(i, i + size));
  }
  return chunks;
}

/** Nombre de una foto nueva; la reserva de mantenimiento usa el mismo. */
function newSnapshotBatch(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Guarda la foto del taller en la base. */
async function saveSnapshot(
  ctx: ActionCtx,
  userId: Id<"users">,
  tables: WorkshopBackupPayload["tables"],
  batch: string,
  leaseToken: string,
): Promise<void> {
  const savedAt = Date.now();
  const beat = snapshotHeartbeat(ctx, userId, batch, leaseToken);
  const raw = JSON.stringify({ tables });
  const chunks = snapshotChunks(raw);
  const checksum = await sha256Hex(raw);
  try {
    for (const [seq, payload] of chunks.entries()) {
      await ctx.runMutation(internal.workshopBackup.saveSnapshotChunk, {
        userId,
        batch,
        seq,
        payload,
        savedAt,
      });
      await beat();
    }
    // Sin este sello la foto no está entera: si la acción muere a mitad de la
    // escritura, la recuperación la descarta en vez de intentar leerla. Si no
    // se puede sellar, no se empieza a vaciar sin red.
    const sealed = await ctx.runMutation(internal.workshopBackup.sealSnapshot, {
      userId,
      batch,
      chunkCount: chunks.length,
      checksum,
    });
    if (!sealed) {
      throw new ConvexError(
        "La foto del taller no se pudo sellar; no se ha restaurado nada.",
      );
    }
  } catch (error) {
    // Una foto a medio escribir no sirve para recuperar y bloquearía la
    // siguiente restauración: se retira antes de dejar que suba el fallo. El
    // taller sigue intacto porque todavía no se ha vaciado nada.
    try {
      await ctx.runMutation(internal.workshopBackup.clearSnapshot, {
        userId,
        batch,
      });
    } catch {
      // Si tampoco se puede retirar, el fallo original manda.
    }
    throw error;
  }
}

/**
 * Reconstruye las tablas de una foto guardada, pero solo si cuadra con la
 * cabecera: número de trozos esperado, tamaño acotado y suma de verificación.
 * Un fallo esperable se marca como `UnusableSnapshotError` para que la foto se
 * descarte con traza en vez de dejar el taller bloqueado.
 */
async function loadSnapshot(
  ctx: ActionCtx,
  pending: PendingSnapshot,
): Promise<WorkshopBackupPayload["tables"]> {
  if (pending.chunkCount === 0 && pending.checksum === null) {
    throw new UnusableSnapshotError(
      "La foto no guarda su cabecera de integridad.",
    );
  }
  if (
    !Number.isInteger(pending.chunkCount) ||
    pending.chunkCount < 1 ||
    pending.chunkCount > MAX_SNAPSHOT_CHUNKS
  ) {
    throw new UnusableSnapshotError(
      "La foto declara un número de trozos fuera de los límites.",
    );
  }
  if (pending.checksum === null) {
    throw new UnusableSnapshotError(
      "La foto no guarda su suma de verificación.",
    );
  }

  const chunks: string[] = [];
  let totalChars = 0;
  for (let seq = 0; seq < pending.chunkCount; seq += 1) {
    const payload = await ctx.runQuery(
      internal.workshopBackup.readSnapshotChunk,
      { batch: pending.batch, seq },
    );
    if (payload === null) {
      throw new UnusableSnapshotError(
        `Falta el trozo ${seq + 1} de ${pending.chunkCount}.`,
      );
    }
    totalChars += payload.length;
    if (totalChars > MAX_SNAPSHOT_CHARS) {
      throw new UnusableSnapshotError(
        "La foto supera el tamaño máximo que se puede leer.",
      );
    }
    chunks.push(payload);
  }
  const raw = chunks.join("");
  if ((await sha256Hex(raw)) !== pending.checksum) {
    throw new UnusableSnapshotError(
      "La foto no coincide con su suma de verificación.",
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new UnusableSnapshotError("La foto no contiene un JSON válido.");
  }
  if (
    parsed === null ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    typeof (parsed as { tables?: unknown }).tables !== "object" ||
    (parsed as { tables?: unknown }).tables === null
  ) {
    throw new UnusableSnapshotError(
      "La foto no tiene una tabla de datos válida.",
    );
  }
  return (parsed as { tables: WorkshopBackupPayload["tables"] }).tables;
}

/**
 * Resuelve una foto pendiente que ya no late: el latido se comprueba antes, en
 * quien llama, y mientras llega la restauración sigue viva y no se toca. Sin
 * latido hay tres estados:
 * - la foto no está sellada: la acción murió escribiéndola y el taller no llegó
 *   a vaciarse; se retira sin tocar nada.
 * - la foto está aplicada (`appliedAt`): la copia ya está entera; se retira sin
 *   deshacer una restauración terminada.
 * - la foto está completa pero no aplicada: la copia se cortó a mitad; se
 *   reescribe el estado anterior.
 * En los dos últimos casos queda la traza de quién guardó la foto. Devuelve si
 * hubo que reescribir el estado anterior, que es lo que distingue `recovered`.
 */
async function resolvePendingSnapshot(
  ctx: ActionCtx,
  userId: Id<"users">,
  pending: PendingSnapshot,
  leaseToken: string,
): Promise<boolean> {
  if (!pending.complete) {
    await ctx.runMutation(internal.workshopBackup.discardSnapshot, {
      userId,
      batch: pending.batch,
      savedBy: pending.savedBy,
      reason: "La foto quedó sin sellar antes de vaciar el taller.",
      chunkCount: pending.chunkCount,
      checksum: pending.checksum ?? undefined,
    });
    return false;
  }
  if (pending.applied) {
    await ctx.runMutation(internal.workshopBackup.clearSnapshot, {
      userId,
      batch: pending.batch,
    });
    await ctx.runMutation(internal.workshopBackup.logRecovery, {
      userId,
      savedBy: pending.savedBy,
      totalRecords: pending.appliedRecords,
      applied: true,
    });
    return false;
  }

  let tables: WorkshopBackupPayload["tables"];
  try {
    tables = await loadSnapshot(ctx, pending);
  } catch (error) {
    if (!(error instanceof UnusableSnapshotError)) throw error;
    await ctx.runMutation(internal.workshopBackup.discardSnapshot, {
      userId,
      batch: pending.batch,
      savedBy: pending.savedBy,
      reason: error.message,
      chunkCount: pending.chunkCount,
      checksum: pending.checksum ?? undefined,
    });
    return false;
  }

  const restored = await applySnapshot(
    ctx,
    userId,
    tables,
    pending.batch,
    leaseToken,
  );
  await ctx.runMutation(internal.workshopBackup.logRecovery, {
    userId,
    savedBy: pending.savedBy,
    totalRecords: restored,
    applied: false,
  });
  return true;
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
 * esquema rechaza detiene la restauración con el taller todavía intacto. Antes
 * de vaciar guarda el estado actual en la base, en trozos: si la inserción se
 * corta a mitad —incluso si la acción muere y no llega a ver el fallo—, la
 * pasada de recuperación o la siguiente restauración reescriben ese estado y el
 * taller deja de estar a medias.
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

    // 0. Tomar la reserva de mantenimiento antes de tocar nada. Sin ella, un
    //    vaciado o otra restauración podrían entrar entre la comprobación y la
    //    foto; mientras esté viva, `secureMutation` rechaza las escrituras del
    //    taller. Se suelta al terminar —también si algo falla—; si la acción
    //    muere, caduca sola.
    const batch = newSnapshotBatch();
    const leaseToken = await ctx.runMutation(
      internal.workshopMaintenance.acquireMaintenanceLease,
      { userId, kind: "restore" as const, batch },
    );
    const maintenance = { userId, kind: "restore" as const, token: leaseToken };
    try {
      // 1. Si la restauración anterior se quedó a medias, su foto seguirá en la
      //    base: se devuelve el taller a como estaba antes de empezar otra. El
      //    latido distingue una acción viva —que no se toca— de una muerta; una
      //    foto sin sellar es de una escritura cortada y se descarta.
      const pending = await ctx.runQuery(
        internal.workshopBackup.pendingRestoreSnapshot,
        {},
      );
      if (pending !== null) {
        if (Date.now() - pending.aliveAt < SNAPSHOT_STALE_MS) {
          throw new ConvexError(
            "Hay una restauración en marcha. Espera a que termine antes de lanzar otra.",
          );
        }
        // Sin latido: la foto es de una acción muerta. `resolvePendingSnapshot`
        // distingue si está sin sellar, aplicada o cortada a mitad.
        await resolvePendingSnapshot(ctx, userId, pending, leaseToken);
      }

      // 2. Comprobar la copia entera antes de vaciar nada: recorre el mismo camino
      //    de inserción, pero cada lote se revierte. Una fila que el esquema
      //    rechaza se descubre aquí, con el taller todavía intacto, y no a mitad
      //    del vaciado.
      await walkBackup(ctx, userId, parsed.backup.tables, "check");

      // 3. Guardar en la base el estado actual, en trozos, antes de vaciar. Si el
      //    backend muere a mitad —no solo si la acción llega a ver el fallo—, esta
      //    foto es lo que permite devolver el taller a como estaba: la recoge la
      //    pasada de recuperación o la siguiente restauración. Va después de la
      //    comprobación, que no escribe nada.
      const snapshot = await ctx.runQuery(
        internal.workshopBackup.collectAllTables,
        { userId, raw: true },
      );
      await saveSnapshot(ctx, userId, snapshot.tables, batch, leaseToken);
      const beat = snapshotHeartbeat(ctx, userId, batch, leaseToken);

      let restoredRecords: number;
      try {
        // 4. Vaciar e insertar en orden topológico remapeando oldId -> newId,
        //    latiendo entre lote y lote para que la pasada sepa que sigue viva.
        await clearWorkshop(ctx, userId, beat);
        restoredRecords = await walkBackup(
          ctx,
          userId,
          parsed.backup.tables,
          "restore",
          beat,
        );
        // La copia está entera: si la acción muere antes de retirar la foto, la
        // recuperación sabrá que no tiene que deshacerla. La marca va en su propia
        // mutación; entre el último lote y ella queda una ventana de una mutación,
        // el precio de no meter la foto en el camino caliente de la inserción.
        await ctx.runMutation(internal.workshopBackup.markSnapshotApplied, {
          userId,
          batch,
          totalRecords: restoredRecords,
        });
      } catch (error) {
        // Pruebas: como si el backend hubiera muerto antes de recuperar.
        if (backupFaults.simulateCrash) throw error;
        const detail = error instanceof Error ? error.message : String(error);
        try {
          await applySnapshot(ctx, userId, snapshot.tables, batch, leaseToken);
        } catch (recoveryError) {
          const recoveryDetail =
            recoveryError instanceof Error
              ? recoveryError.message
              : String(recoveryError);
          throw new ConvexError(
            `La restauración falló a mitad y tampoco se pudo devolver el taller al estado anterior: ${recoveryDetail}. Fallo original: ${detail}`,
          );
        }
        throw new ConvexError(
          `La restauración falló a mitad y se ha devuelto el taller al estado anterior: ${detail}`,
        );
      }

      // Pruebas: como si el backend muriera con la copia entera puesta y la foto
      // todavía sin retirar.
      if (backupFaults.simulateCrashAfterInsert) {
        throw new ConvexError(
          "La restauración se ha cortado después de insertar la copia.",
        );
      }

      // 5. La copia está puesta: la foto ya no hace falta.
      await ctx.runMutation(internal.workshopBackup.clearSnapshot, {
        userId,
        batch,
      });

      await ctx.runMutation(internal.workshopBackup.logAudit, {
        userId,
        kind: "restore",
        totalRecords: restoredRecords,
      });

      return {
        restoredRecords,
        exportedAt: parsed.backup.exportedAt,
      };
    } finally {
      await ctx.runMutation(
        internal.workshopMaintenance.releaseMaintenanceLease,
        maintenance,
      );
    }
  },
});

/**
 * Recupera una restauración que quedó a medias porque su acción murió (el
 * backend se cayó entre el vaciado y el último lote). La lanza el cron cada
 * minuto: si la foto sigue latiendo, no se toca; sin latido, se resuelve según
 * su estado: sin sellar se descarta, aplicada solo se retira y cortada a mitad
 * se revierte al estado anterior.
 */
export const recoverInterruptedRestore = internalAction({
  args: {},
  handler: async (ctx): Promise<{ recovered: boolean }> => {
    const pending = await ctx.runQuery(
      internal.workshopBackup.pendingRestoreSnapshot,
      {},
    );
    if (pending === null || Date.now() - pending.aliveAt < SNAPSHOT_STALE_MS) {
      return { recovered: false };
    }
    // La cuenta que guardó la foto puede haberse desactivado o borrado: la
    // recuperación la ejecuta cualquier administrador activo. `savedBy` se
    // queda en la foto y pasa a la auditoría al retirarla.
    const actor = await ctx.runQuery(
      internal.workshopBackup.resolveSnapshotAdmin,
      { savedBy: pending.savedBy },
    );
    if (actor === null) {
      throw new ConvexError(
        "No hay ningún administrador activo que pueda recuperar la restauración interrumpida.",
      );
    }
    // La recuperación también reescribe el taller: toma la misma reserva y deja
    // las escrituras bloqueadas mientras dura. Si otra operación sigue viva, no
    // la pisa; la siguiente pasada lo intentará.
    let leaseToken: string;
    try {
      leaseToken = await ctx.runMutation(
        internal.workshopMaintenance.acquireMaintenanceLease,
        { userId: actor, kind: "restore" as const, batch: pending.batch },
      );
    } catch (error) {
      if (error instanceof ConvexError) return { recovered: false };
      throw error;
    }
    const maintenance = {
      userId: actor,
      kind: "restore" as const,
      token: leaseToken,
    };
    try {
      return {
        recovered: await resolvePendingSnapshot(
          ctx,
          actor,
          pending,
          leaseToken,
        ),
      };
    } finally {
      await ctx.runMutation(
        internal.workshopMaintenance.releaseMaintenanceLease,
        maintenance,
      );
    }
  },
});
