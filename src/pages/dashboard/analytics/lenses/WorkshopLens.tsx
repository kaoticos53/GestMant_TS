import { Clock3, Plane, Siren, Wrench } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import type { WorkshopAnalyticsResult } from "@/lib/analytics";
import type { IncidentStatus } from "@/lib/workshop";
import {
  IncidentsByPriorityChart,
  IncidentsByStatusChart,
  TechnicianWorkloadChart,
  TrendChart,
} from "../AnalyticsChartsGrid";
import {
  ExternalRepairsCard,
  KpiCard,
  ProblematicEquipmentCard,
  StaleWorkCard,
} from "../components/AnalyticsPrimitives";

export interface WorkshopLensProps {
  analytics: WorkshopAnalyticsResult;
  periodLabel: string;
  onOpenIncidents: () => void;
  onOpenEquipment?: () => void;
  onOpenIncident?: (id: Id<"incidents">) => void;
  onSelectIncidentStatus?: (status: IncidentStatus) => void;
  onSelectEquipment?: (label: string) => void;
}

export function WorkshopLens({
  analytics,
  periodLabel,
  onOpenIncidents,
  onOpenEquipment,
  onOpenIncident,
  onSelectIncidentStatus,
  onSelectEquipment,
}: WorkshopLensProps) {
  const { capabilities, kpis } = analytics;
  const avgResolutionLabel =
    kpis.avgResolutionHours === null
      ? "Sin datos"
      : `${kpis.avgResolutionHours} h media`;
  const overdueExternal = analytics.externalRepairs.filter(
    (item) => item.overdue,
  ).length;
  const firstStale = analytics.staleWork[0];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {capabilities.incidents && (
          <>
            <KpiCard
              testId="kpi-incidents"
              label="Incidencias activas"
              icon={
                <Siren className="size-4 text-amber-600 dark:text-amber-400" />
              }
              value={kpis.activeIncidents}
              highlight={`${kpis.resolutionRatePct}% resueltas`}
              highlightClassName="text-emerald-600 dark:text-emerald-400"
              footerIcon={<Clock3 className="size-3.5" />}
              footerText={`${kpis.resolvedLast30d} cerradas (${periodLabel}) · ${avgResolutionLabel}`}
              onClick={onOpenIncidents}
            />

            <KpiCard
              testId="kpi-stale-work"
              label="Paradas sin constancia"
              icon={
                <Clock3 className="size-4 text-status-warning-foreground" />
              }
              value={analytics.staleWork.length}
              highlight={
                analytics.staleWork.length > 0 ? "Revisar seguimiento" : "Al día"
              }
              highlightClassName={
                analytics.staleWork.length > 0
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-emerald-600 dark:text-emerald-400"
              }
              footerText="Incidencias activas sin nota reciente"
              onClick={() =>
                firstStale && onOpenIncident
                  ? onOpenIncident(firstStale.id as Id<"incidents">)
                  : onOpenIncidents()
              }
            />

            <KpiCard
              testId="kpi-external-repairs"
              label="En SAT externo"
              icon={<Plane className="size-4 text-signal" />}
              value={analytics.externalRepairs.length}
              highlight={
                overdueExternal > 0 ? `${overdueExternal} vencidas` : undefined
              }
              highlightClassName="text-rose-600 dark:text-rose-400"
              footerText="Equipos fuera pendientes de recepción"
              onClick={() =>
                onSelectIncidentStatus
                  ? onSelectIncidentStatus("externalRepair")
                  : onOpenIncidents()
              }
            />
          </>
        )}

        {capabilities.equipment && onOpenEquipment && (
          <KpiCard
            testId="kpi-equipment"
            label="Equipos registrados"
            icon={
              <Wrench className="size-4 text-slate-600 dark:text-slate-400" />
            }
            value={kpis.totalEquipment}
            highlight={`${kpis.decommissionedEquipment} de baja`}
            highlightClassName="text-muted-foreground"
            footerText={`${kpis.totalEquipment - kpis.decommissionedEquipment} equipos activos en taller`}
            onClick={onOpenEquipment}
          />
        )}
      </div>

      {capabilities.incidents && (
        <div className="grid gap-4 lg:grid-cols-2">
          <IncidentsByStatusChart
            data={analytics.incidentsByStatus}
            onSelectIncidentStatus={onSelectIncidentStatus}
          />
          <TrendChart
            data={analytics.weeklyTrend}
            granularity={analytics.trendGranularity}
          />
          {capabilities.manageIncidents && (
            <TechnicianWorkloadChart data={analytics.workloadByTechnician} />
          )}
          <IncidentsByPriorityChart
            data={analytics.incidentsByPriority}
            onOpenIncidents={onOpenIncidents}
          />
        </div>
      )}

      {capabilities.incidents && (
        <div className="grid gap-4 lg:grid-cols-2">
          <ProblematicEquipmentCard
            items={analytics.topProblematicEquipment}
            canViewEquipment={capabilities.equipment}
            onOpenEquipment={onOpenEquipment}
            onSelectEquipment={onSelectEquipment}
          />
          <StaleWorkCard
            items={analytics.staleWork}
            onOpenIncident={onOpenIncident}
            onOpenIncidents={onOpenIncidents}
          />
          {analytics.externalRepairs.length > 0 && (
            <ExternalRepairsCard
              items={analytics.externalRepairs}
              onOpenIncident={onOpenIncident}
              onOpenIncidents={onOpenIncidents}
            />
          )}
        </div>
      )}
    </div>
  );
}
