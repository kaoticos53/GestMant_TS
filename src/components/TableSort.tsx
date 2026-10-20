import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableHead } from "@/components/ui/table";
import {
  directionLabel,
  flipTableSort,
  nextTableSort,
  sortFromOptionValue,
  sortOptionValue,
  sortOptions,
  type TableSort,
} from "@/lib/tableSort";
import { cn } from "@/lib/utils";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronsUpDown,
  Undo2,
} from "lucide-react";

/**
 * Las dos piezas que comparten las tablas del taller para poder ordenarse por
 * columna: la barra de orden —con su selector— y la cabecera que se pulsa.
 *
 * El ciclo vive en `lib/tableSort`; aquí solo se pinta y se le da voz: la
 * cabecera lleva su `aria-sort` —como manda la tabla— y el botón dice qué hará
 * la próxima pulsación, así que se puede ordenar también sin ver la flecha.
 *
 * La barra lleva un selector con **todas** las columnas. Hace falta porque la
 * tabla esconde columnas en pantallas estrechas (`hidden md:table-cell`): una
 * cabecera que no se ve no se puede pulsar, y esas columnas —el precio, la
 * ubicación, la marca— se quedaban sin forma de ordenar. El selector no mira lo
 * que se ve sino las columnas de la vista, así que llega a las ocultas. Y como
 * no todo el mundo adivina la flecha, también sirve para ordenar en pantalla
 * ancha.
 *
 * El selector elige la columna y el botón de al lado mueve el sentido: dos
 * controles, dos cosas. Es más honesto que hacer que volver a elegir la misma
 * columna invierta el sentido —la lista no diría nada, porque volver a elegir lo
 * ya elegido no cambia el valor que enseña— y funciona igual.
 */
export function TableSortBar<Column extends string>({
  columns,
  sort,
  onSortChange,
}: {
  /** Las mismas columnas que ordena la tabla: de aquí salen las opciones. */
  columns: Record<Column, { label: string }>;
  sort: TableSort<Column> | null;
  onSortChange: (sort: TableSort<Column> | null) => void;
}) {
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
        <button
          type="button"
          onClick={() => onSortChange(flipTableSort(sort))}
          disabled={sort === null}
          aria-label={
            sort === null
              ? "Invertir el sentido del orden"
              : `Ordenar ${directionLabel(
                  sort.direction === "asc" ? "desc" : "asc",
                )}`
          }
          title={
            sort === null
              ? "Elige primero una columna para poder invertir el sentido"
              : "Invertir el sentido del orden"
          }
          className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 disabled:hover:bg-transparent"
        >
          {sort === null ? (
            <ArrowUpDown className="size-3.5" aria-hidden="true" />
          ) : sort.direction === "asc" ? (
            <ArrowUp className="size-3.5" aria-hidden="true" />
          ) : (
            <ArrowDown className="size-3.5" aria-hidden="true" />
          )}
        </button>
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

/**
 * Una cabecera que ordena. Se pinta dentro de la propia tabla —el `TableHead`
 * con su `aria-sort`— para que la tabla siga siendo una tabla para quien la lee
 * con un lector de pantalla, y el botón de dentro es lo que se pulsa.
 */
export function SortableTableHead<Column extends string>({
  column,
  label,
  sort,
  onSortChange,
  className,
  buttonClassName,
  align = "left",
}: {
  /** Identificador de la columna, el mismo que lee `sortRows`. */
  column: Column;
  label: string;
  sort: TableSort<Column> | null;
  onSortChange: (sort: TableSort<Column> | null) => void;
  className?: string;
  buttonClassName?: string;
  /** Las columnas de números van a la derecha, como sus celdas. */
  align?: "left" | "right";
}) {
  const direction =
    sort !== null && sort.column === column ? sort.direction : null;
  const next =
    direction === null
      ? "de menor a mayor"
      : direction === "asc"
        ? "de mayor a menor"
        : "volver al orden original";
  return (
    <TableHead
      className={className}
      aria-sort={
        direction === "asc"
          ? "ascending"
          : direction === "desc"
            ? "descending"
            : "none"
      }
    >
      <button
        type="button"
        onClick={() => onSortChange(nextTableSort(sort, column))}
        title={`Ordenar por ${label.toLowerCase()}: ${next}`}
        aria-label={`Ordenar por ${label}: ${next}`}
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
