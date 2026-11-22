/**
 * Dominio puro para exportación y restauración completa de copias de seguridad
 * de Pulso Taller (sin dependencias de React ni Convex).
 */

export const BACKUP_FORMAT = "pulso-taller-backup" as const;
export const BACKUP_VERSION = 3 as const;
/** Copia inicial, sin manifiesto; se migra en memoria al cargarla. */
export const BACKUP_LEGACY_VERSION = 1 as const;
/** Copia con manifiesto y bloque de archivos opcional; se migra en memoria. */
export const BACKUP_PREVIOUS_VERSION = 2 as const;
/** Tiempo durante el que se puede deshacer una restauración terminada. */
export const BACKUP_UNDO_WINDOW_MS = 10 * 60 * 1000;
export const RESTORE_CONFIRM_WORD = "RESTAURAR" as const;

/** Tope de un archivo suelto que viaja dentro de la copia. */
export const MAX_BACKUP_FILE_BYTES = 25 * 1024 * 1024;

/** Tope del conjunto de archivos de una copia, ya sumados en claro. */
export const MAX_BACKUP_FILES_BYTES = 64 * 1024 * 1024;

/** Tope del número de archivos de una copia: un taller no tiene miles de fichas. */
export const MAX_BACKUP_FILES = 10_000;

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
  /** Presentes solo cuando la copia incluye archivos. */
  fileCount?: number;
  fileBytes?: number;
}

/**
 * Un archivo del almacén que la copia lleva dentro. Los bytes van en base64
 * porque el contenedor es JSON; el tamaño es el del archivo en claro, no el de
 * su representación, y sirve para comprobar que no se ha quedado a medias.
 */
export interface BackupFile {
  storageId: string;
  contentType: string;
  size: number;
  data: string;
}

export interface WorkshopBackupPayload {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: number;
  exportedBy: string;
  tables: Partial<Record<BackupTableName, Array<Record<string, unknown>>>>;
  /** Archivos citados por las filas; en una copia antigua no existen. */
  files?: BackupFile[];
  /** Recuentos con los que se generó la copia; la restauración los comprueba. */
  manifest: BackupManifest;
}

export interface BackupSummary {
  exportedAt: number;
  exportedBy: string;
  totalRecords: number;
  tableCounts: Partial<Record<BackupTableName, number>>;
  fileCount?: number;
  fileBytes?: number;
}

/** Cuenta las filas de cada tabla conocida, en el orden canónico del backup. */
export function backupManifest(
  tables: Partial<Record<BackupTableName, Array<Record<string, unknown>>>>,
  files?: readonly BackupFile[],
): BackupManifest {
  const tableCounts: Partial<Record<BackupTableName, number>> = {};
  let totalRecords = 0;
  for (const table of BACKUP_TABLES) {
    const count = tables[table]?.length ?? 0;
    tableCounts[table] = count;
    totalRecords += count;
  }
  if (files === undefined) return { totalRecords, tableCounts };
  return {
    totalRecords,
    tableCounts,
    fileCount: files.length,
    fileBytes: files.reduce((total, file) => total + file.size, 0),
  };
}

const STORAGE_ADDRESS_IN_TEXT = /\/api\/storage\/([A-Za-z0-9_-]+)/g;
const BASE64_RE =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

/**
 * Los archivos del almacén que citan las filas de una copia. Se buscan tanto
 * los ids sueltos —el valor de un `storageId`, o dentro de una nota— como las
 * direcciones `/api/storage/...` que llevan una imagen incrustada. Solo se
 * devuelven los que existen en el almacén: un id histórico que ya no tiene
 * archivo no se puede copiar y se queda como estaba.
 */
export function collectBackupStorageIds(
  tables: Partial<Record<BackupTableName, Array<Record<string, unknown>>>>,
  available: ReadonlySet<string>,
): string[] {
  const found = new Set<string>();

  const visit = (value: unknown): void => {
    if (typeof value === "string") {
      if (available.has(value)) found.add(value);
      for (const match of value.matchAll(STORAGE_ADDRESS_IN_TEXT)) {
        const id = match[1];
        if (id !== undefined && available.has(id)) found.add(id);
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (value !== null && typeof value === "object") {
      for (const item of Object.values(value)) visit(item);
    }
  };

  for (const table of BACKUP_TABLES) {
    for (const row of tables[table] ?? []) visit(row);
  }
  return [...found].sort();
}

function remapStorageString(
  value: string,
  map: ReadonlyMap<string, string>,
): string {
  let next = value;
  for (const [oldId, newId] of map) {
    if (next.includes(oldId)) next = next.split(oldId).join(newId);
  }
  return next;
}

/**
 * Cambia los ids de archivo de una fila restaurada por los del almacén de
 * destino. Recorre el documento entero para que también se actualicen las
 * imágenes incrustadas en una nota o una descripción, no solo los campos que
 * se llaman `storageId`.
 */
export function remapStorageReferences(
  value: unknown,
  map: ReadonlyMap<string, string>,
): unknown {
  if (map.size === 0) return value;
  if (typeof value === "string") return remapStorageString(value, map);
  if (Array.isArray(value)) {
    return value.map((item) => remapStorageReferences(item, map));
  }
  if (value !== null && typeof value === "object") {
    const copy: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      copy[key] = remapStorageReferences(item, map);
    }
    return copy;
  }
  return value;
}

/** Longitud que tendrán los bytes de un base64 ya validado, o `null`. */
function decodedBase64Length(value: string): number | null {
  if (value.length === 0) return 0;
  if (value.length % 4 !== 0 || !BASE64_RE.test(value)) return null;
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return (value.length / 4) * 3 - padding;
}

/** Decodifica los bytes de un archivo de la copia; el parser ya los validó. */
export function decodeBackupFile(data: string): Uint8Array<ArrayBuffer> {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Representa los bytes de un archivo para el bloque `files` de la copia. */
export function encodeBackupFile(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Lee y valida el bloque `files` de una copia. */
function readBackupFiles(
  value: unknown,
):
  | { ok: true; files: BackupFile[]; bytes: number }
  | { ok: false; error: string } {
  if (!Array.isArray(value)) {
    return { ok: false, error: "El bloque `files` de la copia no es válido." };
  }
  if (value.length > MAX_BACKUP_FILES) {
    return { ok: false, error: "La copia declara demasiados archivos." };
  }

  const files: BackupFile[] = [];
  const seen = new Set<string>();
  let bytes = 0;
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return { ok: false, error: "La copia contiene un archivo inválido." };
    }
    const file = entry as Record<string, unknown>;
    if (
      typeof file.storageId !== "string" ||
      file.storageId.length === 0 ||
      typeof file.contentType !== "string" ||
      typeof file.size !== "number" ||
      !Number.isInteger(file.size) ||
      file.size < 0 ||
      file.size > MAX_BACKUP_FILE_BYTES ||
      typeof file.data !== "string"
    ) {
      return { ok: false, error: "La copia contiene un archivo inválido." };
    }
    if (seen.has(file.storageId)) {
      return { ok: false, error: "La copia repite el mismo archivo." };
    }
    const decoded = decodedBase64Length(file.data);
    if (decoded === null || decoded !== file.size) {
      return {
        ok: false,
        error: "Un archivo de la copia no coincide con el tamaño que declara.",
      };
    }
    seen.add(file.storageId);
    bytes += file.size;
    if (bytes > MAX_BACKUP_FILES_BYTES) {
      return {
        ok: false,
        error: "La copia supera el tamaño máximo de archivos.",
      };
    }
    files.push({
      storageId: file.storageId,
      contentType: file.contentType,
      size: file.size,
      data: file.data,
    });
  }
  return { ok: true, files, bytes };
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
  if (
    version !== BACKUP_VERSION &&
    version !== BACKUP_PREVIOUS_VERSION &&
    version !== BACKUP_LEGACY_VERSION
  ) {
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

  let files: BackupFile[] | undefined;
  let fileBytes = 0;
  if (obj.files !== undefined) {
    const read = readBackupFiles(obj.files);
    if (!read.ok) return read;
    files = read.files;
    fileBytes = read.bytes;
  }

  // v2 y v3 traen manifiesto; v1 no lo tenía y se completa al migrarla.
  if (version !== BACKUP_LEGACY_VERSION) {
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
    const declaredFileCount = manifest.fileCount;
    if (
      declaredFileCount !== undefined &&
      (typeof declaredFileCount !== "number" ||
        declaredFileCount !== (files?.length ?? 0))
    ) {
      return {
        ok: false,
        error:
          "El manifiesto declara un número de archivos distinto del que lleva la copia.",
      };
    }
    const declaredFileBytes = manifest.fileBytes;
    if (
      declaredFileBytes !== undefined &&
      (typeof declaredFileBytes !== "number" || declaredFileBytes !== fileBytes)
    ) {
      return {
        ok: false,
        error:
          "El manifiesto declara un tamaño de archivos distinto del que lleva la copia.",
      };
    }
  }

  const exportedAt =
    typeof obj.exportedAt === "number" ? obj.exportedAt : Date.now();
  const exportedBy =
    typeof obj.exportedBy === "string" ? obj.exportedBy : "Desconocido";
  const manifest = backupManifest(cleanTables, files);

  return {
    ok: true,
    backup: {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt,
      exportedBy,
      tables: cleanTables,
      ...(files === undefined ? {} : { files }),
      manifest,
    },
    summary: {
      exportedAt,
      exportedBy,
      totalRecords,
      tableCounts,
      fileCount: files?.length ?? 0,
      fileBytes,
    },
    migratedFrom: version === BACKUP_VERSION ? undefined : version,
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
  storageIdMap: ReadonlyMap<string, string> = new Map(),
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

  // Después de remapear las referencias entre tablas, se cambian los ids de
  // archivo por los del almacén de destino. Recorre todo el documento porque
  // una nota puede llevar una imagen incrustada en su texto.
  return remapStorageReferences(clone, storageIdMap) as Record<string, unknown>;
}
