import { Button } from "@/components/ui/button";
import { pageSummary, type Paging } from "@/lib/pagination";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import type { ReactNode } from "react";

/**
 * El pie de una lista paginada: por dónde va la página que se está viendo y los
 * cuatro botones para moverse. Lo llevan igual la tabla de un módulo y una cola
 * de fichas: la medida del alto y la manera de pasar de página son las mismas.
 *
 * Va pegado a lo que pagina —dentro de la tarjeta de la tabla, justo debajo; en
 * una cola, como una tarjeta suelta al pie de la lista— porque es ahí donde se
 * necesita: la queja que lo trajo era tener que bajar hasta el final de una
 * lista larga para llegar a su pie. Con la lista partida en páginas, la lista y
 * su pie caben en la pantalla.
 *
 * Cuántas filas se ven de una vez no se elige aquí: son las que caben en el alto
 * del área de la lista, que se mide sola (`useRowsThatFit`). Por eso el pie ya no
 * lleva selector de tamaño: la medida de la pantalla manda, y lo que queda es el
 * recuento —que además dice cuántas se están viendo de verdad— y el movimiento.
 *
 * Con una sola página no se enseñan los botones, que no hay a dónde ir, pero sí
 * el recuento.
 */
export function TablePagination({
  paging,
  singular,
  plural,
  detail,
  className,
}: {
  /** La ventana y los mandos que devuelve `useTablePagination`. */
  paging: Paging;
  /** Cómo se llama lo que hay en la lista: «repuesto» / «repuestos». */
  singular: string;
  plural: string;
  /** Lo que se añade al recuento: «con los filtros puestos», «4 con acceso»… */
  detail?: ReactNode;
  /**
   * El trazo de fuera, para cuando el pie no va dentro de una tarjeta: una cola
   * de fichas no la tiene, así que el pie se la pone él.
   */
  className?: string;
}) {
  const { page, pages, from, to, total, setPage } = paging;
  const single = pages <= 1;
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border/70 bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground",
        className,
      )}
    >
      <p className="flex flex-wrap items-center gap-x-1.5">
        <span>{pageSummary({ from, to, total }, { singular, plural })}</span>
        {detail && (
          <>
            <span aria-hidden="true">·</span>
            <span>{detail}</span>
          </>
        )}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        {!single && (
          <>
            <p aria-live="polite">
              Página {page} de {pages}
            </p>
            <nav
              aria-label={`Páginas de ${plural}`}
              className="flex items-center gap-1"
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                disabled={page <= 1}
                aria-label="Primera página"
                title="Primera página"
                onClick={() => setPage(1)}
              >
                <ChevronsLeft className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                disabled={page <= 1}
                aria-label="Página anterior"
                title="Página anterior"
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                disabled={page >= pages}
                aria-label="Página siguiente"
                title="Página siguiente"
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                disabled={page >= pages}
                aria-label="Última página"
                title="Última página"
                onClick={() => setPage(pages)}
              >
                <ChevronsRight className="size-4" />
              </Button>
            </nav>
          </>
        )}
      </div>
    </div>
  );
}
