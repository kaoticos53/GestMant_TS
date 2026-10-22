/**
 * Determina el texto que muestra el botón de submit en función del estado de envío o subida.
 */
export function getSubmitButtonLabel(
  busy: boolean,
  isUploading: boolean,
): string {
  if (busy) {
    return "Enviando...";
  }
  if (isUploading) {
    return "Subiendo archivos...";
  }
  return "Crear petición";
}

/**
 * Indica si el botón de submit debe deshabilitarse.
 */
export function isSubmitDisabled(busy: boolean, isUploading: boolean): boolean {
  return busy || isUploading;
}

/**
 * Indica si se debe mostrar el icono de flecha hacia la derecha en el botón de submit.
 */
export function shouldShowSubmitIcon(
  busy: boolean,
  isUploading: boolean,
): boolean {
  return !busy && !isUploading;
}
