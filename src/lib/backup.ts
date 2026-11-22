/**
 * Dominio puro para exportación y restauración completa de copias de seguridad
 * de Pulso Taller (sin dependencias de React ni Convex).
 */

export const BACKUP_FORMAT = "pulso-taller-backup" as const;
export const BACKUP_VERSION = 2 as const;
/** La primera versión que se sabe leer; se migra al formato actual al cargarla. */
export const BACKUP_LEGACY_VERSION = 1 as const;
/** Tiempo durante el que se puede deshacer una restauración terminada. */
export const BACKUP_UNDO_WINDOW_MS = 10 * 60 * 1000;
export const RESTORE_CONFIRM_WORD = "RESTAURAR" as const;

/**
 * Orden topológico de tablas respaldables (padres antes que hijos) para
 * garantizar la reconstrucción de relaciones al remapar `_id` en Convex.
 * Excluye explícitamente `securityAuditLog`, `users` y credenciales cifradas.
 */
export const BACKUP_TABLES = [
  "roles",
  "catalogs",
  "equipmentModels",
  "equipment",
  "spareParts",
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
  "mailShares",
  "stockMovements",
  "equipmentMovements",
  "notifications",
  "messages",
  "referenceCounters",
  "appSettings",
  "publicStats",
  "storageSettings",
  "alertSettings",
  "auditAlertSettings",
  "reportSettings",
  "archiveSettings",
  "weeklyReports",
] as const;

export type BackupTableName = (typeof BACKUP_TABLES)[number];

/* ------------------------------------------------------------------ */
/* Aviso de tamaño en la restauración                                  */
/* ------------------------------------------------------------------ */

/**
 * Ritmo medido de una restauración completa (handover de F8, §8.5): unos 2 ms
 * por fila de la copia, contando la comprobación previa, la inserción y el
 * vaciado de un taller del mismo tamaño. Por debajo de mil filas manda el
 * trabajo fijo y no baja de dos segundos.
 */
export const RESTORE_SECONDS_PER_RECORD = 0.002;

/** A partir de aquí restaurar pasa de ~4 s (medido: 3 465 filas, 4,5 s). */
export const RESTORE_SLOW_RECORDS = 3_000;

/** A partir de aquí pasa de ~11 s (medido: 6 073 filas, 11,5 s). */
export const RESTORE_VERY_SLOW_RECORDS = 6_000;

export type RestoreSizeLevel = "normal" | "slow" | "very-slow";

/**
 * Segundos que se estima que tarda restaurar una copia de `records` filas, con
 * la regla que sale de la tabla de §8.5: `máx(2 s; 2 ms × filas)`, redondeada al
 * segundo. Si el taller tuviera ahora muchos más datos que la copia, el vaciado
 * pesaría más y tardaría algo más de lo que dice.
 */
export function estimateRestoreSeconds(records: number): number {
  return Math.max(2, Math.round(records * RESTORE_SECONDS_PER_RECORD));
}

/** Nivel del aviso de tamaño para una copia de `records` filas. */
export function restoreSizeLevel(records: number): RestoreSizeLevel {
  if (records >= RESTORE_VERY_SLOW_RECORDS) return "very-slow";
  if (records >= RESTORE_SLOW_RECORDS) return "slow";
  return "normal";
}

export interface BackupManifest {
  totalRecords: number;
  tableCounts: Partial<Record<BackupTableName, number>>;
}

export interface WorkshopBackupPayload {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: number;
  exportedBy: string;
  tables: Partial<Record<BackupTableName, Array<Record<string, unknown>>>>;
  /** Recuentos con los que se generó la copia; la restauración los comprueba. */
  manifest: BackupManifest;
}

export interface BackupSummary {
  exportedAt: number;
  exportedBy: string;
  totalRecords: number;
  tableCounts: Partial<Record<BackupTableName, number>>;
}

/** Cuenta las filas de cada tabla conocida, en el orden canónico del backup. */
export function backupManifest(
  tables: Partial<Record<BackupTableName, Array<Record<string, unknown>>>>,
): BackupManifest {
  const tableCounts: Partial<Record<BackupTableName, number>> = {};
  let totalRecords = 0;
  for (const table of BACKUP_TABLES) {
    const count = tables[table]?.length ?? 0;
    tableCounts[table] = count;
    totalRecords += count;
  }
  return { totalRecords, tableCounts };
}

export function parseWorkshopBackup(rawJson: string):
  | {
      ok: true;
      backup: WorkshopBackupPayload;
      summary: BackupSummary;
      /** Presente cuando la copia venía en un formato anterior. */
      migratedFrom?: number;
    }
  | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { ok: false, error: "El archivo no contiene un JSON válido." };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "La estructura raíz de la copia no es válida." };
  }

  const obj = parsed as Record<string, unknown>;
  if (obj.format !== BACKUP_FORMAT) {
    return {
      ok: false,
      error:
        "El archivo no corresponde a una copia de seguridad de Pulso Taller.",
    };
  }
  const version = obj.version;
  if (version !== BACKUP_VERSION && version !== BACKUP_LEGACY_VERSION) {
    return {
      ok: false,
      error: `Versión de copia no soportada (${String(version)}). Actualiza Pulso Taller para poder leerla.`,
    };
  }
  if (
    !obj.tables ||
    typeof obj.tables !== "object" ||
    Array.isArray(obj.tables)
  ) {
    return { ok: false, error: "La copia no contiene el bloque `tables`." };
  }

  const rawTables = obj.tables as Record<string, unknown>;
  const cleanTables: Partial<
    Record<BackupTableName, Array<Record<string, unknown>>>
  > = {};
  const tableCounts: Partial<Record<BackupTableName, number>> = {};
  let totalRecords = 0;

  for (const table of BACKUP_TABLES) {
    const entries = rawTables[table];
    if (entries === undefined) continue;
    if (!Array.isArray(entries)) {
      return {
        ok: false,
        error: `La tabla «${table}» del archivo de copia no es una lista válida.`,
      };
    }
    const rows: Array<Record<string, unknown>> = [];
    for (const row of entries) {
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        return {
          ok: false,
          error: `Se encontró un registro inválido en la tabla «${table}».`,
        };
      }
      rows.push(row as Record<string, unknown>);
    }
    cleanTables[table] = rows;
    tableCounts[table] = rows.length;
    totalRecords += rows.length;
  }

  if (version === BACKUP_VERSION) {
    const declared = obj.manifest;
    if (!declared || typeof declared !== "object" || Array.isArray(declared)) {
      return {
        ok: false,
        error: "La copia no incluye el manifiesto de recuentos.",
      };
    }
    const manifest = declared as Record<string, unknown>;
    const declaredCounts = manifest.tableCounts;
    if (
      !declaredCounts ||
      typeof declaredCounts !== "object" ||
      Array.isArray(declaredCounts)
    ) {
      return {
        ok: false,
        error: "El manifiesto de la copia no contiene los recuentos por tabla.",
      };
    }
    const counts = declaredCounts as Record<string, unknown>;
    for (const table of BACKUP_TABLES) {
      const expected = counts[table];
      if (expected === undefined) continue;
      if (
        typeof expected !== "number" ||
        expected !== (tableCounts[table] ?? 0)
      ) {
        return {
          ok: false,
          error: `El manifiesto declara un recuento distinto para «${table}»; la copia está incompleta o editada.`,
        };
      }
    }
    if (manifest.totalRecords !== totalRecords) {
      return {
        ok: false,
        error:
          "El total de registros del manifiesto no coincide con las tablas de la copia.",
      };
    }
  }

  const exportedAt =
    typeof obj.exportedAt === "number" ? obj.exportedAt : Date.now();
  const exportedBy =
    typeof obj.exportedBy === "string" ? obj.exportedBy : "Desconocido";
  const manifest = backupManifest(cleanTables);

  return {
    ok: true,
    backup: {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt,
      exportedBy,
      tables: cleanTables,
      manifest,
    },
    summary: {
      exportedAt,
      exportedBy,
      totalRecords,
      tableCounts,
    },
    migratedFrom: version === BACKUP_LEGACY_VERSION ? version : undefined,
  };
}

/**
 * Los campos de una copia de correo que viajan en el backup: solo metadatos.
 * No van el extracto, el cuerpo, los adjuntos, el `.eml` ni la identidad del
 * mensaje en el buzón. `destinationId` sí viaja —es una referencia, no
 * contenido— porque la restauración lo necesita para volver a enganchar la
 * copia a su ficha.
 */
const MAIL_SHARE_BACKUP_FIELDS = [
  "_id",
  "destinationType",
  "destinationId",
  "destinationReference",
  "subject",
  "fromName",
  "fromAddress",
  "sentAt",
  "sharedBy",
  "sharedByName",
  "sharedAt",
  "contentPurgedAt",
  "purgeReason",
] as const;

/**
 * Proyecta una copia de correo para el backup: metadatos y nada más.
 *
 * Una copia `original` se exporta ya como resumen restaurado, porque el cuerpo
 * y los archivos no viajan: al volver, la ficha lo indica en vez de fingir que
 * conserva el mensaje entero.
 */
export function backupMailShareRow(
  row: Record<string, unknown>,
): Record<string, unknown> {
  const copy: Record<string, unknown> = {};
  for (const field of MAIL_SHARE_BACKUP_FIELDS) {
    if (row[field] !== undefined) copy[field] = row[field];
  }
  copy.mode = "summary";
  copy.backupRestored = true;
  return copy;
}

/**
 * Proyecta una copia de correo al restaurarla, con el destino ya remapeado.
 *
 * Se vuelve a filtrar aquí aunque el backup salga limpio: un archivo editado a
 * mano no puede colar contenido por la tabla de copias. La marca de restaurada
 * y el modo resumen se fuerzan igual.
 */
export function restoreMailShareRow(
  row: Record<string, unknown>,
  destinationId: string,
): Record<string, unknown> {
  const copy: Record<string, unknown> = {};
  for (const field of MAIL_SHARE_BACKUP_FIELDS) {
    if (field === "_id" || field === "destinationId") continue;
    if (row[field] !== undefined) copy[field] = row[field];
  }
  copy.destinationId = destinationId;
  copy.mode = "summary";
  copy.backupRestored = true;
  return copy;
}

const SINGLE_REF_FIELDS: Record<string, readonly string[]> = {
  equipment: ["modelId"],
  incidents: ["equipmentId"],
  incidentDocuments: ["incidentId"],
  incidentDocumentLog: ["incidentId"],
  partRequests: ["equipmentId", "incidentId"],
  requestDecisions: ["requestId"],
  purchaseRequests: ["partRequestId", "sparePartId"],
  receptions: ["orderId"],
  maintenanceRecords: ["equipmentId", "requestId"],
  manuals: ["modelId", "equipmentId"],
  stockMovements: ["sparePartId"],
  equipmentMovements: ["equipmentId"],
  notifications: ["incidentId"],
};

const ARRAY_REF_FIELDS: Record<string, readonly string[]> = {
  spareParts: ["compatibleWith", "compatibleModels"],
};

/**
 * Limpia `_id` y `_creationTime` del documento exportado y remapea sus claves
 * foráneas conocidas al nuevo `_id` asignado durante la restauración.
 */
export function remapBackupDocument(
  table: BackupTableName,
  doc: Record<string, unknown>,
  idMap: ReadonlyMap<string, string>,
): Record<string, unknown> {
  const clone: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(doc)) {
    if (key === "_id" || key === "_creationTime") continue;
    clone[key] = value;
  }

  // El rastro de un adjunto retirado apunta a un documento que no viaja en la
  // copia y que el esquema exige: se conserva el id histórico —los ids de Convex
  // no se reutilizan, así que sigue apuntando a nada— en vez de borrarlo. Si el
  // documento vuelve, se remapea como cualquier otra referencia.
  if (table === "incidentDocumentLog" && typeof clone.documentId === "string") {
    const mapped = idMap.get(clone.documentId);
    if (mapped !== undefined) clone.documentId = mapped;
  }

  for (const field of SINGLE_REF_FIELDS[table] ?? []) {
    const oldVal = clone[field];
    if (typeof oldVal === "string") {
      const mapped = idMap.get(oldVal);
      if (mapped !== undefined) {
        clone[field] = mapped;
      } else {
        delete clone[field];
      }
    }
  }

  for (const field of ARRAY_REF_FIELDS[table] ?? []) {
    const oldArr = clone[field];
    if (Array.isArray(oldArr)) {
      const nextArr: string[] = [];
      for (const item of oldArr) {
        if (typeof item === "string") {
          const mapped = idMap.get(item);
          if (mapped !== undefined) nextArr.push(mapped);
        }
      }
      clone[field] = nextArr;
    }
  }

  if (table === "partRequests" && Array.isArray(clone.lines)) {
    clone.lines = clone.lines.map((line) => {
      if (!line || typeof line !== "object" || Array.isArray(line)) return line;
      const lineObj = { ...(line as Record<string, unknown>) };
      if (typeof lineObj.sparePartId === "string") {
        const mapped = idMap.get(lineObj.sparePartId);
        if (mapped !== undefined) {
          lineObj.sparePartId = mapped;
        }
      }
      return lineObj;
    });
  }

  if (table === "purchaseOrders" && Array.isArray(clone.lines)) {
    clone.lines = clone.lines.map((line) => {
      if (!line || typeof line !== "object" || Array.isArray(line)) return line;
      const lineObj = { ...(line as Record<string, unknown>) };
      if (typeof lineObj.sparePartId === "string") {
        const mapped = idMap.get(lineObj.sparePartId);
        if (mapped !== undefined) lineObj.sparePartId = mapped;
      }
      if (typeof lineObj.purchaseRequestId === "string") {
        const mapped = idMap.get(lineObj.purchaseRequestId);
        if (mapped !== undefined) lineObj.purchaseRequestId = mapped;
      }
      return lineObj;
    });
  }

  if (table === "receptions" && Array.isArray(clone.lines)) {
    clone.lines = clone.lines.map((line) => {
      if (!line || typeof line !== "object" || Array.isArray(line)) return line;
      const lineObj = { ...(line as Record<string, unknown>) };
      if (typeof lineObj.sparePartId === "string") {
        const mapped = idMap.get(lineObj.sparePartId);
        if (mapped !== undefined) lineObj.sparePartId = mapped;
      }
      if (typeof lineObj.purchaseRequestId === "string") {
        const mapped = idMap.get(lineObj.purchaseRequestId);
        if (mapped !== undefined) lineObj.purchaseRequestId = mapped;
      }
      return lineObj;
    });
  }

  return clone;
}
