import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  ExternalLink,
  MapPin,
  Pencil,
  Printer,
  ShoppingCart,
  SlidersHorizontal,
  Tag,
  Wrench,
} from "lucide-react";
import { CatalogContactInfo } from "@/components/CatalogContactInfo";
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
import { STOCK_META, formatCurrency, getErrorMessage, stockState } from "@/lib/workshop";
import { physicalStock, reservedUnits } from "@/lib/inventoryStock";
import {
  PART_LIFECYCLE_META,
  isPartPurchasable,
  type PartLifecycleStatus,
} from "@/lib/partLifecycle";
import { modelLabel } from "../helpers";
import type { EquipmentModelDoc, PartDoc } from "../types";
import { PartMovementsSection } from "./PartMovementsSection";

export interface PartDetailSheetProps {
  part: PartDoc | null;
  parts?: PartDoc[];
  canManage: boolean;
  canPurchase?: boolean;
  catalogModels: EquipmentModelDoc[];
  onClose: () => void;
  onEdit: (part: PartDoc) => void;
  onStockAdjust: (part: PartDoc) => void;
  onPrintLabel: (part: PartDoc) => void;
  onSelectModel?: (modelName: string) => void;
  onSelectPart?: (id: PartDoc["_id"]) => void;
}

export function PartDetailSheet({
  part,
  parts = [],
  canManage,
  canPurchase = false,
  catalogModels,
  onClose,
  onEdit,
  onStockAdjust,
  onPrintLabel,
  onSelectModel,
  onSelectPart,
}: PartDetailSheetProps) {
  const updatePart = useMutation(api.spareParts.update);
  const requestRestock = useMutation(api.purchasing.requestRestock);
  const [savingLifecycle, setSavingLifecycle] = useState(false);
  const [requestingRestock, setRequestingRestock] = useState(false);
  const movements = useQuery(
    api.stockMovements.listByPart,
    part ? { sparePartId: part._id, limit: 15 } : "skip",
  );

  const state = part ? stockState(part.stock, part.minStock) : "ok";
  const meta = STOCK_META[state];
  const compatibles = (part?.compatibleModels ?? [])
    .map((id) => catalogModels.find((m) => m._id === id))
    .filter((m): m is EquipmentModelDoc => Boolean(m));
  const replacementPart = part?.replacementPartId
    ? (parts.find((candidate) => candidate._id === part.replacementPartId) ??
      null)
    : null;
  const safePurchaseUrl =
    part?.purchaseUrl && /^https?:\/\//i.test(part.purchaseUrl.trim())
      ? part.purchaseUrl.trim()
      : null;

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
                {part.lifecycleStatus && part.lifecycleStatus !== "active" && (
                  <Badge
                    variant="outline"
                    className={PART_LIFECYCLE_META[part.lifecycleStatus].badgeClassName}
                  >
                    {PART_LIFECYCLE_META[part.lifecycleStatus].label}
                  </Badge>
                )}
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

            <div className="grid min-w-0 gap-4 px-4 pb-6 sm:px-6 [&>*]:min-w-0">
              <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Ficha del repuesto
                </p>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      {reservedUnits(part.reservedStock) > 0
                        ? "Stock disponible"
                        : "Stock actual"}
                    </dt>
                    <dd className="mt-0.5 text-lg font-bold tabular-nums">
                      {part.stock}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        {part.unit}
                      </span>
                    </dd>
                    {reservedUnits(part.reservedStock) > 0 && (
                      <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                        Físico {physicalStock(part.stock, part.reservedStock)}{" "}
                        {part.unit} · Reservado{" "}
                        {reservedUnits(part.reservedStock)} {part.unit}
                      </p>
                    )}
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

                {part.supplier && (
                  <CatalogContactInfo
                    kind="supplier"
                    name={part.supplier}
                    catalogId={part.supplierId}
                    className="mt-3 grid gap-1.5 rounded-lg border border-border/70 bg-muted/30 p-2.5 text-xs text-muted-foreground"
                  />
                )}

                {(safePurchaseUrl || replacementPart || part.discontinuedNote) && (
                  <div className="mt-3 grid gap-2 rounded-lg border border-border/60 bg-muted/20 p-3 text-xs">
                    {safePurchaseUrl && (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-muted-foreground">
                          Ficha o enlace de compra
                        </span>
                        <a
                          href={safePurchaseUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-signal underline-offset-2 hover:underline"
                        >
                          Abrir enlace del proveedor
                          <ExternalLink className="size-3.5" />
                        </a>
                      </div>
                    )}
                    {replacementPart && (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-muted-foreground">
                          Repuesto equivalente
                        </span>
                        {onSelectPart ? (
                          <button
                            type="button"
                            onClick={() => onSelectPart(replacementPart._id)}
                            className="font-medium text-signal underline-offset-2 hover:underline"
                          >
                            {replacementPart.code} · {replacementPart.name}
                          </button>
                        ) : (
                          <span className="font-medium">
                            {replacementPart.code} · {replacementPart.name}
                          </span>
                        )}
                      </div>
                    )}
                    {part.discontinuedNote && (
                      <p className="text-muted-foreground">
                        {part.discontinuedNote}
                      </p>
                    )}
                  </div>
                )}

                {canManage && (
                  <div className="mt-3 grid grid-cols-1 gap-2 rounded-lg border border-border/60 bg-muted/20 p-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-xs">
                      <span className="font-medium text-muted-foreground">
                        Disponibilidad / Ciclo de vida
                      </span>
                      <select
                        value={part.lifecycleStatus ?? "active"}
                        disabled={savingLifecycle}
                        onChange={async (event) => {
                          setSavingLifecycle(true);
                          try {
                            await updatePart({
                              id: part._id,
                              lifecycleStatus: event.target
                                .value as PartLifecycleStatus,
                            });
                            toast.success("Estado del repuesto actualizado.");
                          } catch (err) {
                            toast.error(getErrorMessage(err));
                          } finally {
                            setSavingLifecycle(false);
                          }
                        }}
                        className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs shadow-xs"
                      >
                        <option value="active">Activo</option>
                        <option value="low_availability">
                          Baja disponibilidad
                        </option>
                        <option value="discontinued">
                          Descatalogado / Sin suministro
                        </option>
                      </select>
                    </label>

                    <label className="grid gap-1 text-xs">
                      <span className="font-medium text-muted-foreground">
                        Repuesto equivalente
                      </span>
                      <select
                        value={part.replacementPartId ?? ""}
                        disabled={savingLifecycle}
                        onChange={async (event) => {
                          const val = event.target.value;
                          setSavingLifecycle(true);
                          try {
                            await updatePart({
                              id: part._id,
                              ...(val
                                ? {
                                    replacementPartId:
                                      val as PartDoc["_id"],
                                  }
                                : { clearReplacementPart: true }),
                            });
                            toast.success("Repuesto equivalente actualizado.");
                          } catch (err) {
                            toast.error(getErrorMessage(err));
                          } finally {
                            setSavingLifecycle(false);
                          }
                        }}
                        className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs shadow-xs"
                      >
                        <option value="">Sin equivalente</option>
                        {parts
                          .filter((candidate) => candidate._id !== part._id)
                          .map((candidate) => (
                            <option key={candidate._id} value={candidate._id}>
                              {candidate.code} · {candidate.name}
                            </option>
                          ))}
                      </select>
                    </label>
                  </div>
                )}

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
                  {canPurchase && isPartPurchasable(part.lifecycleStatus) && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={requestingRestock}
                      onClick={async () => {
                        setRequestingRestock(true);
                        try {
                          const res = await requestRestock({
                            sparePartId: part._id,
                          });
                          toast.success(
                            `Reposición ${res.reference} enviada a Compras → Pendientes.`,
                          );
                        } catch (err) {
                          toast.error(getErrorMessage(err));
                        } finally {
                          setRequestingRestock(false);
                        }
                      }}
                    >
                      <ShoppingCart className="mr-1.5 size-4" />
                      {requestingRestock ? "Pidiendo..." : "Pedir reposición"}
                    </Button>
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
