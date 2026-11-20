import {
  AlertTriangle,
  Boxes,
  ClipboardList,
  Clock3,
  ShoppingCart,
  Siren,
  Wrench,
} from "lucide-react";
import type { WorkshopAnalyticsResult } from "@/lib/analytics";

interface AnalyticsKpiGridProps {
  kpis: WorkshopAnalyticsResult["kpis"];
  onOpenIncidents: () => void;
  onOpenRequests: () => void;
  onOpenInventoryLowStock: () => void;
  onOpenEquipment: () => void;
}

export function AnalyticsKpiGrid({
  kpis,
  onOpenIncidents,
  onOpenRequests,
  onOpenInventoryLowStock,
  onOpenEquipment,
}: AnalyticsKpiGridProps) {
  const avgResolutionLabel =
    kpis.avgResolutionHours === null
      ? "Sin datos"
      : `${kpis.avgResolutionHours} h media`;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <button
        type="button"
        data-testid="kpi-incidents"
        onClick={onOpenIncidents}
        className="group rounded-xl border bg-card p-4 text-left shadow-xs transition-colors hover:border-primary/40 hover:bg-accent/30"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Incidencias activas
          </span>
          <Siren className="size-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-2">
          <span className="text-2xl font-bold tracking-tight tabular-nums">
            {kpis.activeIncidents}
          </span>
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
            {kpis.resolutionRatePct}% resueltas
          </span>
        </div>
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <Clock3 className="size-3.5 shrink-0" />
          <span>
            {kpis.resolvedLast30d} cerradas (30d) · {avgResolutionLabel}
          </span>
        </p>
      </button>

      <button
        type="button"
        data-testid="kpi-requests"
        onClick={onOpenRequests}
        className="group rounded-xl border bg-card p-4 text-left shadow-xs transition-colors hover:border-primary/40 hover:bg-accent/30"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Peticiones activas
          </span>
          <ClipboardList className="size-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-2">
          <span className="text-2xl font-bold tracking-tight tabular-nums">
            {kpis.activeRequests}
          </span>
          <span className="text-xs font-medium text-rose-600 dark:text-rose-400">
            {kpis.urgentRequests} urgentes
          </span>
        </div>
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <ShoppingCart className="size-3.5 shrink-0" />
          <span>{kpis.pendingPurchases} compras pendientes</span>
        </p>
      </button>

      <button
        type="button"
        data-testid="kpi-inventory"
        onClick={onOpenInventoryLowStock}
        className="group rounded-xl border bg-card p-4 text-left shadow-xs transition-colors hover:border-primary/40 hover:bg-accent/30"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Stock bajo / agotado
          </span>
          <AlertTriangle className="size-4 text-rose-600 dark:text-rose-400" />
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-2">
          <span className="text-2xl font-bold tracking-tight tabular-nums">
            {kpis.lowStockParts}
          </span>
          <span className="text-xs font-medium text-rose-600 dark:text-rose-400">
            {kpis.outOfStockParts} sin stock
          </span>
        </div>
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <Boxes className="size-3.5 shrink-0" />
          <span>{kpis.totalParts} repuestos en inventario</span>
        </p>
      </button>

      <button
        type="button"
        data-testid="kpi-equipment"
        onClick={onOpenEquipment}
        className="group rounded-xl border bg-card p-4 text-left shadow-xs transition-colors hover:border-primary/40 hover:bg-accent/30"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Equipos registrados
          </span>
          <Wrench className="size-4 text-slate-600 dark:text-slate-400" />
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-2">
          <span className="text-2xl font-bold tracking-tight tabular-nums">
            {kpis.totalEquipment}
          </span>
          <span className="text-xs text-muted-foreground">
            {kpis.decommissionedEquipment} de baja
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {kpis.totalEquipment - kpis.decommissionedEquipment} equipos activos en taller
        </p>
      </button>
    </div>
  );
}
