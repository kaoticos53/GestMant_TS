import { useQuery } from "convex/react";
import {
  Boxes,
  History,
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
import { STOCK_MOVEMENT_META, type StockMovementKind } from "@/lib/movements";
import {
  STOCK_META,
  formatCurrency,
  formatDateTime,
  stockState,
} from "@/lib/workshop";
import { modelLabel } from "../helpers";
import type { EquipmentModelDoc, PartDoc } from "../types";

export interface PartDetailSheetProps {
  part: PartDoc | null;
  canManage: boolean;
  catalogModels: EquipmentModelDoc[];
  onClose: () => void;
  onEdit: (part: PartDoc) => void;
  onStockAdjust: (part: PartDoc) => void;
  onPrintLabel: (part: PartDoc) => void;
}

export function PartDetailSheet({
  part,
  canManage,
  catalogModels,
  onClose,
  onEdit,
  onStockAdjust,
  onPrintLabel,
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
                  {compatibles.map((model) => (
                    <Badge key={model._id} variant="secondary">
                      {modelLabel(model)}
                    </Badge>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <History className="size-3.5" />
                Últimos movimientos de stock
              </h3>
              {movements === undefined ? (
                <p className="text-xs text-muted-foreground">
                  Cargando historial de movimientos...
                </p>
              ) : movements.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                  <Boxes className="size-4 shrink-0" />
                  <span>Sin movimientos registrados para este repuesto.</span>
                </div>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {movements.map((mov) => {
                    const kindMeta =
                      STOCK_MOVEMENT_META[mov.kind as StockMovementKind] ?? {
                        label: mov.kind,
                        signTone: "neutral",
                      };
                    const signedDelta =
                      mov.delta > 0 ? `+${mov.delta}` : String(mov.delta);
                    return (
                      <li
                        key={mov._id}
                        className="flex items-start justify-between gap-3 px-3 py-2 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-medium">{kindMeta.label}</p>
                          <p className="truncate text-muted-foreground">
                            {mov.actorName}
                            {mov.reason ? ` · ${mov.reason}` : ""}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {formatDateTime(mov.createdAt)}
                          </p>
                        </div>
                        <div className="shrink-0 text-right tabular-nums">
                          <span
                            className={
                              mov.delta > 0
                                ? "font-semibold text-emerald-600 dark:text-emerald-400"
                                : mov.delta < 0
                                  ? "font-semibold text-rose-600 dark:text-rose-400"
                                  : "font-semibold"
                            }
                          >
                            {signedDelta} {part.unit}
                          </span>
                          <p className="text-[11px] text-muted-foreground">
                            {mov.previousStock} → {mov.nextStock}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
