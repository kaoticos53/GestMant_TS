import { useVirtualizer } from "@tanstack/react-virtual";

/**
 * Las filas de una tabla larga que de verdad hay que pintar.
 *
 * Una página de tabla puede traer doscientas filas —las que caben en una
 * pantalla grande— y cada una lleva su ficha, sus botones y, en el almacén, su
 * descripción con formato. Pintarlas todas para que el navegador enseñe veinte
 * es trabajo que se paga en cada desplazamiento. Aquí se queda con las que
 * asoman por el área de la lista, más un margen por arriba y por abajo para que
 * el scroll no descubra huecos.
 *
 * El alto de cada fila no se supone: se mide. La tabla entrega la referencia de
 * cada fila pintada (`measureElement`) y el alto real sustituye a la estimación
 * en cuanto el navegador lo dice; así una ficha de repuesto con descripción no
 * descoloca a las de abajo.
 *
 * Por debajo del umbral no se virtualiza nada: unas pocas filas se pintan
 * enteras y el comportamiento es el de siempre, con su tabla accesible al
 * completo. La paginación de las tablas (`useTablePagination`) sigue mandando
 * sobre cuántas filas tiene la página; esto solo decide cuántas de ellas se
 * montan.
 */

/** A partir de cuántas filas de una página compensa virtualizar. */
export const VIRTUALIZE_FROM = 40;

/** El alto con el que se supone una fila hasta que el navegador la mide. */
export const ESTIMATED_ROW_HEIGHT = 72;

/** Filas de más por arriba y por abajo: el colchón del desplazamiento. */
const OVERSCAN = 10;

export interface VirtualRows {
  /** Si se está virtualizando de verdad (hay más filas que el umbral). */
  active: boolean;
  /** Los índices de las filas que se pintan, en el orden de la lista. */
  indices: number[];
  /** El hueco de arriba, en píxeles, para que la primera fila caiga en su sitio. */
  paddingTop: number;
  /** El hueco de abajo, en píxeles. */
  paddingBottom: number;
  /**
   * La referencia que se le pasa a cada fila pintada para que el navegador la
   * mida. La tabla la pone en su `<tr>`; sin ella, todas las filas se suponen
   * iguales.
   */
  measureElement: (node: Element | null) => void;
}

/**
 * El estado de virtualización de una página de tabla.
 *
 * `scrollElement` es la caja que desplaza —la de `ListArea`—, no la tabla: sus
 * medidas son las que deciden qué filas asoman. Mientras no hay caja (el primer
 * pintado), no hay nada que virtualizar y se devuelven todas las filas.
 */
export function useVirtualRows({
  count,
  scrollElement,
}: {
  /** Cuántas filas tiene la página. */
  count: number;
  /** La caja con scroll que las contiene. */
  scrollElement: HTMLElement | null;
}): VirtualRows {
  const active = scrollElement !== null && count > VIRTUALIZE_FROM;

  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => scrollElement,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: OVERSCAN,
    enabled: active,
  });

  if (!active) {
    return {
      active: false,
      indices: Array.from({ length: count }, (_, index) => index),
      paddingTop: 0,
      paddingBottom: 0,
      measureElement: () => {},
    };
  }

  const items = virtualizer.getVirtualItems();
  if (items.length === 0) {
    // Todavía sin medidas: se pintan las primeras filas, que es lo que se ve al
    // abrir la página.
    return {
      active: true,
      indices: Array.from({ length: Math.min(count, OVERSCAN * 2) }, (_, i) => i),
      paddingTop: 0,
      paddingBottom: 0,
      measureElement: virtualizer.measureElement,
    };
  }

  const first = items[0];
  const last = items[items.length - 1];
  return {
    active: true,
    indices: items.map((item) => item.index),
    paddingTop: first.start,
    paddingBottom: Math.max(0, virtualizer.getTotalSize() - last.end),
    measureElement: virtualizer.measureElement,
  };
}
