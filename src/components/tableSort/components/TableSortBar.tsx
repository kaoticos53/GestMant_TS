import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  directionLabel,
  flipTableSort,
  sortFromOptionValue,
  sortOptionValue,
  sortOptions,
} from "@/lib/tableSort";
import { Undo2 } from "lucide-react";
import type { TableSortBarProps } from "../types";
import { SortFlipButton } from "./SortFlipButton";

/**
 * Barra superior para ordenar tablas, indispensable para pantallas estrechas
 * donde ciertas columnas se ocultan y no se pueden pulsar directamente.
 */
export function TableSortBar<Column extends string>({
  columns,
  sort,
  onSortChange,
}: TableSortBarProps<Column>) {
  const label = sort === null ? null : columns[sort.column].label;

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border/70 bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        <span aria-hidden="true">Ordenar por</span>
        <Select
          value={sortOptionValue(sort?.column ?? null)}
          onValueChange={(value) =>
            onSortChange(
              sortFromOptionValue(
                value,
                sort,
                Object.keys(columns) as Column[],
              ),
            )
          }
        >
          <SelectTrigger
            size="sm"
            className="w-auto min-w-[9rem] text-xs"
            aria-label="Ordenar por columna"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sortOptions(columns).map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                className="text-xs"
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <SortFlipButton
          sort={sort}
          onFlip={() => onSortChange(flipTableSort(sort))}
        />
      </div>
      {sort !== null && label !== null && (
        <div className="flex flex-wrap items-center gap-2">
          <span>
            Ordenada por{" "}
            <span className="font-medium text-foreground">{label}</span>
            {`, ${directionLabel(sort.direction)}`}
          </span>
          <button
            type="button"
            onClick={() => onSortChange(null)}
            title="Volver al orden con el que llega la tabla"
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Undo2 className="size-3.5" aria-hidden="true" />
            Orden original
          </button>
        </div>
      )}
    </div>
  );
}
