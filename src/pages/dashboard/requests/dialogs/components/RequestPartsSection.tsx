import { Plus, X } from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Id } from "@/convex/_generated/dataModel";
import type { EquipmentDoc, PartDoc } from "../../types";
import type { RequestLineItem } from "../../hooks/useRequestPartsSelection";

export interface RequestPartsSectionProps {
  parts: PartDoc[];
  visibleParts: PartDoc[];
  compatibleParts: PartDoc[];
  partById: Map<Id<"spareParts">, PartDoc>;
  selectedEquipment: EquipmentDoc | undefined;
  showOnly: boolean;
  onToggleOnlyCompatible: () => void;
  selectedId: string;
  onSelectIdChange: (id: string) => void;
  onAddLine: () => void;
  lines: RequestLineItem[];
  onUpdateQuantity: (sparePartId: Id<"spareParts"> | string, quantity: number) => void;
  onRemoveLine: (sparePartId: Id<"spareParts"> | string) => void;
  disabled?: boolean;
}

/**
 * Sección de búsqueda en catálogo, selector de repuestos,
 * filtrado interactivo por compatibilidad de modelo y listado de líneas.
 */
export function RequestPartsSection({
  parts,
  visibleParts,
  compatibleParts,
  partById,
  selectedEquipment,
  showOnly,
  onToggleOnlyCompatible,
  selectedId,
  onSelectIdChange,
  onAddLine,
  lines,
  onUpdateQuantity,
  onRemoveLine,
  disabled = false,
}: RequestPartsSectionProps) {
  return (
    <div className="grid gap-2">
      <Label>Referencias del catálogo (opcional)</Label>

      {selectedEquipment && (
        <div className="flex flex-wrap items-center gap-2">
          {compatibleParts.length > 0 ? (
            <button
              type="button"
              onClick={onToggleOnlyCompatible}
              disabled={disabled}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                showOnly
                  ? "border-signal bg-signal/10 text-signal"
                  : "border-border/70 text-muted-foreground hover:text-foreground",
              )}
            >
              {showOnly
                ? `Solo compatibles con ${selectedEquipment.model} (${compatibleParts.length})`
                : `Ver todo el catálogo (${parts.length})`}
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">
              Sin repuestos marcados como compatibles con{" "}
              {selectedEquipment.model}: se muestra todo el catálogo.
            </span>
          )}
        </div>
      )}

      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
        <SearchableSelect
          value={selectedId}
          onValueChange={onSelectIdChange}
          options={visibleParts.map((part) => ({
            value: part._id,
            label: `${part.code} — ${part.name}`,
            hint: `stock ${part.stock}`,
            keywords: `${part.code} ${part.name} ${part.partNumber ?? ""}`,
          }))}
          placeholder="Buscar repuesto en el catálogo"
          searchPlaceholder="Buscar por código o nombre…"
          emptyMessage="Sin repuestos que coincidan"
          ariaLabel="Seleccionar repuesto del catálogo"
          disabled={disabled}
          className="min-w-0 flex-1"
        />
        <Button
          type="button"
          variant="outline"
          className="shrink-0 gap-1.5"
          onClick={onAddLine}
          disabled={disabled || !selectedId}
        >
          <Plus className="size-4" />
          Añadir
        </Button>
      </div>

      {lines.length > 0 && (
        <ul className="divide-y divide-border/70 rounded-lg border border-border/70 bg-card">
          {lines.map((line) => {
            const part = partById.get(line.sparePartId);
            return (
              <li
                key={line.sparePartId}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {part?.name ?? "Repuesto"}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {part?.code}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(event) =>
                      onUpdateQuantity(
                        line.sparePartId,
                        Number(event.target.value),
                      )
                    }
                    className="h-8 w-16 text-right tabular-nums"
                    disabled={disabled}
                    aria-label={`Cantidad de ${part?.code ?? "repuesto"}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    onClick={() => onRemoveLine(line.sparePartId)}
                    disabled={disabled}
                    aria-label="Quitar repuesto"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
