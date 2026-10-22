import { Button } from "@/components/ui/button";
import type { ManualRights } from "@/lib/manuals";
import { BookOpen, Plus } from "lucide-react";
import type { ManualDoc } from "../../ManualsView";
import type { EquipmentDoc } from "../../types";
import { ManualRow } from "../ManualRow";

interface EquipmentManualsSectionProps {
  item: EquipmentDoc;
  manuals?: { assigned: ManualDoc[]; byModel: ManualDoc[] };
  canAddManual?: boolean;
  rights?: ManualRights;
  onAddManual: (item: EquipmentDoc) => void;
  onViewManual: (manual: ManualDoc) => void;
  onEditManual: (manual: ManualDoc) => void;
  onDeleteManual: (manual: ManualDoc) => void;
}

/**
 * Sección de manuales técnicos asociados al equipo (asignados directamente o vinculados por modelo).
 */
export function EquipmentManualsSection({
  item,
  manuals = { assigned: [], byModel: [] },
  canAddManual = false,
  rights = { manage: false, userId: null },
  onAddManual,
  onViewManual,
  onEditManual,
  onDeleteManual,
}: EquipmentManualsSectionProps) {
  const hasManuals = manuals.assigned.length > 0 || manuals.byModel.length > 0;

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <BookOpen className="size-3.5" />
          Manuales
        </p>
        {canAddManual && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => onAddManual(item)}
          >
            <Plus className="size-4" />
            Añadir manual
          </Button>
        )}
      </div>

      {!hasManuals ? (
        <p className="mt-3 rounded-lg border border-dashed border-border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
          Este equipo no tiene manuales. Añádelos desde aquí —el que subas queda
          asignado a este equipo—; para uno del modelo, sin equipo concreto, está
          el módulo de manuales.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-border/70">
          {manuals.assigned.map((manual) => (
            <ManualRow
              key={manual._id}
              manual={manual}
              assigned
              rights={rights}
              onView={onViewManual}
              onEdit={onEditManual}
              onDelete={onDeleteManual}
            />
          ))}
          {manuals.byModel.map((manual) => (
            <ManualRow
              key={manual._id}
              manual={manual}
              assigned={false}
              rights={rights}
              onView={onViewManual}
              onEdit={onEditManual}
              onDelete={onDeleteManual}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
