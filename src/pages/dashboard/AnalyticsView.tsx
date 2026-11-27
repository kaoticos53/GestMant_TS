import { useState } from "react";
import { useQuery } from "convex/react";
import { Boxes, ClipboardCheck, ShieldCheck, Wrench } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  getAvailableAnalyticsLenses,
  getDefaultAnalyticsLens,
  readStoredAnalyticsLens,
  writeStoredAnalyticsLens,
  type AnalyticsLensId,
  type AnalyticsPeriodDays,
} from "@/lib/analytics";
import { cn } from "@/lib/utils";
import type { IncidentStatus } from "@/lib/workshop";
import type { RequestFilterId } from "./requests/types";
import { AnalyticsSkeleton } from "./analytics/AnalyticsSkeleton";
import { InventoryPurchasingLens } from "./analytics/lenses/InventoryPurchasingLens";
import { MyDayLens } from "./analytics/lenses/MyDayLens";
import { SystemLens } from "./analytics/lenses/SystemLens";
import { WorkshopLens } from "./analytics/lenses/WorkshopLens";

export interface AnalyticsViewProps {
  onOpenIncidents: () => void;
  onOpenRequests: () => void;
  onOpenMyIncidents?: () => void;
  onOpenMyRequests?: (filter?: "all" | "materialReceived") => void;
  onOpenInventoryLowStock?: () => void;
  onOpenEquipment?: () => void;
  onOpenPurchasingPending?: () => void;
  onOpenPurchasingOrders?: (orderId?: Id<"purchaseOrders">) => void;
  onOpenIncident?: (id: Id<"incidents">) => void;
  onOpenRequest?: (id: Id<"partRequests">) => void;
  onOpenRequestsByStatus?: (status: RequestFilterId) => void;
  onSelectIncidentStatus?: (status: IncidentStatus) => void;
  onSelectPartCategory?: (category: string) => void;
  onSelectEquipment?: (label: string) => void;
  onSelectPart?: (code: string) => void;
  onOpenSettings?: () => void;
  onOpenUsers?: () => void;
  onOpenAudit?: () => void;
}

type PeriodOption = "7" | "30" | "90" | "all";

const PERIOD_OPTIONS: ReadonlyArray<{
  id: PeriodOption;
  label: string;
  short: string;
}> = [
    { id: "7", label: "7 días", short: "7d" },
    { id: "30", label: "30 días", short: "30d" },
    { id: "90", label: "90 días", short: "90d" },
    { id: "all", label: "Todo", short: "Todo" },
  ];

const LENS_META: Record<
  AnalyticsLensId,
  { label: string; icon: typeof ClipboardCheck }
> = {
  my_day: { label: "Mi jornada", icon: ClipboardCheck },
  workshop: { label: "Taller", icon: Wrench },
  inventory_purchasing: { label: "Almacén y compras", icon: Boxes },
  system: { label: "Sistema", icon: ShieldCheck },
};

export function AnalyticsView({
  onOpenIncidents,
  onOpenRequests,
  onOpenMyIncidents,
  onOpenMyRequests,
  onOpenInventoryLowStock,
  onOpenEquipment,
  onOpenPurchasingPending,
  onOpenPurchasingOrders,
  onOpenIncident,
  onOpenRequest,
  onOpenRequestsByStatus,
  onSelectIncidentStatus,
  onSelectPartCategory,
  onSelectEquipment,
  onSelectPart,
  onOpenSettings,
  onOpenUsers,
  onOpenAudit,
}: AnalyticsViewProps) {
  const [period, setPeriod] = useState<PeriodOption>("all");
  const [selectedLens, setSelectedLens] = useState<AnalyticsLensId | null>(
    () => readStoredAnalyticsLens(),
  );
  const periodDays =
    period === "all" ? undefined : (Number(period) as AnalyticsPeriodDays);
  const analytics = useQuery(
    api.dashboard.analytics,
    periodDays !== undefined ? { periodDays } : {},
  );
  const periodShort =
    PERIOD_OPTIONS.find((item) => item.id === period)?.short ?? "30d";
  const effectivePeriodLabel = period === "all" ? "30d" : periodShort;

  if (analytics === undefined) {
    return <AnalyticsSkeleton />;
  }

  if (analytics === null) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
        No hay datos analíticos disponibles para tu perfil actual.
      </div>
    );
  }

  const availableLenses = getAvailableAnalyticsLenses(analytics.capabilities);
  if (availableLenses.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
        Tu rol actual no tiene módulos operativos visibles en el panel analítico.
      </div>
    );
  }

  const defaultLens = getDefaultAnalyticsLens(analytics.capabilities);
  const activeLens =
    selectedLens && availableLenses.includes(selectedLens)
      ? selectedLens
      : defaultLens;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {availableLenses.length > 1 && (
            <div
              role="tablist"
              aria-label="Vistas del panel"
              className="inline-flex flex-wrap items-center gap-0.5 rounded-lg border border-border/70 bg-card p-1 shadow-xs"
            >
              {availableLenses.map((lensId) => {
                const meta = LENS_META[lensId];
                const Icon = meta.icon;
                const isSelected = activeLens === lensId;
                return (
                  <button
                    key={lensId}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => {
                      setSelectedLens(lensId);
                      writeStoredAnalyticsLens(lensId);
                    }}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="size-3.5 shrink-0" />
                    <span>{meta.label}</span>
                  </button>
                );
              })}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {period === "all"
              ? "Estado actual en vivo · histórico y movimientos en 30d"
              : `Trabajo abierto en vivo · histórico y movimientos de los últimos ${period} días`}
          </p>
        </div>

        <div
          role="group"
          aria-label="Periodo de analítica"
          className="inline-flex items-center gap-0.5 rounded-lg border border-border/70 bg-card p-1 shadow-xs"
        >
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={period === option.id}
              onClick={() => setPeriod(option.id)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                period === option.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {activeLens === "my_day" && (
        <MyDayLens
          analytics={analytics}
          onOpenIncidents={onOpenIncidents}
          onOpenRequests={onOpenRequests}
          onOpenMyIncidents={onOpenMyIncidents}
          onOpenMyRequests={onOpenMyRequests}
          onOpenEquipment={onOpenEquipment}
          onOpenIncident={onOpenIncident}
          onOpenRequest={onOpenRequest}
          onOpenRequestsByStatus={onOpenRequestsByStatus}
          onSelectIncidentStatus={onSelectIncidentStatus}
          onSelectEquipment={onSelectEquipment}
        />
      )}

      {activeLens === "workshop" && (
        <WorkshopLens
          analytics={analytics}
          periodLabel={effectivePeriodLabel}
          onOpenIncidents={onOpenIncidents}
          onOpenEquipment={onOpenEquipment}
          onOpenIncident={onOpenIncident}
          onSelectIncidentStatus={onSelectIncidentStatus}
          onSelectEquipment={onSelectEquipment}
        />
      )}

      {activeLens === "inventory_purchasing" && (
        <InventoryPurchasingLens
          analytics={analytics}
          periodLabel={effectivePeriodLabel}
          onOpenRequests={onOpenRequests}
          onOpenRequestsByStatus={onOpenRequestsByStatus}
          onOpenInventoryLowStock={onOpenInventoryLowStock}
          onOpenPurchasingPending={onOpenPurchasingPending}
          onOpenPurchasingOrders={onOpenPurchasingOrders}
          onSelectPartCategory={onSelectPartCategory}
          onSelectPart={onSelectPart}
        />
      )}

      {activeLens === "system" && analytics.systemHealth && (
        <SystemLens
          health={analytics.systemHealth}
          periodLabel={effectivePeriodLabel}
          onOpenSettings={onOpenSettings}
          onOpenUsers={onOpenUsers}
          onOpenAudit={onOpenAudit}
        />
      )}
    </div>
  );
}
