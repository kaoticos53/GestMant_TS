import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DateSortId } from "@/lib/browse";
import { cn } from "@/lib/utils";
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

          {/* La densidad se elige entre las dos vistas, no con un botón que
              cambia de nombre según el estado: antes el rótulo decía la vista
              contraria a la que se iba a poner. */}
          <div
            role="group"
            aria-label={`Vista de ${noun}`}
            className="inline-flex items-center rounded-md border border-border/70 bg-card p-0.5 shadow-xs"
          >
            {(
              [
                { id: "comfortable", label: "Cómoda", icon: LayoutList },
                { id: "compact", label: "Compacta", icon: Rows3 },
              ] as const
            ).map((option) => {
              const active = (option.id === "compact") === compact;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onCompactChange(option.id === "compact")}
                  title={
                    option.id === "compact"
                      ? "Fichas más pequeñas para ver más de golpe"
                      : "Fichas con toda la información"
                  }
                  className={cn(
                    "flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <option.icon className="size-3.5" aria-hidden="true" />
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
