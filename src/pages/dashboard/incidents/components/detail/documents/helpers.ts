import { MAX_FILE_SIZE_LABEL } from "@/lib/upload";

/**
 * Título de la modal según si se está editando o creando un nuevo documento.
 */
export function getDocumentDialogTitle(isEditing: boolean): string {
  return isEditing ? "Corregir documento" : "Adjuntar documento";
}

/**
 * Descripción explicativa del modal según modo y referencia de la incidencia.
 */
export function getDocumentDialogDescription(
  isEditing: boolean,
  reference: string,
): string {
  return isEditing
    ? `Corriges los datos del documento de ${reference}. Puedes cambiarle el nombre o la nota, y también sustituir el archivo.`
    : `Añade un documento al expediente de ${reference}.`;
}

/**
 * Texto de ayuda contextual sobre formatos y tamaños permitidos.
 */
export function getDocumentFileHelperText(isEditing: boolean): string {
  return isEditing
    ? `Imágenes, PDF o documentos de oficina, máximo ${MAX_FILE_SIZE_LABEL}. Al guardar, el archivo anterior se borra del servidor y el cambio queda firmado en el rastro.`
    : `Imágenes, PDF o documentos de oficina. Máximo ${MAX_FILE_SIZE_LABEL} por archivo; el archivo se sube y queda guardado con el expediente.`;
}

/**
 * Texto del botón principal de guardado según estado de carga y modo.
 */
export function getDocumentSubmitLabel(
  savingDoc: boolean,
  hasFile: boolean,
  isEditing: boolean,
): string {
  if (savingDoc) {
    return hasFile ? "Subiendo..." : "Guardando...";
  }
  return isEditing ? "Guardar cambios" : "Adjuntar";
}
