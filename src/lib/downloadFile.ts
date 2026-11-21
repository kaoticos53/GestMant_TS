/**
 * Descarga un archivo del almacén sin cambiar de página.
 *
 * El atributo `download` de un enlace solo se respeta en el mismo origen. Las
 * URLs de `_storage` viven en la API, así que un `<a download>` cross-origin
 * abre el archivo en la pestaña actual y se lleva por delante la aplicación.
 * Aquí se trae el contenido, se envuelve en un objeto local y se descarga desde
 * el origen de la app.
 *
 * Quedan tres trampas más, y las tres acaban con el archivo abierto en la
 * pestaña en lugar de guardado:
 *
 * - El tipo del objeto. WebKit ignora `download` para blobs de un tipo que sabe
 *   pintar (`message/rfc822`, `text/plain`, `application/pdf`) y muestra el
 *   contenido. Se entrega como binario genérico; la extensión del nombre
 *   conserva el formato real.
 * - El nombre. Uno vacío, con barras o con caracteres que Windows no admite
 *   hace que el navegador descarte la descarga.
 * - La revocación. El gestor de descargas lee el objeto después del clic, así
 *   que se libera con margen y no en el acto.
 */

/** Tipo con el que se entrega el archivo al gestor de descargas. */
const DOWNLOAD_TYPE = "application/octet-stream";

/** Caracteres que ningún sistema de archivos del taller acepta tal cual. */
const INVALID_NAME_CHARS = /[\p{Cc}\\/:*?"<>|]/gu;

/** Nombre con el que se guarda el archivo, siempre utilizable. */
export function downloadFileName(rawName: string): string {
  const cleaned = rawName
    .replace(INVALID_NAME_CHARS, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/, "");
  if (cleaned === "" || /^\.+$/.test(cleaned)) return "descarga";
  return cleaned.slice(0, 180);
}

export async function downloadFileFromUrl(
  url: string,
  fileName: string,
): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`No se pudo descargar el archivo (${response.status}).`);
  }

  const received = await response.blob();
  const blob =
    received.type === DOWNLOAD_TYPE
      ? received
      : received.slice(0, received.size, DOWNLOAD_TYPE);
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = downloadFileName(fileName);
  // Si un navegador desobedece `download`, el archivo se abre aparte: la
  // aplicación nunca se sustituye por el contenido descargado.
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  }
}
