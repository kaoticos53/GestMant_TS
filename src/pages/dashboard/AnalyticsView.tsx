import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AnalyticsActionLists } from "./analytics/AnalyticsActionLists";
import { AnalyticsChartsGrid } from "./analytics/AnalyticsChartsGrid";
import { AnalyticsKpiGrid } from "./analytics/AnalyticsKpiGrid";
import { AnalyticsSkeleton } from "./analytics/AnalyticsSkeleton";

export interface AnalyticsViewProps {
  onOpenIncidents: () => void;
  onOpenRequests: () => void;
  onOpenInventoryLowStock: () => void;
  onOpenEquipment: () => void;
  onSelectEquipment?: (label: string) => void;
  onSelectPart?: (code: string) => void;
}

export function AnalyticsView({
  onOpenIncidents,
  onOpenRequests,
  onOpenInventoryLowStock,
  onOpenEquipment,
  onSelectEquipment,
  onSelectPart,
}: AnalyticsViewProps) {
  const analytics = useQuery(api.dashboard.analytics, {});

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
      <AnalyticsKpiGrid
        kpis={analytics.kpis}
        onOpenIncidents={onOpenIncidents}
        onOpenRequests={onOpenRequests}
        onOpenInventoryLowStock={onOpenInventoryLowStock}
        onOpenEquipment={onOpenEquipment}
      />
      <AnalyticsChartsGrid analytics={analytics} />
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
