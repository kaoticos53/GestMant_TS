import { Button } from "@/components/ui/button";
import {
  groupBySupplier,
  type PurchaseRequestDoc,
} from "@/lib/purchasing";
import { ClipboardList, ShoppingCart } from "lucide-react";
import { useMemo, useState } from "react";
import { CreateOrderDialog } from "../dialogs/CreateOrderDialog";
import type { PartDoc, PartRequestDoc } from "../types";
import { MissingStockCard } from "./pending/components/MissingStockCard";
import { PurchaseRequestActionDialog } from "./pending/components/PurchaseRequestActionDialog";
import { SupplierGroupCard } from "./pending/components/SupplierGroupCard";
import { useMissingStockActions } from "./pending/hooks/useMissingStockActions";
import { usePendingPurchaseSelection } from "./pending/hooks/usePendingPurchaseSelection";
import type { PurchaseActionTarget } from "./pending/types";

export interface PendingSectionProps {
  purchaseRequests: PurchaseRequestDoc[];
  partRequests: PartRequestDoc[];
  parts: PartDoc[];
  canManage: boolean;
}

/**
 * Sección de compras pendientes: peticiones de repuesto sin existencias en almacén
 * y peticiones de compra abiertas agrupadas por proveedor para generar órdenes.
 */
export function PendingSection({
  purchaseRequests,
  partRequests,
  parts,
  canManage,
}: PendingSectionProps) {
  const missingStock = useMissingStockActions({
    partRequests,
    parts,
    purchaseRequests,
  });

  const selection = usePendingPurchaseSelection(purchaseRequests, canManage);
  const [actionTarget, setActionTarget] = useState<PurchaseActionTarget | null>(
    null,
  );

  const groups = useMemo(
    () => groupBySupplier(purchaseRequests),
    [purchaseRequests],
  );

  return (
    <div className="grid gap-5">
      <MissingStockCard
        missingStockRequests={missingStock.missingStockRequests}
        markedIds={missingStock.markedIds}
        canManage={canManage}
        areAllMarked={missingStock.areAllMarked}
        isReserving={missingStock.isReserving}
        generatingId={missingStock.generatingId}
        onToggleMarked={missingStock.toggleMarked}
        onToggleAll={missingStock.toggleAll}
        onReserveMarked={() => void missingStock.reserveMarked()}
        onGenerateSingle={(request) => void missingStock.generateSingle(request)}
      />

      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center shadow-sm">
          <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-signal/10 text-signal">
            <ShoppingCart className="size-5" />
          </span>
          <p className="mt-4 text-base font-semibold tracking-tight">
            No hay nada pendiente de comprar
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
            Lo que el almacén no cubre aparece aquí, agrupado por proveedor, en
            cuanto el responsable aparta la línea de su petición.
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {selection.validation.feedbackMessage}
          </p>
          <Button
            type="button"
            className="gap-2"
            disabled={!selection.validation.canCreateOrder}
            onClick={() => selection.setIsOrderDialogOpen(true)}
          >
            <ClipboardList className="size-4" />
            Crear orden de compra
          </Button>
        </div>
      )}

      {groups.map((group) => (
        <SupplierGroupCard
          key={group.supplier}
          group={group}
          canManage={canManage}
          selectedIds={selection.selectedIds}
          isGroupFullySelected={selection.isGroupFullySelected(group.items)}
          onToggleItem={selection.toggleItem}
          onToggleGroup={() => selection.toggleGroup(group.items)}
          onAction={setActionTarget}
        />
      ))}

      {selection.isOrderDialogOpen && (
        <CreateOrderDialog
          open={selection.isOrderDialogOpen}
          onOpenChange={selection.setIsOrderDialogOpen}
          items={selection.validation.selectedItems}
          onCreated={selection.clearSelection}
        />
      )}

      <PurchaseRequestActionDialog
        target={actionTarget}
        onClose={() => setActionTarget(null)}
      />
    </div>
  );
}
