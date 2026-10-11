import { useCallback, useState } from "react";
import {
  DEFAULT_PAGE_SIZE,
  clampPage,
  pageWindow,
  type Paging,
} from "@/lib/pagination";

/**
 * La página de una lista —la tabla de un módulo o una cola de fichas— y cuántas
 * filas se ven de una vez.
 *
 * La aritmética vive en `lib/pagination`, que se prueba sin navegador; aquí solo
 * está el estado de React y las tres reglas que hacen que la lista no se quede
 * en blanco ni enseñe de más:
 *
 * - **El filtro manda.** Cuando cambia lo que se está mirando —la búsqueda, una
 *   categoría, «solo stock bajo»— se vuelve a la primera página: lo que se busca
 *   no está en la cuarta página de otra lista.
 * - **La página se corrige sola.** Si la lista encoge mientras se mira (otra
 *   persona borró filas, el filtro recortó), una página que ya no existe se
 *   acerca a la última: se enseña lo que hay en vez de quedarse vacía.
 * - **Se apunta la fila, no la página.** Lo que se guarda es la fila que se está
 *   mirando —la primera de la página— y la página sale de ahí. Como cuántas
 *   filas caben lo dice el alto de la pantalla (`rowsFit`, medido por
 *   `useRowsThatFit`), girar el móvil o encoger la ventana cambia la página sin
 *   que nadie la pida: apuntando la fila, lo que se estaba leyendo sigue a la
 *   vista en lugar de saltar a otro trozo de la lista —y da igual que cambie el
 *   tamaño de página, como pasa en una cola de fichas al pasar a la vista
 *   compacta—.
 *
 * `resetKey` es la firma de lo que filtra la vista —sus búsquedas y filtros, en
 * una cadena—. La vista la compone; aquí no se sabe qué hay dentro.
 */
export function useTablePagination({
  total,
  rowsFit = DEFAULT_PAGE_SIZE,
  resetKey = "",
}: {
  /** Cuántas filas tiene la lista que se está paginando. */
  total: number;
  /**
   * Cuántas filas caben en el área de la lista: lo que devuelve
   * `useRowsThatFit`. Sin medida todavía, se usa el tamaño de siempre.
   */
  rowsFit?: number;
  /** Lo que filtra la vista: al cambiar, se vuelve a la primera página. */
  resetKey?: string;
}): Paging {
  // El tamaño, saneado: una medida rara no puede partir la tabla en trozos que
  // nadie ha pedido.
  const pageSize =
    Number.isFinite(rowsFit) && rowsFit >= 1
      ? Math.trunc(rowsFit)
      : DEFAULT_PAGE_SIZE;

  const [state, setState] = useState({ resetKey, first: 1 });

  // Cambiar de lista —o de filtro— no puede arrastrar la fila de la anterior: se
  // vuelve a la primera. Es un ajuste en el mismo pase del render —React lo
  // admite para esto—, así que la tabla ya sale por donde le toca, sin parpadear
  // por la página de nadie.
  let { first } = state;
  if (state.resetKey !== resetKey) {
    first = 1;
    setState({ resetKey, first });
  }

  // La página que contiene esa fila: apuntando la fila, un cambio de tamaño no
  // mueve a nadie de sitio.
  const page = Math.floor((first - 1) / pageSize) + 1;
  const view = pageWindow(total, page, pageSize);

  const changePage = useCallback(
    (next: number) => {
      setState((prev) => ({
        ...prev,
        first: (clampPage(next, total, pageSize) - 1) * pageSize + 1,
      }));
    },
    [total, pageSize],
  );

  return { ...view, setPage: changePage };
}
