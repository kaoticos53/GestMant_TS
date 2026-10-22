export const CONFIRM_WORD = "VACIAR";

/**
 * Valida si la frase introducida por el usuario coincide con la palabra de confirmación para vaciar el taller.
 */
export function isVaciarConfirmed(phrase: string): boolean {
  return phrase.trim().toUpperCase() === CONFIRM_WORD;
}

/**
 * Compone el mensaje de éxito tras cargar los datos de ejemplo del taller general.
 */
export function formatSeedSummary(
  photosUploaded: number,
  manualsInserted: number,
): string {
  const telling = [
    photosUploaded > 0
      ? `${photosUploaded} fotos del formulario esperando limpieza`
      : null,
    manualsInserted > 0 ? `${manualsInserted} manuales` : null,
  ].filter((part): part is string => part !== null);

  return telling.length > 0
    ? `Datos de ejemplo cargados · ${telling.join(" · ")}`
    : "Datos de ejemplo cargados";
}

/**
 * Compone el mensaje de éxito tras cargar las compras de ejemplo.
 */
export function formatPurchasingSeedSummary(
  purchases: number,
  orders: number,
): string {
  return `Compras de ejemplo · ${purchases} peticiones de compra en ${orders} órdenes`;
}

/**
 * Compone el mensaje de éxito tras vaciar el taller.
 */
export function formatResetSummary(deletedCount: number): string {
  if (deletedCount === 0) {
    return "El taller ya estaba vacío";
  }
  const plural = deletedCount === 1 ? "ficha retirada" : "fichas retiradas";
  return `Taller vacío · ${deletedCount} ${plural}`;
}
