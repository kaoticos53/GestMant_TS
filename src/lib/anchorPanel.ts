/**
 * El sitio donde se abre un desplegable que vive en una cabecera: sus medidas,
 * contadas **desde la ventana**.
 *
 * Un desplegable colocado con `absolute` dentro de su contenedor lo recorta
 * cualquier cosa que recorte por encima de él: el panel lateral del menú
 * (`overflow-hidden`), una cabecera pegajosa con scroll, una tarjeta con las
 * esquinas redondeadas. Por eso el panel va en `fixed` y sus coordenadas salen
 * de **medir el botón**, no de dónde esté su contenedor: así se ve entero
 * aunque el botón viva en un panel estrecho.
 *
 * El cálculo vive aquí, fuera de los componentes, porque es lo que comparten la
 * campana de avisos y el icono de mensajes —y lo que se puede probar sin
 * navegador—. Quien lo usa en React es `useAnchoredPanel`.
 */

/** Lo que se mide del botón que abre el panel, en píxeles de ventana. */
export interface AnchorBox {
  /** Borde inferior del botón, desde arriba de la ventana. */
  bottom: number;
  /** Borde derecho del botón, desde la izquierda de la ventana. */
  right: number;
}

/** Lo que mide la ventana donde va a caber el panel. */
export interface AnchorViewport {
  width: number;
  height: number;
}

/** Los números del anclaje, con lo que se puede ajustar. */
export interface AnchorOptions {
  /** Separación entre el botón y el panel. */
  gap?: number;
  /** Margen mínimo con los bordes de la ventana. */
  margin?: number;
  /** Ancho pedido; el panel se encoge si la ventana no da para él. */
  width?: number;
  /** Ancho por debajo del cual no se encoge: más estrecho no se lee. */
  minWidth?: number;
  /** Alto máximo del panel; lo que no quepa, se desplaza dentro. */
  maxHeight?: number;
}

/** El `style` que hay que ponerle al panel, ya resuelto. */
export interface AnchoredPanelStyle {
  position: "fixed";
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

/**
 * Las medidas del panel: pegado al botón por abajo y alineado con su borde
 * derecho, sin salirse de la ventana por ningún lado —el ancho se acota a lo que
 * la ventana da, la altura se recorta cuando el botón está abajo del todo y, si
 * alineado con el botón se saliera por la izquierda (un icono en el centro de
 * una ventana estrecha), se desplaza hacia la derecha hasta el margen: antes
 * desplazado que cortado—. Sin medida del botón —todavía no se ha podido leer—
 * se abre pegado a la esquina de arriba a la derecha: se ve y se puede usar, y
 * en cuanto haya medida se coloca en su sitio.
 */
export function anchoredPanelStyle(
  box: AnchorBox | null,
  viewport: AnchorViewport,
  {
    gap = 8,
    margin = 8,
    width = 320,
    minWidth = 240,
    maxHeight = 384,
  }: AnchorOptions = {},
): AnchoredPanelStyle {
  const bottom = box ? box.bottom : 0;
  const bordeDerecho = box ? box.right : viewport.width;
  const top = bottom + gap;
  const ancho = Math.max(
    minWidth,
    Math.min(width, viewport.width - margin * 2),
  );

  // El panel se cuelga del borde derecho del botón; si así se saliera por la
  // izquierda, se desplaza lo justo para entrar, y nunca se pasa del margen.
  const izquierdaIdeal = bordeDerecho - ancho;
  const izquierdaMaxima = Math.max(margin, viewport.width - margin - ancho);

  return {
    position: "fixed",
    top,
    left: Math.min(Math.max(izquierdaIdeal, margin), izquierdaMaxima),
    width: ancho,
    maxHeight: Math.min(maxHeight, viewport.height - top - margin),
  };
}
