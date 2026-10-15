/**
 * Documento de las notas y las descripciones: el texto con formato ya no se
 * guarda como el HTML del editor, sino como estructura —bloques de párrafo,
 * título, lista, cita, imagen y separador, con sus trozos de texto y sus
 * marcas—.
 */

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
