import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { isPurchaseRequestUntreated } from "@/lib/purchaseFlow";
import { PurchasingSectionTabs } from "./purchasing/components/PurchasingSectionTabs";
import { PendingSection } from "./purchasing/components/PendingSection";
import { OrdersSection } from "./purchasing/components/OrdersSection";
import { MovementsSection } from "./purchasing/components/MovementsSection";
import { HistorySection } from "./purchasing/components/HistorySection";
import type { PurchasingSection, PurchasingViewProps } from "./purchasing/types";

export type { PurchasingViewProps } from "./purchasing/types";

/**
 * El módulo de compras, de arriba abajo: lo que espera a que alguien monte la
 * orden (agrupado por proveedor, que es como se compra), las órdenes con lo que
 * ha llegado de cada una, los movimientos de recepción con su albarán y el
 * histórico interactivo en formato hoja de cálculo.
 */
export function PurchasingView({ canManage }: PurchasingViewProps) {
  // El módulo carga las tres listas que enseña —lo que espera por proveedor, las
  // órdenes y las recepciones— más lo que necesita para nombrar lo que se pide:
  // el catálogo y las peticiones de repuesto de las que sale cada compra.
  const purchasing = useQuery(api.purchasing.listPurchaseRequests, {});
  const orders = useQuery(api.purchasing.listOrders, {}) ?? [];
  const receptions = useQuery(api.purchasing.listReceptions, {}) ?? [];
  const partRequests =
    useQuery(api.partRequests.list, { includeArchived: true }) ?? [];
  const parts = useQuery(api.spareParts.list) ?? [];
  const purchaseRequests = purchasing?.requests ?? [];

  const [section, setSection] = useState<PurchasingSection>("pending");

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
        />
      )}
      {section === "orders" && (
        <OrdersSection
          orders={orders}
          receptions={receptions}
          canManage={canManage}
        />
      )}
      {section === "movements" && <MovementsSection receptions={receptions} />}
      {section === "history" && (
        <HistorySection orders={orders} receptions={receptions} />
      )}
    </div>
  );
}
