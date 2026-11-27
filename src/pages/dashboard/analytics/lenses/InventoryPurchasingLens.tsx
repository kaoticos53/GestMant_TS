import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  ClipboardList,
  PackageCheck,
  PackageX,
  ShoppingCart,
  Truck,
} from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import { DetailTitleButton } from "@/components/DetailTitleButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { WorkshopAnalyticsResult } from "@/lib/analytics";
import type { RequestFilterId } from "../../requests/types";
import {
  PartsByCategoryChart,
  StockMovementsChart,
} from "../AnalyticsChartsGrid";
import { KpiCard } from "../components/AnalyticsPrimitives";

export interface InventoryPurchasingLensProps {
  analytics: WorkshopAnalyticsResult;
  periodLabel: string;
  onOpenRequests: () => void;
  onOpenRequestsByStatus?: (status: RequestFilterId) => void;
  onOpenInventoryLowStock?: () => void;
  onOpenPurchasingPending?: () => void;
  onOpenPurchasingOrders?: (orderId?: Id<"purchaseOrders">) => void;
  onSelectPartCategory?: (category: string) => void;
  onSelectPart?: (code: string) => void;
}

export function InventoryPurchasingLens({
  analytics,
  periodLabel,
  onOpenRequests,
  onOpenRequestsByStatus,
  onOpenInventoryLowStock,
  onOpenPurchasingPending,
  onOpenPurchasingOrders,
  onSelectPartCategory,
  onSelectPart,
}: InventoryPurchasingLensProps) {
  const { capabilities, kpis, purchasingSummary } = analytics;
  const canRequestsQueue = capabilities.decideRequests || capabilities.requests;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {canRequestsQueue && (
          <>
            <KpiCard
              testId="kpi-requests"
              label="Peticiones pendientes"
              icon={
                <ClipboardList className="size-4 text-blue-600 dark:text-blue-400" />
              }
              value={purchasingSummary.pendingRequestsToDecide}
              highlight={`${kpis.urgentRequests} urgentes`}
              highlightClassName="text-rose-600 dark:text-rose-400"
              footerText={
                purchasingSummary.requestsWithoutReference > 0
                  ? `${purchasingSummary.requestsWithoutReference} sin referencia · ${kpis.activeRequests} activas`
                  : `${kpis.activeRequests} peticiones activas en curso`
              }
              onClick={() =>
                onOpenRequestsByStatus
                  ? onOpenRequestsByStatus("pending")
                  : onOpenRequests()
              }
            />

            <KpiCard
              testId="kpi-material-received"
              label="Recibidas sin entregar"
              icon={
                <PackageCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
              }
              value={purchasingSummary.materialReceivedPendingDelivery}
              highlight="Listas en almacén"
              highlightClassName="text-emerald-600 dark:text-emerald-400"
              footerText="Peticiones con compra recibida por entregar"
              onClick={() =>
                onOpenRequestsByStatus
                  ? onOpenRequestsByStatus("materialReceived")
                  : onOpenRequests()
              }
            />
          </>
        )}

        {capabilities.purchasing && onOpenPurchasingPending && (
          <KpiCard
            testId="kpi-purchasing"
            label="Compras sin tratar"
            icon={
              <ShoppingCart className="size-4 text-status-warning-foreground" />
            }
            value={kpis.pendingPurchases}
            highlight={`${purchasingSummary.openOrdersCount} órdenes abiertas`}
            highlightClassName="text-signal"
            footerText="Pendientes de agrupar en orden de compra"
            onClick={onOpenPurchasingPending}
          />
        )}

        {capabilities.inventory && onOpenInventoryLowStock && (
          <KpiCard
            testId="kpi-inventory"
            label="Stock bajo / agotado"
            icon={
              <AlertTriangle className="size-4 text-rose-600 dark:text-rose-400" />
            }
            value={kpis.lowStockParts}
            highlight={`${kpis.outOfStockParts} sin stock`}
            highlightClassName="text-rose-600 dark:text-rose-400"
            footerIcon={<Boxes className="size-3.5" />}
            footerText={`${kpis.totalParts} repuestos en catálogo`}
            onClick={onOpenInventoryLowStock}
          />
        )}
      </div>

      {capabilities.inventory && (
        <div className="grid gap-4 lg:grid-cols-2">
          <PartsByCategoryChart
            data={analytics.partsByCategory}
            onSelectPartCategory={onSelectPartCategory}
          />
          <StockMovementsChart
            data={analytics.stockMovementsSummary}
            periodLabel={periodLabel}
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {capabilities.inventory && (
          <Card className="min-w-0">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  <PackageX className="size-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <span className="truncate">Repuestos en nivel crítico</span>
                </CardTitle>
                <CardDescription>
                  Referencias agotadas o por debajo del stock mínimo
                </CardDescription>
              </div>
              {onOpenInventoryLowStock && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={onOpenInventoryLowStock}
                >
                  Ir a inventario
                  <ArrowRight className="ml-1 size-3.5" />
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {analytics.criticalParts.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No hay repuestos en nivel crítico.
                </p>
              ) : (
                <ul className="divide-y">
                  {analytics.criticalParts.map((part) => (
                    <li
                      key={part.code}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <DetailTitleButton
                          onClick={() =>
                            onSelectPart
                              ? onSelectPart(part.code)
                              : onOpenInventoryLowStock?.()
                          }
                        >
                          {part.name}
                        </DetailTitleButton>
                        <p className="truncate text-xs text-muted-foreground">
                          {part.code}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {part.onOrder && (
                          <Badge variant="outline" className="text-xs">
                            En pedido
                          </Badge>
                        )}
                        <Badge
                          variant={part.stock <= 0 ? "destructive" : "secondary"}
                          className="tabular-nums"
                        >
                          {part.stock} / {part.minStock} {part.unit}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {capabilities.purchasing && (
          <Card className="min-w-0">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Truck className="size-4 shrink-0 text-signal" />
                  <span className="truncate">Órdenes de compra abiertas</span>
                </CardTitle>
                <CardDescription>
                  Pedidos a proveedor pendientes o con recepción parcial
                </CardDescription>
              </div>
              {onOpenPurchasingOrders && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={() => onOpenPurchasingOrders()}
                >
                  Ver órdenes
                  <ArrowRight className="ml-1 size-3.5" />
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {purchasingSummary.openOrders.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No hay órdenes de compra esperando material.
                </p>
              ) : (
                <ul className="divide-y">
                  {purchasingSummary.openOrders.map((order) => (
                    <li
                      key={order.id}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <DetailTitleButton
                          onClick={() =>
                            onOpenPurchasingOrders
                              ? onOpenPurchasingOrders(
                                  order.id as Id<"purchaseOrders">,
                                )
                              : onOpenPurchasingPending?.()
                          }
                        >
                          {order.reference} · {order.supplier}
                        </DetailTitleButton>
                        <p className="truncate text-xs text-muted-foreground">
                          Hace {order.ageDays} d ·{" "}
                          {order.status === "partial"
                            ? "Recepción parcial"
                            : "Pedida"}
                        </p>
                      </div>
                      <Badge variant="secondary" className="shrink-0 tabular-nums">
                        {order.pendingUnits} / {order.totalUnits} pdte
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
