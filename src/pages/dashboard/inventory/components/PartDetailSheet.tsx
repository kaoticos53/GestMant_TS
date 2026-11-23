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
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {part && (
          <>
            <SheetHeader>
              <div className="flex flex-wrap items-center gap-2 pr-6">
                <span className="font-mono text-sm font-semibold text-muted-foreground">
                  {part.code}
                  {part.partNumber ? ` · ${part.partNumber}` : ""}
                </span>
                <Badge
                  variant="outline"
                  className="border-border bg-muted text-muted-foreground"
                >
                  {part.category}
                </Badge>
                <Badge variant="outline" className={meta.badgeClassName}>
                  {meta.label}
                </Badge>
              </div>
              <SheetTitle className="text-xl tracking-tight">
                {part.name}
              </SheetTitle>
              <SheetDescription>
                {part.location
                  ? `Ubicación ${part.location}`
                  : "Sin ubicación"}
                {part.supplier ? ` · Proveedor: ${part.supplier}` : ""}
              </SheetDescription>
            </SheetHeader>

            <div className="grid gap-4 px-4 pb-6 sm:px-6">
              <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Ficha del repuesto
                </p>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      Stock actual
                    </dt>
                    <dd className="mt-0.5 text-lg font-bold tabular-nums">
                      {part.stock}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        {part.unit}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      Stock mínimo
                    </dt>
                    <dd className="mt-0.5 text-lg font-semibold tabular-nums text-muted-foreground">
                      {part.minStock}{" "}
                      <span className="text-xs font-normal">{part.unit}</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3.5 shrink-0" />
                      Ubicación
                    </dt>
                    <dd className="mt-0.5 font-medium">
                      {part.location || "Sin asignar"}
                    </dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Tag className="size-3.5 shrink-0" />
                      Precio unitario
                    </dt>
                    <dd className="mt-0.5 font-medium tabular-nums">
                      {part.unitPrice && part.unitPrice > 0
                        ? formatCurrency(part.unitPrice)
                        : "—"}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 flex flex-wrap gap-2 border-t border-border/60 pt-3">
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
              </div>

              {part.description && (
                <section className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Descripción
                  </h3>
                  <RichText
                    value={part.description}
                    className="mt-1.5 text-sm leading-6"
                  />
                </section>
              )}

              <section className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
                <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Wrench className="size-3.5" />
                  Modelos compatibles ({compatibles.length})
                </h3>
                {compatibles.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Sin modelos de equipo vinculados.
                  </p>
                ) : (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
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
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
