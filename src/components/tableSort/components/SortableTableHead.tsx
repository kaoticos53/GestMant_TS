import { TableHead } from "@/components/ui/table";
import { nextTableSort } from "@/lib/tableSort";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import {
  getAriaSort,
  getSortButtonAriaLabel,
  getSortButtonTitle,
} from "../helpers";
import type { SortableTableHeadProps } from "../types";

/**
 * Cabecera interactiva para ordenar columnas dentro de la tabla.
 * Conserva semántica WAI-ARIA completa (`aria-sort`) y soporte para lectores de pantalla.
 */
export function SortableTableHead<Column extends string>({
  column,
  label,
  sort,
  onSortChange,
  className,
  buttonClassName,
  align = "left",
}: SortableTableHeadProps<Column>) {
  const direction =
    sort !== null && sort.column === column ? sort.direction : null;

  return (
    <TableHead className={className} aria-sort={getAriaSort(direction)}>
      <button
        type="button"
        onClick={() => onSortChange(nextTableSort(sort, column))}
        title={getSortButtonTitle(label, direction)}
        aria-label={getSortButtonAriaLabel(label, direction)}
        className={cn(
          "flex w-full items-center gap-1.5 rounded-md py-1 text-left font-medium transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          align === "right" ? "justify-end" : "justify-start",
          direction === null ? "text-muted-foreground" : "text-foreground",
          buttonClassName,
        )}
      >
        <span className="truncate">{label}</span>
        {direction === "asc" ? (
          <ArrowUp className="size-3.5 shrink-0" aria-hidden="true" />
        ) : direction === "desc" ? (
          <ArrowDown className="size-3.5 shrink-0" aria-hidden="true" />
        ) : (
          <ChevronsUpDown
            className="size-3.5 shrink-0 opacity-50"
            aria-hidden="true"
          />
        )}
      </button>
    </TableHead>
  );
}
