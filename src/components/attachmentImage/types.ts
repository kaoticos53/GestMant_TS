/**
 * Tipos para la visualización de imágenes adjuntas en el taller.
 */

/**
 * Las tres formas de enseñar una foto, según dónde caiga:
 * - `cell`: el hueco cuadrado de una rejilla de adjuntos.
 * - `block`: ancho, dentro de un texto (una nota, una descripción).
 * - `row`: la miniatura de una fila de lista.
 */
export type AttachmentLayout = "cell" | "block" | "row";

export interface AttachmentImageProps {
  url: string | null | undefined;
  /** Con qué se identifica la foto: el `alt` y el nombre del aviso. */
  name: string;
  /** Dónde cae la foto: el hueco de una rejilla, un texto o una fila de lista. */
  layout?: AttachmentLayout;
  /** ¿La foto se abre en otra pestaña al pulsarla? */
  link?: boolean;
  /**
   * Las clases del marco —la celda, la miniatura—. Valen para los dos estados,
   * salvo en una fila de lista: allí el aviso no cabe en el marco y se lleva la
   * fila entera.
   */
  frameClassName?: string;
  /** Las clases de la propia foto. */
  imageClassName?: string;
  /**
   * Las dos cosas que hacen falta para juzgar el fallo —la dirección de la API
   * y si la página va por HTTPS—, solo si quien pinta la foto las sabe mejor que
   * el entorno. De normal se dejan sin poner y las mira el propio aviso.
   */
  apiUrl?: string | null;
  pageProtocol?: string | null;
}
