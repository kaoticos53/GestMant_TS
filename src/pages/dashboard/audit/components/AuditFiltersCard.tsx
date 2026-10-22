import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Id } from "@/convex/_generated/dataModel";
import { AUDIT_ACTIONS, AUDIT_PRESETS } from "@/lib/audit";
import { FileDown, RotateCcw } from "lucide-react";
import {
  AUDIT_EVERYONE,
  AUDIT_EVERY_KIND,
  type AuditFiltersCardProps,
} from "../types";

/** Panel de filtros por persona, tipo de movimiento, fechas y presets de auditoría. */
export function AuditFiltersCard({
  filters,
  authors,
  activePreset,
  filterCount,
  search,
  sortedCount,
  summary,
  breakdown,
  onApplyFilters,
  onApplyPreset,
  onResetFilters,
  onExport,
}: AuditFiltersCardProps) {
  return (
    <section className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="grid gap-1.5">
          <Label
            htmlFor="auditoria-persona"
            className="text-xs text-muted-foreground"
          >
            Persona
          </Label>
          <Select
            value={filters.userId ?? AUDIT_EVERYONE}
            onValueChange={(value) =>
              onApplyFilters((current) => ({
                ...current,
                userId: value === AUDIT_EVERYONE ? null : (value as Id<"users">),
              }))
            }
          >
            <SelectTrigger
              id="auditoria-persona"
              aria-label="Persona que hizo el movimiento"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={AUDIT_EVERYONE}>Todas las personas</SelectItem>
              {authors.map((author) => (
                <SelectItem key={author.id} value={author.id}>
                  {`${author.name} · ${author.movements} ${
                    author.movements === 1 ? "movimiento" : "movimientos"
                  }`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label
            htmlFor="auditoria-tipo"
            className="text-xs text-muted-foreground"
          >
            Tipo de movimiento
          </Label>
          <Select
            value={filters.action === "" ? AUDIT_EVERY_KIND : filters.action}
            onValueChange={(value) =>
              onApplyFilters((current) => ({
                ...current,
                action:
                  value === AUDIT_EVERY_KIND
                    ? ""
                    : (value as typeof current.action),
              }))
            }
          >
            <SelectTrigger
              id="auditoria-tipo"
              aria-label="Tipo de movimiento"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={AUDIT_EVERY_KIND}>
                Todos los movimientos
              </SelectItem>
              {AUDIT_ACTIONS.map((action) => (
                <SelectItem key={action.id} value={action.id}>
                  {action.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label
            htmlFor="auditoria-desde"
            className="text-xs text-muted-foreground"
          >
            Desde
          </Label>
          <Input
            id="auditoria-desde"
            type="date"
            value={filters.from}
            onChange={(event) =>
              onApplyFilters((current) => ({
                ...current,
                from: event.target.value,
              }))
            }
          />
        </div>

        <div className="grid gap-1.5">
          <Label
            htmlFor="auditoria-hasta"
            className="text-xs text-muted-foreground"
          >
            Hasta
          </Label>
          <Input
            id="auditoria-hasta"
            type="date"
            value={filters.to}
            onChange={(event) =>
              onApplyFilters((current) => ({
                ...current,
                to: event.target.value,
              }))
            }
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {AUDIT_PRESETS.map((preset) => {
          const active = activePreset === preset.id;
          return (
            <Button
              key={preset.id}
              type="button"
              size="sm"
              variant={active ? "default" : "outline"}
              aria-pressed={active}
              onClick={() => onApplyPreset(preset.id)}
            >
              {preset.label}
            </Button>
          );
        })}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="gap-2"
          disabled={filterCount === 0 && search.trim() === ""}
          onClick={onResetFilters}
        >
          <RotateCcw className="size-3.5" />
          Reiniciar filtros
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="ml-auto gap-2"
          onClick={onExport}
          disabled={sortedCount === 0}
          title="Descarga en CSV los movimientos del tramo filtrado (persona, fechas y tipo) en el orden que se ve"
        >
          <FileDown className="size-4" />
          Exportar CSV ({sortedCount})
        </Button>
      </div>

      <p className="mt-3 border-t border-border/60 pt-3 text-xs leading-5 text-muted-foreground">
        {summary.total === 0 ? (
          "Ningún movimiento con estos filtros."
        ) : (
          <>
            <span className="font-medium text-foreground">
              {`${summary.total} ${
                summary.total === 1 ? "movimiento" : "movimientos"
              }`}
            </span>
            {` · ${summary.people} ${
              summary.people === 1 ? "persona" : "personas"
            } · ${summary.incidents} ${
              summary.incidents === 1 ? "incidencia" : "incidencias"
            }`}
            {breakdown.length > 0 ? ` · ${breakdown.join(" · ")}` : ""}
          </>
        )}
      </p>
    </section>
  );
}
