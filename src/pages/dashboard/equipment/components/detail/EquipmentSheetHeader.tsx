import { Badge } from "@/components/ui/badge";
import {
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { equipmentLabel } from "@/lib/workshop";
import type { EquipmentDoc } from "../../types";

interface EquipmentSheetHeaderProps {
  item: EquipmentDoc;
  openedAt: number;
  compatibleCount: number;
  relatedCount: number;
  reviewState: "overdue" | "ok" | "none";
}

/**
 * Cabecera de la ficha lateral de equipo: códigos, marcas, garantías, revisiones y compatibilidad.
 */
export function EquipmentSheetHeader({
  item,
  openedAt,
  compatibleCount,
  relatedCount,
  reviewState,
}: EquipmentSheetHeaderProps) {
  const reviewBadge =
    reviewState === "overdue" ? (
      <Badge
        variant="outline"
        className="border-amber-500/25 bg-amber-500/10 text-amber-700"
      >
        Revisión vencida
      </Badge>
    ) : reviewState === "ok" ? (
      <Badge
        variant="outline"
        className="border-emerald-600/25 bg-emerald-600/10 text-emerald-700"
      >
        Revisión al día
      </Badge>
    ) : null;

  const warrantyBadge =
    item.warrantyEndDate === undefined ? null : item.warrantyEndDate >=
      openedAt ? (
      <Badge
        variant="outline"
        className="border-emerald-600/25 bg-emerald-600/10 text-emerald-700"
      >
        En garantía
      </Badge>
    ) : (
      <Badge
        variant="outline"
        className="border-amber-500/25 bg-amber-500/10 text-amber-700"
      >
        Garantía caducada
      </Badge>
    );

  return (
    <SheetHeader>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-semibold text-muted-foreground">
          {item.code}
        </span>
        {item.brand && (
          <Badge
            variant="outline"
            className="border-border bg-muted text-muted-foreground"
          >
            {item.brand}
          </Badge>
        )}
        {item.decommissionDate ? (
          <Badge
            variant="outline"
            className="border-border bg-muted text-muted-foreground"
          >
            De baja
          </Badge>
        ) : (
          warrantyBadge
        )}
        {reviewBadge}
        <Badge
          variant="outline"
          className="border-signal/25 bg-signal/10 text-signal"
        >
          {compatibleCount}{" "}
          {compatibleCount === 1 ? "repuesto" : "repuestos"}
        </Badge>
      </div>
      <SheetTitle className="text-xl tracking-tight">
        {equipmentLabel(item)}
      </SheetTitle>
      <SheetDescription>
        {item.location ? `Ubicación ${item.location}` : "Sin ubicación"} ·{" "}
        {relatedCount} peticiones
      </SheetDescription>
    </SheetHeader>
  );
}
