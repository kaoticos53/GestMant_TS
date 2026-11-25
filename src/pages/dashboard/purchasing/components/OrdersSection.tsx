import { useMemo, useState } from "react";
import { DataTableToolbar } from "@/components/DataTableToolbar";
import { TablePagination } from "@/components/TablePagination";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Id } from "@/convex/_generated/dataModel";
import { useTablePagination } from "@/hooks/use-table-pagination";
import {
  PURCHASE_ORDER_STATUS_META,
  type PurchaseOrderStatus,
} from "@/lib/purchasing";
import { OrderSheet } from "../dialogs/OrderSheet";
import { useOrderActionDialogs } from "../hooks/useOrderActionDialogs";
import {
  OrderActionDialogs,
  OrdersEmptyState,
  PurchaseOrderCard,
} from "./orders";
import type { OrdersSectionProps } from "./orders";

export type { OrdersSectionProps };

export function OrdersSection({
  orders,
  receptions,
  canManage,
  initialOrderId = null,
  onOpenRequest,
}: OrdersSectionProps) {
  const [selectedOrderId, setSelectedOrderId] =
    useState<Id<"purchaseOrders"> | null>(null);
  const [dismissedInitialId, setDismissedInitialId] =
    useState<Id<"purchaseOrders"> | null>(null);
  const [prevInitialOrderId, setPrevInitialOrderId] =
    useState<Id<"purchaseOrders"> | null>(initialOrderId);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | PurchaseOrderStatus>(
    "all",
  );

  if (initialOrderId !== prevInitialOrderId) {
    setPrevInitialOrderId(initialOrderId);
    setSelectedOrderId(null);
    setDismissedInitialId(null);
  }

  const dialogs = useOrderActionDialogs();

  const filteredOrders = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return orders.filter((order) => {
      if (statusFilter !== "all" && order.status !== statusFilter) return false;
      if (!needle) return true;
      return (
        order.reference.toLowerCase().includes(needle) ||
        order.supplier.toLowerCase().includes(needle) ||
        (order.solicitudeCode ?? "").toLowerCase().includes(needle) ||
        order.requestRefs.some((ref) =>
          ref.reference.toLowerCase().includes(needle),
        ) ||
        order.lines.some(
          (line) =>
            line.code.toLowerCase().includes(needle) ||
            line.name.toLowerCase().includes(needle),
        )
      );
    });
  }, [orders, search, statusFilter]);

  const paging = useTablePagination({
    total: filteredOrders.length,
    rowsFit: 12,
    resetKey: `${search}|${statusFilter}`,
  });
  const visibleOrders = filteredOrders.slice(paging.from - 1, paging.to);
  const hasActiveFilters = search.trim() !== "" || statusFilter !== "all";
  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
  };

  const activeOrderId =
    selectedOrderId ??
    (initialOrderId && initialOrderId !== dismissedInitialId
      ? initialOrderId
      : null);

  // La orden abierta se refresca con la última versión que llega del backend.
  const actual = activeOrderId
    ? (orders.find((order) => order._id === activeOrderId) ?? null)
    : null;

  const closeOpenOrder = () => {
    setSelectedOrderId(null);
    if (initialOrderId) setDismissedInitialId(initialOrderId);
  };

  if (orders.length === 0) {
    return <OrdersEmptyState />;
  }

  return (
    <div className="grid gap-3">
      <DataTableToolbar
        className="rounded-xl border border-border/70 bg-card shadow-sm"
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por orden, proveedor, código de solicitud, petición o repuesto…"
        searchAriaLabel="Buscar órdenes de compra"
        filters={
          <Select
            value={statusFilter}
            onValueChange={(value) =>
              setStatusFilter(value as "all" | PurchaseOrderStatus)
            }
          >
            <SelectTrigger
              className="w-full sm:w-44"
              aria-label="Filtrar por estado"
            >
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              {(
                Object.keys(
                  PURCHASE_ORDER_STATUS_META,
                ) as PurchaseOrderStatus[]
              ).map((status) => (
                <SelectItem key={status} value={status}>
                  {PURCHASE_ORDER_STATUS_META[status].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        hasActiveFilters={hasActiveFilters}
        onResetFilters={clearFilters}
      />

      {filteredOrders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center shadow-sm">
          <p className="text-sm font-medium">
            Ninguna orden coincide con los filtros actuales
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={clearFilters}
          >
            Limpiar filtros
          </Button>
        </div>
      ) : (
        visibleOrders.map((order) => (
          <PurchaseOrderCard
            key={order._id}
            order={order}
            onOpenOrder={(ord) => setSelectedOrderId(ord._id)}
            onReceiveOrder={dialogs.setRecibiendo}
            onCancelOrder={dialogs.startCancel}
            onOpenRequest={onOpenRequest}
          />
        ))
      )}

      {filteredOrders.length > 0 && (
        <TablePagination
          className="rounded-xl border border-border/70 bg-card shadow-sm"
          paging={paging}
          singular="orden"
          plural="órdenes"
          detail={hasActiveFilters ? `${orders.length} en total` : undefined}
        />
      )}

      {actual && (
        <OrderSheet
          order={actual}
          receptions={receptions.filter((row) => row.orderId === actual._id)}
          canManage={canManage}
          onClose={closeOpenOrder}
          onReceive={() => {
            dialogs.setRecibiendo(actual);
            closeOpenOrder();
          }}
          onCancel={() => {
            dialogs.startCancel(actual);
            closeOpenOrder();
          }}
          onOpenRequest={onOpenRequest}
        />
      )}

      <OrderActionDialogs
        recibiendo={dialogs.recibiendo}
        onCloseReceive={() => dialogs.setRecibiendo(null)}
        anulando={dialogs.anulando}
        onCloseCancel={dialogs.closeCancel}
        motivo={dialogs.motivo}
        onMotivoChange={dialogs.setMotivo}
      />
    </div>
  );
}
