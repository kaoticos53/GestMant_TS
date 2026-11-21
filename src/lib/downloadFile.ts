/**
 * Descarga un archivo del almacén sin cambiar de página.
 *
 * El atributo `download` de un enlace solo se respeta en el mismo origen. Las
 * URLs de `_storage` viven en la API, así que un `<a download>` cross-origin
 * abre el archivo en la pestaña actual y se lleva por delante la aplicación.
 * Aquí se trae el contenido, se envuelve en un objeto local y se descarga desde
 * el origen de la app. El objeto se revoca en cuanto el navegador lo ha leído.
 */
export async function downloadFileFromUrl(
  url: string,
  fileName: string,
): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`No se pudo descargar el archivo (${response.status}).`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  link.rel = "noopener noreferrer";
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    // El clic solo entrega la URL al gestor de descargas: se libera después.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }
}
