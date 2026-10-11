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

/** Tamaño máximo por archivo, en bytes. */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** El mismo límite en corto, para el texto que lo explica («10 MB»). */
export const MAX_FILE_SIZE_LABEL = `${Math.round(MAX_FILE_SIZE / (1024 * 1024))} MB`;

/** ¿Se pasa del límite? Se comprueba antes de subir nada. */
export function exceedsFileLimit(file: { size: number }): boolean {
  return file.size > MAX_FILE_SIZE;
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
