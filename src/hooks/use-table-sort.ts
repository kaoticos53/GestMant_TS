import { useCallback, useState } from "react";
import { safeLocalStorage } from "@/lib/sidebar";
import {
  readTableSort,
  tableSortKey,
  writeTableSort,
  type TableSort,
} from "@/lib/tableSort";

/**
 * El orden de una tabla, recordado para esa persona: se lee al abrir la vista y
 * se guarda cada vez que cambia, así que la siguiente visita la encuentra por
 * donde la dejó.
 *
 * La parte que sabe leer y escribir —y desconfiar de lo guardado— vive en
 * `lib/tableSort`, que se prueba sin navegador; aquí solo está el enganche con el
 * estado de React y con el almacenamiento del navegador. Si el almacenamiento no
 * está (el navegador lo bloquea), la tabla funciona igual: simplemente no
 * recuerda nada.
 *
 * `columns` es el mismo objeto de columnas de la vista —sus claves son los
 * identificadores que ordena la tabla—: es lo que permite descartar un orden
 * guardado que apunte a una columna que ya no existe.
 */
export function useTableSort<Column extends string>({
  table,
  columns,
  userId = null,
}: {
  /** Nombre de la tabla en el almacenamiento («equipment», «inventory»…). */
  table: string;
  /** Las columnas que se pueden ordenar hoy. */
  columns: Record<Column, unknown>;
  /** De quién es el orden que se recuerda. */
  userId?: string | null;
}): [TableSort<Column> | null, (sort: TableSort<Column> | null) => void] {
  const key = tableSortKey(table, userId);
  const [remembered, setRemembered] = useState<{
    key: string;
    sort: TableSort<Column> | null;
  }>(() => ({
    key,
    sort: readTableSort(safeLocalStorage(), {
      key,
      columns: Object.keys(columns) as Column[],
    }),
  }));

  // Cambiar de persona sin desmontar —cerrar sesión y entrar con otra cuenta—, o
  // de tabla, no puede arrastrar el orden de la anterior: se vuelve a leer. Es un
  // ajuste en el mismo pase del render —React lo admite para esto—, así que la
  // tabla ya sale con el orden que le toca, sin parpadear por el de nadie.
  let sort = remembered.sort;
  if (remembered.key !== key) {
    sort = readTableSort(safeLocalStorage(), {
      key,
      columns: Object.keys(columns) as Column[],
    });
    setRemembered({ key, sort });
  }

  const change = useCallback(
    (next: TableSort<Column> | null) => {
      // Se guarda antes de pintar: si alguien cierra la pestaña justo después de
      // pulsar, el orden ya está apuntado.
      writeTableSort(safeLocalStorage(), key, next);
      setRemembered({ key, sort: next });
    },
    [key],
  );

  return [sort, change];
}
