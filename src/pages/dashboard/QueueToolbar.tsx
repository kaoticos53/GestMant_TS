import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DateSortId } from "@/lib/browse";
import { LayoutList, Rows3, Search, X } from "lucide-react";

/** Órdenes de una cola: por fecha (dos sentidos) o el orden de trabajo. */
export type QueueSortId = DateSortId | "queue";

export interface QueueSortOption {
  id: QueueSortId;
  label: string;
}

/**
 * Barra común a las colas largas (incidencias, peticiones y archivo): buscador,
 * orden y vista compacta o cómoda. La usan los tres módulos para que buscar y
 * ordenar funcione igual en toda la aplicación.
 *
 * Cuánto hay y por dónde se va no se dice aquí: eso lo lleva el pie de la lista
 * (`TablePagination`), que va pegado a las fichas y no se pierde de vista.
 */
export function QueueToolbar({
  search,
  onSearchChange,
  placeholder,
  sort,
  onSortChange,
  sortOptions,
  compact = false,
  onCompactChange,
  noun,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  placeholder: string;
  sort: QueueSortId;
  onSortChange: (value: QueueSortId) => void;
  sortOptions: QueueSortOption[];
  compact?: boolean;
  onCompactChange: (value: boolean) => void;
  /** Cómo se llama lo listado, en plural y minúscula («incidencias»). */
  noun: string;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-3 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            className="pl-9 pr-9"
          />
          {search !== "" && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label="Limpiar la búsqueda"
              title="Limpiar la búsqueda"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={sort}
            onValueChange={(value) => onSortChange(value as QueueSortId)}
          >
            <SelectTrigger
              className="w-full sm:w-60"
              aria-label={`Ordenar ${noun}`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={compact}
            onClick={() => onCompactChange(!compact)}
            title={
              compact
                ? "Tarjetas con toda la información"
                : "Tarjetas más pequeñas para ver más de golpe"
            }
            className="gap-2"
          >
            {compact ? (
              <Rows3 className="size-4" />
            ) : (
              <LayoutList className="size-4" />
            )}
            {compact ? "Compacta" : "Cómoda"}
          </Button>
        </div>
      </div>
    </div>
  );
}
