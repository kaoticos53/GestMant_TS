/**
 * Paginación de tablas: cuántas filas se ven de una vez, en qué página se está y
 * qué trozo de la lista se pinta.
 *
 * Existe porque una tabla larga obliga a bajar hasta el final para ver el último
 * registro y deja el pie de la tabla —y su recuento— a dos pantallas de la
 * primera fila. Con la lista partida en páginas, la tabla cabe en la pantalla y
 * lo que se enseña se lee de un vistazo.
 *
 * Cuántas filas caben no se elige: se cuentan. El área de la lista tiene un tope
 * de alto y cada fila ocupa lo suyo, así que el tamaño de página sale de dividir
 * uno entre otro; quien mide de verdad —el alto del área, lo que ocupa la
 * cabecera y lo que ocupa una fila— es `hooks/use-rows-that-fit`, que sí toca el
 * navegador. Aquí solo está la cuenta, para poder probarla sin él, como el orden
 * (`lib/tableSort`). Así una pantalla grande enseña de una vez lo que antes
 * había que pedir a mano, y una ventana pequeña no deja media fila cortada por
 * abajo.
 */

/**
 * Las filas que se ven cuando el alto no se puede medir todavía: el área aún sin
 * pintar, o un navegador que no sabe decir cuánto mide. Es el tamaño que había
 * antes de contar, y deja la tabla legible en cuanto hay algo que enseñar.
 */
export const DEFAULT_PAGE_SIZE = 10;

/** De media fila no come nadie: siempre se ve una entera. */
export const MIN_ROWS_FIT = 1;

/**
 * Tope de la cuenta. Nadie ve doscientas filas de golpe —son diez mil píxeles—,
 * pero una medida rota (un alto sin tope, un `max-h` que se pierde) no puede
 * pedirle a la tabla que pinte una lista entera de una vez.
 */
export const MAX_ROWS_FIT = 200;

/**
 * Cuántas filas enteras entran en el alto que hay.
 *
 * `available` es el alto útil del área —ya sin su relleno ni sus bordes—,
 * `header` lo que ocupa la cabecera de la tabla y `row` lo que ocupa una fila.
 * La cuenta baja a la fila entera: media fila cortada por abajo es justo lo que
 * se viene a evitar.
 *
 * Una medida que no sirve —cero, negativa o no numérica: el área sin pintar, un
 * navegador que no resuelve el `calc()` del tope— devuelve `DEFAULT_PAGE_SIZE`.
 */
export function rowsThatFit({
  available,
  header = 0,
  row,
}: {
  /** Alto útil del área, en píxeles. */
  available: number;
  /** Lo que ocupa la cabecera de la tabla, en píxeles. Sin cabecera, cero. */
  header?: number;
  /** Lo que ocupa una fila, en píxeles. */
  row: number;
}): number {
  if (!Number.isFinite(available) || !Number.isFinite(row)) {
    return DEFAULT_PAGE_SIZE;
  }
  if (available <= 0 || row <= 0) return DEFAULT_PAGE_SIZE;
  const occupado = Number.isFinite(header) ? Math.max(0, header) : 0;
  const rows = Math.floor((available - occupado) / row);
  return Math.min(Math.max(rows, MIN_ROWS_FIT), MAX_ROWS_FIT);
}

/** Cuántas páginas salen de esa lista. Siempre hay una: una página vacía. */
export function pageCount(total: number, pageSize: number): number {
  const rows = Math.max(0, Math.trunc(total));
  if (rows === 0) return 1;
  return Math.ceil(rows / Math.max(1, Math.trunc(pageSize)));
}

/**
 * La página que de verdad se puede enseñar: ni la cero ni una que ya no existe
 * —alguien borró filas, o el filtro encogió la lista—. Es la corrección que hace
 * que una tabla no se quede en blanco por estar «en la página 4» de dos.
 */
export function clampPage(
  page: number,
  total: number,
  pageSize: number,
): number {
  if (!Number.isFinite(page)) return 1;
  const pages = pageCount(total, pageSize);
  return Math.min(Math.max(Math.trunc(page), 1), pages);
}

/**
 * La ventana que se pinta: en qué página se está, cuántas hay y qué filas caen
 * dentro, numeradas desde la primera de la lista. `from` y `to` van con números
 * de fila (1 es la primera) porque es lo que se lee en el resumen: «la 11 a la 20
 * de 140». Sin filas, los dos son 0.
 */
export interface PageWindow {
  /** La página que se enseña, ya corregida para que exista. */
  page: number;
  /** Cuántas páginas hay. */
  pages: number;
  /** Cuántas filas caben en cada una. */
  pageSize: number;
  /** Cuántas filas hay en total. */
  total: number;
  /** La primera fila de esta página (desde 1); 0 si no hay filas. */
  from: number;
  /** La última fila de esta página (incluida); 0 si no hay filas. */
  to: number;
}

/** La ventana de una lista, a partir de cuántas filas tiene. */
export function pageWindow(
  total: number,
  page: number,
  pageSize: number,
): PageWindow {
  const rows = Math.max(0, Math.trunc(total));
  const size = Math.max(1, Math.trunc(pageSize));
  const pages = pageCount(rows, size);
  const current = clampPage(page, rows, size);
  if (rows === 0) {
    return { page: 1, pages, pageSize: size, total: 0, from: 0, to: 0 };
  }
  return {
    page: current,
    pages,
    pageSize: size,
    total: rows,
    from: (current - 1) * size + 1,
    to: Math.min(current * size, rows),
  };
}

/**
 * La ventana de la página que se está viendo y el mando para moverse por ella:
 * lo que devuelve el enganche `useTablePagination` y lo que necesita el pie de la
 * tabla para pintarse. Va aquí —y no en el enganche— para que el pie pueda
 * declarar lo que recibe sin depender de React.
 */
export interface Paging extends PageWindow {
  /** Ir a una página concreta (se corrige si no existe). */
  setPage: (page: number) => void;
}

/** La ventana y, además, las filas que le tocan: lo que pinta la tabla. */
export function paginate<T>(
  rows: readonly T[],
  page: number,
  pageSize: number,
): PageWindow & { rows: T[] } {
  const window = pageWindow(rows.length, page, pageSize);
  return {
    ...window,
    rows: window.total === 0 ? [] : rows.slice(window.from - 1, window.to),
  };
}

/** Cómo se llama el elemento de la tabla en singular y en plural. */
export interface PageNouns {
  /** Uno: «repuesto», «equipo», «manual», «usuario». */
  singular: string;
  /** Varios: «repuestos», «equipos», «manuales», «usuarios». */
  plural: string;
}

/** El plural que toca según cuántos haya. */
function nounFor(total: number, nouns: PageNouns): string {
  return total === 1 ? nouns.singular : nouns.plural;
}

/**
 * Lo que dice el pie de la tabla: por dónde va la página y cuánto hay en total.
 * Se escribe una sola vez porque lo leen las cuatro tablas, y así el mismo dato
 * se cuenta igual en todas —«Mostrando 11 a 20 de 140 repuestos»—.
 */
export function pageSummary(
  window: Pick<PageWindow, "from" | "to" | "total">,
  nouns: PageNouns,
): string {
  const { from, to, total } = window;
  if (total === 0) return `Sin ${nouns.plural}`;
  // Una sola fila en la página se dice «el 11», no «11 a 11»: es como se lee.
  if (from === to)
    return `Mostrando el ${from} de ${total} ${nounFor(total, nouns)}`;
  return `Mostrando ${from} a ${to} de ${total} ${nounFor(total, nouns)}`;
}
