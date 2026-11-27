import { Link } from "react-router";
import { FileDown, Siren, Sparkles, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  INCIDENT_FILTERS,
  INCIDENT_PRIORITIES,
  INCIDENT_PRIORITY_META,
  type IncidentPriority,
} from "@/lib/workshop";
import type { IncidentFilterId } from "../types";

export function IncidentsHeaderBar({
  filter,
  onFilterChange,
  counts,
  canFilterMine = false,
  mineOnly = false,
  onMineOnlyChange,
  mineCount = 0,
  priority = "all",
  onPriorityChange,
  onOpenReports,
  onOpenAiAssistant,
}: {
  filter: IncidentFilterId;
  onFilterChange: (id: IncidentFilterId) => void;
  counts: Record<IncidentFilterId, number>;
  canFilterMine?: boolean;
  mineOnly?: boolean;
  onMineOnlyChange?: (value: boolean) => void;
  mineCount?: number;
  priority?: IncidentPriority | "all";
  onPriorityChange?: (value: IncidentPriority | "all") => void;
  onOpenReports: () => void;
  onOpenAiAssistant?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {/* Los filtros en una sola línea: en pantallas estrechas se recorren en
            horizontal, y cada uno dice si está puesto (`aria-pressed`). */}
        <div
          role="group"
          aria-label="Filtrar incidencias por estado"
          className="flex min-w-0 flex-1 flex-wrap items-center gap-0.5 rounded-lg border border-border/70 bg-card p-1 shadow-sm max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:[scrollbar-width:none] max-sm:[&::-webkit-scrollbar]:hidden"
        >
          {INCIDENT_FILTERS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={filter === option.id}
              onClick={() => onFilterChange(option.id)}
              className={cn(
                "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                filter === option.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
              <span className="ml-1.5 text-xs tabular-nums opacity-70">
                {counts[option.id]}
              </span>
            </button>
          ))}
        </div>

        {canFilterMine && onMineOnlyChange && (
          <Button
            type="button"
            variant={mineOnly ? "default" : "outline"}
            size="sm"
            aria-pressed={mineOnly}
            className="gap-1.5"
            onClick={() => onMineOnlyChange(!mineOnly)}
          >
            <UserCheck className="size-4" />
            Mis incidencias
            <span className="text-xs tabular-nums opacity-75">
              {mineCount}
            </span>
          </Button>
        )}

        {onPriorityChange && (
          <Select
            value={priority}
            onValueChange={(value) =>
              onPriorityChange(value as IncidentPriority | "all")
            }
          >
            <SelectTrigger
              aria-label="Filtrar por prioridad"
              className="w-full sm:w-44"
            >
              <SelectValue placeholder="Prioridad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las prioridades</SelectItem>
              {INCIDENT_PRIORITIES.map((item) => (
                <SelectItem key={item} value={item}>
                  {INCIDENT_PRIORITY_META[item].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {onOpenAiAssistant && (
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={onOpenAiAssistant}
            title="Consultar el historial de incidencias con DeepSeek"
          >
            <Sparkles className="size-4 text-primary" />
            Consultar IA
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={onOpenReports}
          title="Descarga en un solo archivo el informe de las incidencias de un periodo"
        >
          <FileDown className="size-4" />
          Informes del periodo
        </Button>
        <Button asChild variant="outline" className="gap-2">
          <Link to="/reportar" target="_blank">
            <Siren className="size-4" />
            Notificar incidencia
          </Link>
        </Button>
      </div>
    </div>
  );
}
