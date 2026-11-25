import { useState } from "react";
import { useQuery } from "convex/react";
import { ListViewSkeleton } from "@/components/ListViewSkeleton";
import { api } from "@/convex/_generated/api";
import { isPurchaseRequestUntreated } from "@/lib/purchaseFlow";
import { PurchasingSectionTabs } from "./purchasing/components/PurchasingSectionTabs";
import { PendingSection } from "./purchasing/components/PendingSection";
import { OrdersSection } from "./purchasing/components/OrdersSection";
import { MovementsSection } from "./purchasing/components/MovementsSection";
import { HistorySection } from "./purchasing/components/HistorySection";
import type {
  PurchasingSection,
  PurchasingViewProps,
} from "./purchasing/types";

export type { PurchasingViewProps } from "./purchasing/types";

/**
 * El módulo de compras, de arriba abajo: lo que espera a que alguien monte la
 * orden (agrupado por proveedor, que es como se compra), las órdenes con lo que
 * ha llegado de cada una, los movimientos de recepción con su albarán y el
 * histórico interactivo en formato hoja de cálculo.
 */
export function PurchasingView({
  canManage,
  initialSection = "pending",
  initialOrderId = null,
  onOpenRequest,
}: PurchasingViewProps) {
  // El módulo carga las tres listas que enseña —lo que espera por proveedor, las
  // órdenes y las recepciones— más lo que necesita para nombrar lo que se pide:
  // el catálogo y las peticiones de repuesto de las que sale cada compra.
  const purchasing = useQuery(api.purchasing.listPurchaseRequests, {});
  const rawOrders = useQuery(api.purchasing.listOrders, {});
  const rawReceptions = useQuery(api.purchasing.listReceptions, {});
  const orders = rawOrders ?? [];
  const receptions = rawReceptions ?? [];
  const partRequests =
    useQuery(api.partRequests.list, { includeArchived: true }) ?? [];
  const parts = useQuery(api.spareParts.list) ?? [];
  const purchaseRequests = purchasing?.requests ?? [];

  const [section, setSection] = useState<PurchasingSection>(initialSection);
  const [prevInitialSection, setPrevInitialSection] =
    useState<PurchasingSection>(initialSection);
  if (initialSection !== prevInitialSection) {
    setPrevInitialSection(initialSection);
    setSection(initialSection);
  }

  if (
    purchasing === undefined ||
    rawOrders === undefined ||
    rawReceptions === undefined
  ) {
    return <ListViewSkeleton />;
  }

  // Sin tratar: lo que espera a que alguien monte la orden (`lib/purchaseFlow`).
  const sinTratar = purchaseRequests.filter((row) =>
    isPurchaseRequestUntreated(row.status),
  );
  const pedidas = orders.filter((order) => order.status !== "cancelled").length;
  const totalLineas = orders.reduce((sum, o) => sum + o.lines.length, 0);

  return (
    <div className="grid gap-5">
      <PurchasingSectionTabs
        activeSection={section}
        onSectionChange={setSection}
        pendingCount={sinTratar.length}
        ordersCount={pedidas}
        movementsCount={receptions.length}
        historyCount={totalLineas}
      />

      {section === "pending" && (
        <PendingSection
          purchaseRequests={purchaseRequests}
          partRequests={partRequests}
          parts={parts}
          canManage={canManage}
          onOpenRequest={onOpenRequest}
        />
      )}
      {section === "orders" && (
        <OrdersSection
          orders={orders}
          receptions={receptions}
          canManage={canManage}
          initialOrderId={initialOrderId}
          onOpenRequest={onOpenRequest}
        />
      )}
      {section === "movements" && (
        <MovementsSection receptions={receptions} canManage={canManage} />
      )}
      {section === "history" && (
        <HistorySection
          orders={orders}
          receptions={receptions}
          canManage={canManage}
          onOpenRequest={onOpenRequest}
        />
      )}
    </div>
  );
}
