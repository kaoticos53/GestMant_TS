/**
 * Lo único de la impresión de etiquetas que necesita el navegador: abrir el
 * documento en una ventana y mandarlo a la impresora.
 *
 * El documento lo compone `labelGenerator` —sin navegador—, así que allí se
 * puede probar; aquí solo se le da un sitio donde imprimirse. Se abre como
 * `blob:` y no con `document.write`: el navegador lo trata como un documento
 * propio, el CSS `@page` del rollo se aplica sin heredar el de la aplicación y
 * no se escribe HTML a mano en una ventana viva.
 *
 * `window.print()` se llama cuando el documento ha cargado. Si el navegador
 * bloquea la ventana —un emergente—, devuelve `false` y quien llama avisa en vez
 * de dejar creer que la etiqueta ha salido.
 */
export function printLabelDocument(html: string): boolean {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const opened = window.open(url, "_blank", "width=460,height=680");
  if (opened === null) {
    URL.revokeObjectURL(url);
    return false;
  }

  const send = () => {
    // La ventana puede haberse cerrado entre la apertura y la carga.
    if (opened.closed) {
      URL.revokeObjectURL(url);
      return;
    }
    opened.focus();
    opened.print();
    // El documento ya está cargado en el navegador: el blob se puede soltar.
    URL.revokeObjectURL(url);
  };

  if (opened.document?.readyState === "complete") {
    send();
  } else {
    opened.addEventListener("load", send, { once: true });
  }
  return true;
}
