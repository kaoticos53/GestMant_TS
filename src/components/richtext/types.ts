/**
 * Lo que el campo de escritura pide a quien lo usa.
 *
 * Vive aparte del editor para que la puerta (`RichTextEditor`, que lo carga
 * diferido) pueda anunciar la misma forma sin arrastrar TipTap consigo.
 */

/** Por dónde sube la imagen: la sesión del taller o el camino del formulario público. */
export type ImageUploads = "session" | "publicReport";

export type RichTextEditorProps = {
  id?: string;
  /** El documento guardado, o el texto de una nota anterior. */
  value: string;
  /** El documento tal y como se guarda (`""` si la nota se ha quedado vacía). */
  onChange: (doc: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /**
   * Por dónde sube la imagen. Con sesión (por defecto) basta con estar dentro
   * de la aplicación; el formulario público no tiene cuenta, así que usa el
   * camino del reporte, que comprueba el archivo antes de aceptarlo.
   */
  imageUploads?: ImageUploads;
  /**
   * Sin el hueco de escritura de una ficha: para los sitios donde el editor
   * comparte sitio con otras cosas —el compositor de un chat, por ejemplo— y
   * no puede quedarse con media pantalla.
   */
  compact?: boolean;
  /**
   * Si se puede abrir en grande, en un diálogo, para escribir con más sitio.
   * Por defecto sí, salvo en el compositor de un chat (`compact`): ahí el
   * mensaje es corto y el diálogo taparía la conversación que se lee.
   */
  expandable?: boolean;
  className?: string;
};
