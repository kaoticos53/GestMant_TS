/**
 * Ordenación de tablas: por qué columna se ordena, en qué sentido y cómo se
 * vuelve al orden de siempre. Vive fuera de los componentes para poder probarla
 * sin navegador, como el resto de herramientas de lista (`lib/browse`).
 *
 * El orden lo elige quien mira, no el servidor: las tablas llegan ya ordenadas
 * por su criterio —el catálogo por nombre, los equipos por modelo—, y aquí solo
 * se reordena lo que se está viendo. Sin columna elegida, los registros quedan
 * exactamente como llegaron.
 *
 * Y se recuerda: el orden de cada tabla se guarda por persona y se vuelve a
 * aplicar en su siguiente visita —mirar el catálogo por stock bajo no es cosa de
 * un rato, es como trabaja—. La lectura desconfía de lo guardado (la lista de
 * columnas cambia con el tiempo), así que un orden que ya no vale se descarta y
 * la tabla se queda como llega.
 *
 * Aquí vive también el selector de orden: el mismo ciclo que la cabecera, pero
 * eligiendo de una lista con todas las columnas. Existe porque la tabla esconde
 * columnas en pantallas estrechas y una cabecera que no se ve no se puede pulsar.
 */

import { normalizeText } from "./browse";

/** Los dos sentidos: de menor a mayor y de mayor a menor. */
export type SortDirection = "asc" | "desc";

/** Qué columna manda, y en qué sentido. */
export interface TableSort<Column extends string = string> {
  column: Column;
  direction: SortDirection;
}

/** Lo que una celda aporta al orden: texto, número o nada si está vacía. */
export type SortValue = string | number | null | undefined;

/**
 * El ciclo de una cabecera: la primera pulsación ordena de menor a mayor, la
 * segunda invierte el sentido y la tercera devuelve la tabla al orden de
 * siempre. Cambiar de columna empieza siempre de menor a mayor.
 */
export function nextTableSort<Column extends string>(
  current: TableSort<Column> | null,
  column: Column,
): TableSort<Column> | null {
  if (current === null || current.column !== column) {
    return { column, direction: "asc" };
  }
  return current.direction === "asc" ? { column, direction: "desc" } : null;
}

/**
 * El sentido en palabras. Se escribe una sola vez porque lo leen dos sitios: el
 * aviso de la tabla y el botón que invierte el sentido.
 */
export function directionLabel(direction: SortDirection): string {
  return direction === "asc" ? "de menor a mayor" : "de mayor a menor";
}

/**
 * El sentido contrario. Es lo que hace el botón de invertir: pulsarlo cambia de
 * menor a mayor a mayor a menor y al revés, sin columna elegida no hay nada que
 * invertir.
 */
export function flipTableSort<Column extends string>(
  sort: TableSort<Column> | null,
): TableSort<Column> | null {
  if (sort === null) return null;
  return {
    column: sort.column,
    direction: sort.direction === "asc" ? "desc" : "asc",
  };
}

/** ¿Esa celda está sin rellenar? El texto en blanco también cuenta. */
function isEmptyValue(value: SortValue): boolean {
  return value === null || value === undefined || value === "";
}

/**
 * Compara dos celdas: los números como números —para que 9 vaya antes que 10— y
 * el texto sin acentos ni mayúsculas, con los dígitos leídos como números, que
 * es lo que ordena bien «EQ-2» antes que «EQ-10».
 */
export function compareSortValues(a: SortValue, b: SortValue): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return normalizeText(String(a ?? "")).localeCompare(
    normalizeText(String(b ?? "")),
    "es",
    { numeric: true },
  );
}

/* ------------------------------------------------------------------ */
/* Recordar el orden de cada tabla                                     */
/* ------------------------------------------------------------------ */

/** Dónde se recuerda el orden (mismo prefijo que el resto de la interfaz). */
export const TABLE_SORT_STORAGE_PREFIX = "pulso:table-sort";

/** Tipo mínimo de almacenamiento: sirve `localStorage` y un doble en los tests. */
export interface SortStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * La clave con la que se recuerda el orden de una tabla para una persona:
 * `pulso:table-sort:<tabla>:<persona>`.
 *
 * Lleva la tabla y la persona porque en el mismo navegador mira más de una —quien
 * entra por la mañana y quien entra por la tarde—: el orden que vuelve es el de
 * cada cual, no el del último que pulsó una cabecera. Sin sesión (una cuenta
 * anónima, un módulo que todavía no la sabe) se guarda igual, bajo `anonimo`,
 * que es mejor que no recordar nada.
 */
export function tableSortKey(table: string, userId?: string | null): string {
  return `${TABLE_SORT_STORAGE_PREFIX}:${table}:${userId?.trim() || "anonimo"}`;
}

/**
 * El orden que esa persona dejó en esa tabla, o `null` si no hay ninguno o el
 * que hay ya no vale.
 *
 * Conviene desconfiar de lo guardado: con el tiempo una columna se quita o se
 * renombra, y un orden que apunta a una columna que ya no existe dejaría la tabla
 * ordenada por nada. Si la columna no es una de las de ahora, si el sentido no se
 * entiende o si lo guardado no es ni JSON, se prefiere el orden de siempre.
 */
export function readTableSort<Column extends string>(
  storage: SortStorage | null,
  { key, columns }: { key: string; columns: readonly Column[] },
): TableSort<Column> | null {
  const raw = storage?.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const { column, direction } = parsed as {
      column?: unknown;
      direction?: unknown;
    };
    if (typeof column !== "string") return null;
    if (direction !== "asc" && direction !== "desc") return null;
    if (!columns.includes(column as Column)) return null;
    return { column: column as Column, direction };
  } catch {
    return null;
  }
}

/**
 * Recuerda cómo ordena esa persona esa tabla. Con `null` se olvida lo elegido: la
 * próxima visita abre la tabla como llega del servidor, que es justo a donde
 * vuelve el botón «Orden original».
 */
export function writeTableSort<Column extends string>(
  storage: SortStorage | null,
  key: string,
  sort: TableSort<Column> | null,
): void {
  storage?.setItem(key, sort === null ? "" : JSON.stringify(sort));
}

/* ------------------------------------------------------------------ */
/* Ordenar lo que se está viendo                                       */
/* ------------------------------------------------------------------ */

/**
 * Ordena una copia con la columna elegida. Los huecos —una marca sin poner, una
 * serie sin apuntar— van al final en los dos sentidos: así la primera fila de la
 * tabla es siempre un dato y no una celda en blanco, que se lee como si faltara
 * algo.
 *
 * El orden es estable: dos filas que empatan se quedan como estaban, así que
 * quitar la ordenación deja la tabla como la tenía el servidor.
 */
export function sortRows<T, Column extends string>(
  rows: readonly T[],
  getValue: (row: T, column: Column) => SortValue,
  sort: TableSort<Column> | null,
): T[] {
  if (sort === null) return [...rows];
  const factor = sort.direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = getValue(a, sort.column);
    const right = getValue(b, sort.column);
    const leftEmpty = isEmptyValue(left);
    const rightEmpty = isEmptyValue(right);
    if (leftEmpty || rightEmpty) {
      if (leftEmpty && rightEmpty) return 0;
      return leftEmpty ? 1 : -1;
    }
    return factor * compareSortValues(left, right);
  });
}

/* ------------------------------------------------------------------ */
/* El selector de orden                                                */
/* ------------------------------------------------------------------ */

/**
 * El valor del selector para el orden de siempre. Va con prefijo en las columnas
 * —no al revés— para que ninguna columna, se llame como se llame, pueda
 * confundirse con esta opción.
 */
export const SORT_OPTION_ORIGINAL = "original";

const SORT_OPTION_PREFIX = "columna:";

/** El valor del selector de una columna, o el del orden de siempre con `null`. */
export function sortOptionValue<Column extends string>(
  column: Column | null,
): string {
  return column === null
    ? SORT_OPTION_ORIGINAL
    : `${SORT_OPTION_PREFIX}${column}`;
}

/** Una opción del selector: lo que manda y lo que se lee. */
export interface SortOption {
  value: string;
  label: string;
}

/**
 * Las opciones del selector: el orden de siempre y **todas** las columnas de la
 * tabla, también las que en esta pantalla están ocultas.
 *
 * Las columnas salen de la vista —las mismas que ordena `sortRows`— y no de lo
 * que se ve: en una pantalla estrecha la tabla esconde varias, y una cabecera que
 * no está no se puede pulsar. Ese es justo el trabajo del selector.
 *
 * El nombre de cada opción es la etiqueta a secas, sin el sentido: el sentido va
 * en el botón de al lado y en el aviso, que ya lo dicen. El sentido no puede ir
 * dentro de la opción porque volver a elegir la que ya está puesta no avisa a
 * nadie (el valor del selector no habría cambiado), y quedarse sin poder invertir
 * desde ahí sería una trampa.
 */
export function sortOptions<Column extends string>(
  columns: Record<Column, { label: string }>,
): SortOption[] {
  return [
    { value: SORT_OPTION_ORIGINAL, label: "Orden original" },
    ...(Object.keys(columns) as Column[]).map((column) => ({
      value: sortOptionValue(column),
      label: columns[column].label,
    })),
  ];
}

/**
 * El orden que sale de elegir una columna en el selector: esa columna, de menor a
 * mayor. Volver a elegir la que ya está puesta no cambia nada —el sentido lo mueve
 * el botón de al lado—, y la opción del orden de siempre devuelve la tabla a como
 * llega.
 *
 * Una opción que no sea de una columna de hoy se ignora: lo que hay guardado manda
 * menos que las columnas que existen ahora.
 */
export function sortFromOptionValue<Column extends string>(
  value: string,
  current: TableSort<Column> | null,
  columns: readonly Column[],
): TableSort<Column> | null {
  if (value === SORT_OPTION_ORIGINAL) return null;
  if (!value.startsWith(SORT_OPTION_PREFIX)) return current;
  const column = value.slice(SORT_OPTION_PREFIX.length) as Column;
  if (!columns.includes(column)) return current;
  if (current !== null && current.column === column) return current;
  return { column, direction: "asc" };
}
