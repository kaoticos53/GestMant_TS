import { useQuery } from "convex/react";
import {
  MapPin,
  Pencil,
  Printer,
  SlidersHorizontal,
  Tag,
  Wrench,
} from "lucide-react";
import { RichText } from "@/components/RichText";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { api } from "@/convex/_generated/api";
import { STOCK_META, formatCurrency, stockState } from "@/lib/workshop";
import { modelLabel } from "../helpers";
import type { EquipmentModelDoc, PartDoc } from "../types";
import { PartMovementsSection } from "./PartMovementsSection";

export interface PartDetailSheetProps {
  part: PartDoc | null;
  canManage: boolean;
  catalogModels: EquipmentModelDoc[];
  onClose: () => void;
  onEdit: (part: PartDoc) => void;
  onStockAdjust: (part: PartDoc) => void;
  onPrintLabel: (part: PartDoc) => void;
  onSelectModel?: (modelName: string) => void;
}

export function PartDetailSheet({
  part,
  canManage,
  catalogModels,
  onClose,
  onEdit,
  onStockAdjust,
  onPrintLabel,
  onSelectModel,
}: PartDetailSheetProps) {
  const movements = useQuery(
    api.stockMovements.listByPart,
    part ? { sparePartId: part._id, limit: 15 } : "skip",
  );

  const state = part ? stockState(part.stock, part.minStock) : "ok";
  const meta = STOCK_META[state];
  const compatibles = (part?.compatibleModels ?? [])
    .map((id) => catalogModels.find((m) => m._id === id))
    .filter((m): m is EquipmentModelDoc => Boolean(m));

  return (
    <Sheet open={part !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col gap-5 overflow-y-auto sm:max-w-lg">
        {part && (
          <>
            <SheetHeader className="space-y-2 border-b pb-4">
              <div className="flex flex-wrap items-center gap-2 pr-6">
                <span className="font-mono text-xs font-semibold text-muted-foreground">
                  {part.code}
                  {part.partNumber ? ` · ${part.partNumber}` : ""}
                </span>
                <Badge variant="outline" className={meta.badgeClassName}>
                  {meta.label}
                </Badge>
              </div>
              <SheetTitle className="text-left text-lg leading-snug">
                {part.name}
              </SheetTitle>
              <SheetDescription className="text-left">
                {part.category}
                {part.supplier ? ` · Proveedor: ${part.supplier}` : ""}
              </SheetDescription>
            </SheetHeader>

            <div className="grid grid-cols-2 gap-3 rounded-xl border bg-muted/20 p-3.5 text-sm">
              <div>
                <span className="text-xs text-muted-foreground">Stock actual</span>
                <p className="mt-0.5 text-xl font-bold tabular-nums">
                  {part.stock}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    {part.unit}
                  </span>
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Stock mínimo</span>
                <p className="mt-0.5 text-xl font-semibold tabular-nums text-muted-foreground">
                  {part.minStock}{" "}
                  <span className="text-xs font-normal">{part.unit}</span>
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="size-3.5 shrink-0" />
                <span>Ubicación: {part.location || "Sin asignar"}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Tag className="size-3.5 shrink-0" />
                <span>
                  Precio:{" "}
                  {part.unitPrice && part.unitPrice > 0
                    ? formatCurrency(part.unitPrice)
                    : "—"}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {canManage && (
                <>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      onClose();
                      onStockAdjust(part);
                    }}
                  >
                    <SlidersHorizontal className="mr-1.5 size-4" />
                    Ajustar stock
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onClose();
                      onEdit(part);
                    }}
                  >
                    <Pencil className="mr-1.5 size-4" />
                    Editar ficha
                  </Button>
                </>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onPrintLabel(part)}
              >
                <Printer className="mr-1.5 size-4" />
                Etiqueta
              </Button>
            </div>

            {part.description && (
              <section className="space-y-1.5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Descripción
                </h3>
                <RichText
                  value={part.description}
                  className="rounded-lg border bg-card p-3 text-sm leading-6"
                />
              </section>
            )}

            <section className="space-y-2">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Wrench className="size-3.5" />
                Modelos compatibles ({compatibles.length})
              </h3>
              {compatibles.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Sin modelos de equipo vinculados.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {compatibles.map((model) => {
                    const label = modelLabel(model);
                    return onSelectModel ? (
                      <Button
                        key={model._id}
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => {
                          onClose();
                          onSelectModel(model.model);
                        }}
                      >
                        {label}
                      </Button>
                    ) : (
                      <Badge key={model._id} variant="secondary">
                        {label}
                      </Badge>
                    );
                  })}
                </div>
              )}
            </section>

            <PartMovementsSection unit={part.unit} movements={movements} />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
