/**
 * Herramientas compartidas por las listas largas del panel —las colas de fichas
 * (incidencias, peticiones y archivo) y la auditoría de documentos— para
 * trabajar con muchísimos registros: buscar sin acentos, ordenar por fecha y
 * agrupar por día/mes. Viven aquí, fuera de los componentes, para poder probarlas
 * sin navegador.
 *
 * Enseñar la lista por partes no es cosa de este módulo: todas van por páginas
 * con las que caben en el alto del área, contadas por el navegador
 * (`lib/pagination`).
 */

/** Órdenes por fecha disponibles. */
export type DateSortId = "recent" | "oldest";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Texto comparable: sin mayúsculas, sin acentos y sin espacios sobrantes. */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * ¿Alguno de los campos contiene lo que se busca? Se comparan todos los campos
 * juntos y cada palabra escrita debe aparecer en algún sitio, así que «cámara
 * plató 2» encuentra la incidencia aunque cada dato esté en un campo distinto.
 * Sin texto que buscar, todo pasa el filtro.
 */
export function matchesQuery(
  fields: readonly (string | number | null | undefined)[],
  query: string,
): boolean {
  const terms = normalizeText(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = normalizeText(
    fields
      .filter((field) => field !== null && field !== undefined && field !== "")
      .join(" · "),
  );
  return terms.every((term) => haystack.includes(term));
}

/** Copia ordenada por fecha, de más reciente a más antigua o al revés. */
export function sortByDate<T>(
  items: readonly T[],
  getTime: (item: T) => number,
  direction: DateSortId = "recent",
): T[] {
  const factor = direction === "recent" ? -1 : 1;
  return [...items].sort((a, b) => factor * (getTime(a) - getTime(b)));
}

/** Medianoche del día de una marca de tiempo (para contar días enteros). */
export function startOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/**
 * Rótulo del grupo de una fecha: los días recientes se nombran («Hoy», «Ayer»),
 * la semana y el mes en curso se agrupan, y lo más antiguo se agrupa por mes
 * («Septiembre de 2026»), que es lo que hace navegable un histórico largo.
 */
export function dateBucket(
  timestamp: number,
  now: number = Date.now(),
): { key: string; label: string } {
  const days = Math.round((startOfDay(now) - startOfDay(timestamp)) / DAY_MS);
  if (days <= 0) return { key: "hoy", label: "Hoy" };
  if (days === 1) return { key: "ayer", label: "Ayer" };
  if (days <= 7) return { key: "semana", label: "Últimos 7 días" };
  if (days <= 30) return { key: "mes", label: "Últimos 30 días" };
  const date = new Date(timestamp);
  const month = date.toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });
  return {
    key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
    label: month.charAt(0).toUpperCase() + month.slice(1),
  };
}

export interface DateGroup<T> {
  key: string;
  label: string;
  items: T[];
}

/**
 * Agrupa por fecha respetando el orden de entrada (las colas llegan ya
 * ordenadas): una sección por día próximo y una por mes para lo antiguo, así
 * que nunca se mezclan dos épocas en la misma sección.
 */
export function groupByDate<T>(
  items: readonly T[],
  getTime: (item: T) => number,
  now: number = Date.now(),
): DateGroup<T>[] {
  const groups = new Map<string, DateGroup<T>>();
  for (const item of items) {
    const { key, label } = dateBucket(getTime(item), now);
    const group = groups.get(key);
    if (group) group.items.push(item);
    else groups.set(key, { key, label, items: [item] });
  }
  return [...groups.values()];
}

/**
 * Fecha de corte del archivado masivo: el día 1 del mes que había hace
 * `months` meses. Se ancla al día 1 para que el corte no cambie de un día para
 * otro (archiva «todo lo anterior a marzo», no «a este mismo día de marzo»).
 */
export function monthsAgo(months: number, now: number = Date.now()): number {
  const date = new Date(now);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  date.setMonth(date.getMonth() - months);
  return date.getTime();
}
