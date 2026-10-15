import type { Id } from "../convex/_generated/dataModel";
import { compressImageFile } from "./imageCompress";

/**
 * Subida de archivos al almacenamiento de Convex. Un solo sitio para el límite,
 * los tipos aceptados, la compresión de las fotos y la llamada de subida: lo
 * comparten los adjuntos de una petición y los documentos del expediente de una
 * incidencia, que si no acabarían aceptando cosas distintas.
 *
 * El archivo se sube a la URL temporal que da el backend y lo que se guarda
 * después es su `storageId`, no el archivo: el fichero vive en el servidor.
 */

/** Qué se puede adjuntar: fotos y documentos de oficina. */
export const FILE_ACCEPT = "image/*,.pdf,.doc,.docx,.xls,.xlsx";

/** Tamaño máximo por archivo estándar (imágenes, adjuntos), en bytes: 10 MB. */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** El mismo límite en corto, para el texto que lo explica («10 MB»). */
export const MAX_FILE_SIZE_LABEL = `${Math.round(MAX_FILE_SIZE / (1024 * 1024))} MB`;

/** Tamaño máximo permitido para manuales y documentación técnica en PDF: 25 MB. */
export const MAX_MANUAL_FILE_SIZE = 25 * 1024 * 1024;

/** El límite de manuales en texto corto («25 MB»). */
export const MAX_MANUAL_FILE_SIZE_LABEL = `${Math.round(MAX_MANUAL_FILE_SIZE / (1024 * 1024))} MB`;

/** ¿Se pasa del límite estándar? Se comprueba antes de subir nada. */
export function exceedsFileLimit(file: { size: number }): boolean {
  return file.size > MAX_FILE_SIZE;
}

/** ¿Se pasa del límite permitido para manuales técnicos? */
export function exceedsManualLimit(file: { size: number }): boolean {
  return file.size > MAX_MANUAL_FILE_SIZE;
}

/**
 * Extensiones de archivos ejecutables, scripts o vectores polimórficos que están
 * estrictamente prohibidas en cualquier subida para mitigar Remote Code Execution (RCE)
 * o Cross-Site Scripting (XSS) almacenado.
 */
export const DANGEROUS_FILE_EXTENSIONS: ReadonlySet<string> = new Set([
  "exe",
  "bat",
  "cmd",
  "sh",
  "bash",
  "ps1",
  "vbs",
  "js",
  "mjs",
  "cjs",
  "ts",
  "py",
  "php",
  "phtml",
  "php3",
  "php4",
  "php5",
  "pl",
  "cgi",
  "jar",
  "apk",
  "msi",
  "com",
  "scr",
  "hta",
  "ws",
  "wsf",
  "svg",
  "html",
  "htm",
  "xhtml",
]);

/**
 * Detecta si un nombre de archivo incluye extensiones peligrosas o patrones de
 * doble extensión maliciosa (p. ej., `manual.php.pdf`, `informe.exe`).
 */
export function hasDangerousExtension(fileName: string): boolean {
  const clean = fileName.trim().toLowerCase();
  const parts = clean.split(".");
  if (parts.length <= 1) return false;
  // Revisar todas las partes intermedias y la extensión final
  for (let i = 1; i < parts.length; i++) {
    const ext = parts[i]?.trim();
    if (ext && DANGEROUS_FILE_EXTENSIONS.has(ext)) {
      return true;
    }
  }
  return false;
}

/**
 * Comprueba si la cabecera binaria corresponde a un documento PDF válido.
 * Según el estándar ISO 32000-1, los primeros 4 bytes deben ser `%PDF` (0x25, 0x50, 0x44, 0x46).
 */
export function looksLikePdf(head: Uint8Array): boolean {
  if (head.length < 4) return false;
  return (
    head[0] === 0x25 && // '%'
    head[1] === 0x50 && // 'P'
    head[2] === 0x44 && // 'D'
    head[3] === 0x46 // 'F'
  );
}

/**
 * La foto tal y como tiene que subirse: reescalada y recomprimida en el
 * navegador si hace falta, o el archivo tal cual si no hay nada que recomprimir
 * (un PDF, una foto que ya viene ligera).
 *
 * Va antes de mirar el tope a propósito: lo que cuenta para el límite es lo que
 * va a pesar lo que se manda, no lo que pesaba el original —y una foto de móvil
 * pasa de los diez megas sin salir de su resolución de siempre—.
 */
export async function compressForUpload(file: File): Promise<File> {
  return await compressImageFile(file);
}

/**
 * Cuántas imágenes puede llevar una incidencia notificada desde el formulario
 * público: quien no tiene cuenta puede acompañar el aviso con fotos, pero no
 * convertirlo en un álbum.
 */
export const MAX_REPORT_IMAGES = 6;

/**
 * Sube el archivo a la URL temporal del deployment y devuelve su identificador
 * en el almacenamiento. Lanza si el servidor no lo acepta, para que quien llama
 * lo cuente con su propio aviso.
 */
export async function uploadToStorage(
  uploadUrl: string,
  file: File,
): Promise<Id<"_storage">> {
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!response.ok) {
    throw new Error("No se ha podido subir el archivo. Inténtalo de nuevo.");
  }
  const { storageId } = (await response.json()) as { storageId: string };
  return storageId as Id<"_storage">;
}
