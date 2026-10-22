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
import { AUDIT_ACTIONS } from "@/lib/audit";
import { AUDIT_EVERYONE, AUDIT_EVERY_KIND } from "../../../types";
import { formatAuthorOption } from "../helpers";
import type { AuditFiltersGridProps } from "../types";

export function AuditFiltersGrid({
  filters,
  authors,
  onApplyFilters,
}: AuditFiltersGridProps) {
  return (
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
                {formatAuthorOption(author.name, author.movements)}
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
  );
}
