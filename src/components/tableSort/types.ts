import type { TableSort } from "@/lib/tableSort";

export interface TableSortBarProps<Column extends string> {
  /** Las mismas columnas que ordena la tabla: de aquí salen las opciones. */
  columns: Record<Column, { label: string }>;
  sort: TableSort<Column> | null;
  onSortChange: (sort: TableSort<Column> | null) => void;
}

export interface SortableTableHeadProps<Column extends string> {
  /** Identificador de la columna, el mismo que lee `sortRows`. */
  column: Column;
  label: string;
  sort: TableSort<Column> | null;
  onSortChange: (sort: TableSort<Column> | null) => void;
  className?: string;
  buttonClassName?: string;
  /** Las columnas de números van a la derecha, como sus celdas. */
  align?: "left" | "right";
}

export interface SortFlipButtonProps<Column extends string> {
  sort: TableSort<Column> | null;
  onFlip: () => void;
}
