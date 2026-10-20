import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_PAGE_SIZE, MIN_ROWS_FIT, rowsThatFit } from "@/lib/pagination";

/**
 * Las dos maneras que tiene el panel de repetir un registro: la fila de una
 * tabla y la ficha de una cola. Cada una se mide por lo suyo.
 */
export type RowsShape = "table" | "cards";

/** Qué se mide en cada forma: la unidad que se repite y su cabecera. */
const SELECTORS: Record<RowsShape, { row: string; head: string }> = {
  // Las filas de la tabla: las que se miden para saber lo que ocupan.
  table: { row: "tbody tr", head: "thead" },
  // Y las fichas de una cola, marcadas por la vista: cada ficha lleva
  // `data-row` y el rótulo del grupo —el día, el mes— `data-row-header`.
  cards: { row: "[data-row]", head: "[data-row-header]" },
};

/** Un número de la hoja de estilos —«480px»— en píxeles; sin número, cero. */
function pixels(value: string | null | undefined): number {
  const number = Number.parseFloat(value ?? "");
  return Number.isFinite(number) ? number : 0;
}

/** El borde de abajo de ese elemento; su alto, medido desde el primero de todos. */
function bottomOf(node: Element): number {
  const bottom = node.getBoundingClientRect().bottom;
  return Number.isFinite(bottom) ? bottom : 0;
}

/** Lo que mide de alto ese elemento; cero si no está o aún no se ha pintado. */
function heightOf(node: Element | null): number {
  const height = node?.getBoundingClientRect().height ?? 0;
  return Number.isFinite(height) ? height : 0;
}

/**
 * El alto del que se cuentan las filas: el tope que el área *puede* ocupar —el
 * de su clase, `max-h-[calc(100dvh-18rem)]`, que sale de la ventana—, menos lo
 * que se come ella misma en relleno y bordes.
 *
 * No se usa el alto que ocupa ahora: con pocas filas el área encoge hasta su
 * contenido, y medir eso sería contar lo que ya se ve, que siempre da las
 * mismas. Si el navegador no sabe resolver el `calc()`, queda el alto de ahora.
 */
function availableHeight(area: HTMLElement): number {
  const style = getComputedStyle(area);
  const chrome =
    pixels(style.paddingTop) +
    pixels(style.paddingBottom) +
    pixels(style.borderTopWidth) +
    pixels(style.borderBottomWidth);
  return (pixels(style.maxHeight) || area.clientHeight) - chrome;
}

/**
 * Cuántas filas —o fichas— caben en el área, contadas sobre lo que hay pintado.
 * Devuelve `null` cuando todavía no hay nada que medir —el área sin caja, la
 * lista sin filas—: entonces quien pregunta se queda con lo que ya sabía.
 *
 * Lo que se repite no mide siempre lo mismo —una fila de una línea y otra de
 * dos, una ficha cómoda y una compacta—, así que la cuenta va por partes:
 *
 * - Si lo pintado se pasa del alto, se cuentan las que entran de verdad y se
 *   recorta a esas: ninguna se queda cortada por abajo.
 * - Si entra todo, se cuenta cuántas cabrían con lo que ocupa una por término
 *   medio de las que se están viendo, y esa es la medida.
 *
 * Contar por el borde de abajo de cada una —y no por su alto— es lo que hace
 * que los rótulos de los grupos de una cola («Hoy», «Ayer»…) cuenten lo suyo:
 * van en medio y empujan lo que viene detrás.
 */
function measureFit(
  area: HTMLElement,
  shape: RowsShape,
  available: number,
): number | null {
  if (available <= 0) return null;

  const { row: rowSelector, head: headSelector } = SELECTORS[shape];
  const rows = [...area.querySelectorAll(rowSelector)];
  const first = rows[0];
  if (!first) return null;
  const top = first.getBoundingClientRect().top;
  const header = heightOf(area.querySelector(headSelector));

  let fit = 0;
  for (const row of rows) {
    // El alto acumulado hasta esa fila, contando la cabecera de arriba.
    if (header + (bottomOf(row) - top) <= available) fit++;
  }
  if (fit < rows.length) return Math.max(fit, MIN_ROWS_FIT);

  // Entran todas las que se están pintando: esa es la cuenta mínima. Sin esto,
  // la media de unas pocas filas —que carga con los huecos entre ellas— daba
  // menos de las que de verdad caben, y la lista se quedaba dando vueltas hacia
  // abajo: tres filas, luego dos, y ahí se paraba.
  const average = (bottomOf(rows[rows.length - 1]) - top) / rows.length;
  const byAverage = rowsThatFit({ available, header, row: average });
  return Math.max(byAverage, rows.length);
}

/**
 * Cuántas filas caben en el área de una lista, medido del navegador, y la
 * referencia que hay que ponerle al área para que se pueda medir.
 *
 * El tamaño de página de una lista no se elige: se cuenta. El área tiene un tope
 * de alto y cada fila ocupa lo suyo —lo mismo una fila de tabla que una ficha de
 * una cola—, y esto lo lee de la pantalla para dárselo a `useTablePagination`.
 * La cuenta, sin navegador, está en `lib/pagination` (`rowsThatFit`) y allí se
 * prueba; aquí solo está la medida.
 *
 * La forma se dice con `shape`: `"table"` mide las filas del cuerpo de una
 * tabla y su cabecera; `"cards"` mide las fichas de una cola, señaladas con
 * `data-row`, y el rótulo del grupo con `data-row-header`.
 *
 * Se mide al montar el área —la referencia se rellena cuando el área y sus filas
 * ya están en la página, así que el alto se puede leer, y el ajuste llega antes
 * de que nada se pinte— y cada vez que la pantalla cambia de tamaño. Volver a
 * medir no se desmadra: a la segunda vuelta sale el mismo número y el estado no
 * cambia.
 *
 * Qué cuenta como cambiar de tamaño, y qué no: la ventana (girar el móvil,
 * estirarla, cambiar el zoom: el tope del área sale de ella) y el ancho del
 * propio recuadro —al plegar la barra lateral las columnas se reparten de otra
 * manera y un texto puede pasar de una línea a dos—. Lo que **no** cuenta es el
 * alto que ocupa lo que hay dentro: son las filas que se están pintando, y si
 * cada página midiera distinto la lista iría cambiando de tamaño de página al
 * pasar de una a otra, con la numeración moviéndose por debajo. Para los pocos
 * cambios que sí vuelven a medir a propósito —la vista compacta de una cola,
 * que encoge cada ficha sin que la pantalla cambie— está `remeasureKey`.
 *
 * El alto de la página entera tampoco cuenta, y por eso el aviso del documento
 * se mira con cuidado: cambia solo porque la página acaba de cambiar de tamaño,
 * que es justo lo que se acaba de decidir aquí. Sin ese cuidado, una cola de
 * fichas —donde una ficha con foto no mide lo que una sin ella— se pasa la vida
 * midiéndose: una página cabe por poco, la siguiente no, y la lista salta de
 * página sola. Solo se vuelve a contar por ahí si de verdad cambia el alto del
 * que se cuenta, que es el tope del área.
 */
export function useRowsThatFit({
  shape = "table",
  remeasureKey,
}: {
  /** Qué se repite dentro: las filas de una tabla o las fichas de una cola. */
  shape?: RowsShape;
  /** Lo que, al cambiar, vuelve a medir sin que cambie la pantalla. */
  remeasureKey?: unknown;
} = {}): {
  /** La referencia que va en el área: `<ListArea ref={areaRef}>`. */
  areaRef: (element: HTMLDivElement | null) => void;
  /** Las filas que caben dentro. */
  rowsFit: number;
} {
  const [rowsFit, setRowsFit] = useState(DEFAULT_PAGE_SIZE);
  const area = useRef<HTMLDivElement | null>(null);
  const width = useRef(0);
  const watching = useRef<ResizeObserver | null>(null);
  // El alto del que se contó la última vez: lo que deja saber si el aviso del
  // documento trae un cambio de verdad o es la página que acaba de encogerse.
  const counted = useRef<number | null>(null);
  // La medida siempre mira la forma que se está pintando: el cierre de la
  // referencia y el de los observadores se quedan con la última.
  const measure = useCallback(
    ({ ifSpaceChanged = false }: { ifSpaceChanged?: boolean } = {}) => {
      const node = area.current;
      if (!node) return;
      const available = availableHeight(node);
      if (
        ifSpaceChanged &&
        counted.current !== null &&
        Math.abs(available - counted.current) < 1
      ) {
        return;
      }
      const fit = measureFit(node, shape, available);
      if (fit === null) return;
      counted.current = available;
      // Solo se pinta otra vez si el número cambió: medir no puede ser una rueda.
      setRowsFit((previous) => (previous === fit ? previous : fit));
    },
    [shape],
  );

  // La remedida a propósito: el cambio ya está pintado cuando esto corre.
  useEffect(() => {
    measure();
  }, [measure, remeasureKey]);

  const areaRef = useCallback(
    (element: HTMLDivElement | null) => {
      area.current = element;
      // El área es una sola, así que el que mira se cambia con ella: si se va
      // —cambiar de módulo, un filtro que la retira—, deja de mirarse.
      watching.current?.disconnect();
      watching.current = null;
      if (!element) return;
      if (typeof ResizeObserver !== "undefined") {
        width.current = element.offsetWidth || element.clientWidth;
        watching.current = new ResizeObserver(() => {
          // Solo el ancho exterior (offsetWidth / bounding box): el ancho interior
          // (clientWidth) encoge al aparecer la barra de desplazamiento vertical, lo
          // que provocaría un bucle infinito de oscilación si una fila altera el scroll.
          const currentWidth = element.offsetWidth || element.clientWidth;
          if (currentWidth === width.current) return;
          width.current = currentWidth;
          measure();
        });
        watching.current.observe(element);
      }
      measure();
    },
    [measure],
  );

  useEffect(() => {
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => measure({ ifSpaceChanged: true }));
      // El alto del documento sigue al de la ventana —y al de la barra de
      // direcciones del móvil—, que es de donde sale el tope del área.
      observer.observe(document.documentElement);
    }
    // Aviso aparte por si el cambio de ventana no toca el tamaño del documento,
    // que es justo el caso en el que el observador se queda callado.
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", onResize);
      watching.current?.disconnect();
      watching.current = null;
    };
  }, [measure]);

  return { areaRef, rowsFit };
}
