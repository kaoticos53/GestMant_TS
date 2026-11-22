/**
 * Dominio puro para exportación y restauración completa de copias de seguridad
 * de Pulso Taller (sin dependencias de React ni Convex).
 */

export const BACKUP_FORMAT = "pulso-taller-backup" as const;
export const BACKUP_VERSION = 1 as const;
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

export interface WorkshopBackupPayload {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: number;
  exportedBy: string;
  tables: Partial<Record<BackupTableName, Array<Record<string, unknown>>>>;
}

export interface BackupSummary {
  exportedAt: number;
  exportedBy: string;
  totalRecords: number;
  tableCounts: Partial<Record<BackupTableName, number>>;
}

export function parseWorkshopBackup(
  rawJson: string,
):
  | { ok: true; backup: WorkshopBackupPayload; summary: BackupSummary }
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
  if (obj.version !== BACKUP_VERSION) {
    return {
      ok: false,
      error: `Versión de copia no soportada (${String(obj.version)}).`,
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

  const exportedAt =
    typeof obj.exportedAt === "number" ? obj.exportedAt : Date.now();
  const exportedBy =
    typeof obj.exportedBy === "string" ? obj.exportedBy : "Desconocido";

  return {
    ok: true,
    backup: {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt,
      exportedBy,
      tables: cleanTables,
    },
    summary: {
      exportedAt,
      exportedBy,
      totalRecords,
      tableCounts,
    },
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
