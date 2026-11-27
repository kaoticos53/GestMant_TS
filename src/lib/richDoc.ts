/**
 * Documento de las notas y las descripciones: el texto con formato ya no se
 * guarda como el HTML del editor, sino como estructura —bloques de párrafo,
 * título, lista, cita, imagen y separador, con sus trozos de texto y sus
 * marcas—.
 */

import { richDocToPlainText } from "./richDoc/converters";

export {
  escapeMarkdown,
  richBlockText,
  richDocIsEmpty,
  richDocToHtml,
  richDocToMarkdown,
  richDocToPlainText,
  richDocToStore,
} from "./richDoc/converters";
export { richDocBlocks } from "./richDoc/parser";
export {
  richDocSafeUrl,
  type RichBlock,
  type RichInline,
  type RichMark,
} from "./richDoc/types";

/**
 * Normaliza una nota del historial de estados: si contiene un fragmento RichDoc
 * en JSON (p. ej. `"Trabajo en taller finalizado · [{\"type\":...}]"`), lo
 * convierte a texto plano legible.
 */
export function formatHistoryNote(note?: string): string | undefined {
  if (!note) return undefined;
  const trimmed = note.trim();
  if (!trimmed) return undefined;

  if (trimmed.startsWith("[")) {
    const plain = richDocToPlainText(trimmed).trim();
    return plain || undefined;
  }

  const sep = " · ";
  const sepIndex = trimmed.indexOf(sep);
  if (sepIndex !== -1) {
    const prefix = trimmed.slice(0, sepIndex).trim();
    const suffix = trimmed.slice(sepIndex + sep.length).trim();
    if (suffix.startsWith("[")) {
      const plainSuffix = richDocToPlainText(suffix).trim();
      return plainSuffix ? `${prefix}${sep}${plainSuffix}` : prefix;
    }
  }

  return trimmed;
}
