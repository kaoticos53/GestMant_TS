import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { AnalyticsPeriodDays } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import type { IncidentStatus } from "@/lib/workshop";
import { AnalyticsActionLists } from "./analytics/AnalyticsActionLists";
import { AnalyticsChartsGrid } from "./analytics/AnalyticsChartsGrid";
import { AnalyticsKpiGrid } from "./analytics/AnalyticsKpiGrid";
import { AnalyticsSkeleton } from "./analytics/AnalyticsSkeleton";

export interface AnalyticsViewProps {
  onOpenIncidents: () => void;
  onOpenRequests: () => void;
  onOpenInventoryLowStock: () => void;
  onOpenEquipment: () => void;
  onOpenPurchasingPending?: () => void;
  onSelectIncidentStatus?: (status: IncidentStatus) => void;
  onSelectPartCategory?: (category: string) => void;
  onSelectEquipment?: (label: string) => void;
  onSelectPart?: (code: string) => void;
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

export function AnalyticsView({
  onOpenIncidents,
  onOpenRequests,
  onOpenInventoryLowStock,
  onOpenEquipment,
  onOpenPurchasingPending,
  onSelectIncidentStatus,
  onSelectPartCategory,
  onSelectEquipment,
  onSelectPart,
}: AnalyticsViewProps) {
  const [period, setPeriod] = useState<PeriodOption>("all");
  const periodDays =
    period === "all" ? undefined : (Number(period) as AnalyticsPeriodDays);
  const analytics = useQuery(
    api.dashboard.analytics,
    periodDays !== undefined ? { periodDays } : {},
  );
  const periodShort =
    PERIOD_OPTIONS.find((item) => item.id === period)?.short ?? "30d";

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {period === "all"
            ? "Vista completa de histórico (movimientos y cierres recientes en 30d)"
            : `Incidencias y movimientos filtrados en los últimos ${period} días`}
        </p>
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

      <AnalyticsKpiGrid
        kpis={analytics.kpis}
        periodLabel={period === "all" ? "30d" : periodShort}
        onOpenIncidents={onOpenIncidents}
        onOpenRequests={onOpenRequests}
        onOpenInventoryLowStock={onOpenInventoryLowStock}
        onOpenEquipment={onOpenEquipment}
        onOpenPurchasingPending={onOpenPurchasingPending}
      />
      <AnalyticsChartsGrid
        analytics={analytics}
        periodLabel={period === "all" ? "30d" : periodShort}
        onSelectIncidentStatus={onSelectIncidentStatus}
        onSelectPartCategory={onSelectPartCategory}
      />
      <AnalyticsActionLists
        topProblematicEquipment={analytics.topProblematicEquipment}
        criticalParts={analytics.criticalParts}
        onOpenEquipment={onOpenEquipment}
        onOpenInventoryLowStock={onOpenInventoryLowStock}
        onSelectEquipment={onSelectEquipment}
        onSelectPart={onSelectPart}
      />
    </div>
  );
}
