import {
  ArrowRight,
  ClipboardCheck,
  Clock3,
  Inbox,
  PackageCheck,
  Siren,
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
import { INCIDENT_PRIORITY_META, type IncidentStatus } from "@/lib/workshop";
import type { RequestFilterId } from "../../requests/types";
import {
  IncidentsByPriorityChart,
  IncidentsByStatusChart,
} from "../AnalyticsChartsGrid";
import {
  ExternalRepairsCard,
  KpiCard,
  ProblematicEquipmentCard,
} from "../components/AnalyticsPrimitives";

export interface MyDayLensProps {
  analytics: WorkshopAnalyticsResult;
  onOpenIncidents: () => void;
  onOpenRequests: () => void;
  onOpenEquipment?: () => void;
  onOpenIncident?: (id: Id<"incidents">) => void;
  onOpenRequest?: (id: Id<"partRequests">) => void;
  onOpenRequestsByStatus?: (status: RequestFilterId) => void;
  onSelectIncidentStatus?: (status: IncidentStatus) => void;
  onSelectEquipment?: (label: string) => void;
}

export function MyDayLens({
  analytics,
  onOpenIncidents,
  onOpenRequests,
  onOpenEquipment,
  onOpenIncident,
  onOpenRequest,
  onOpenRequestsByStatus,
  onSelectIncidentStatus,
  onSelectEquipment,
}: MyDayLensProps) {
  const { capabilities, myDay } = analytics;
  const firstStaleMine = analytics.staleWork.find((item) => item.isMine);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {capabilities.incidents && (
          <>
            <KpiCard
              testId="kpi-my-incidents"
              label="Mis incidencias abiertas"
              icon={
                <Siren className="size-4 text-amber-600 dark:text-amber-400" />
              }
              value={myDay.assignedOpenCount}
              highlight={
                myDay.assignedUrgentOrHighCount > 0
                  ? `${myDay.assignedUrgentOrHighCount} prioritarias`
                  : undefined
              }
              highlightClassName="text-rose-600 dark:text-rose-400"
              footerText={`${analytics.kpis.activeIncidents} activas en todo el taller`}
              onClick={onOpenIncidents}
            />

            <KpiCard
              testId="kpi-unassigned"
              label="Sin asignar (notificadas)"
              icon={<Inbox className="size-4 text-signal" />}
              value={myDay.unassignedReportedCount}
              highlight="Cola de entrada"
              highlightClassName="text-signal"
              footerText="Pendientes de que un técnico las tome"
              onClick={() =>
                onSelectIncidentStatus
                  ? onSelectIncidentStatus("reported")
                  : onOpenIncidents()
              }
            />

            <KpiCard
              testId="kpi-my-stale"
              label="Paradas sin constancia"
              icon={
                <Clock3 className="size-4 text-status-warning-foreground" />
              }
              value={myDay.myStaleCount}
              highlight={myDay.myStaleCount > 0 ? "Requiere nota" : "Al día"}
              highlightClassName={
                myDay.myStaleCount > 0
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-emerald-600 dark:text-emerald-400"
              }
              footerText="Asignadas a ti sin nota reciente"
              onClick={() =>
                firstStaleMine && onOpenIncident
                  ? onOpenIncident(firstStaleMine.id as Id<"incidents">)
                  : onOpenIncidents()
              }
            />
          </>
        )}

        {capabilities.requests && (
          <KpiCard
            testId="kpi-my-requests"
            label="Mis peticiones listas"
            icon={
              <PackageCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
            }
            value={myDay.myRequestsReadyCount}
            highlight={
              myDay.myRequestsWaitingCount > 0
                ? `${myDay.myRequestsWaitingCount} en espera`
                : undefined
            }
            highlightClassName="text-muted-foreground"
            footerIcon={<ClipboardCheck className="size-3.5" />}
            footerText="Material recibido o aprobado para recoger"
            onClick={() =>
              onOpenRequestsByStatus
                ? onOpenRequestsByStatus("materialReceived")
                : onOpenRequests()
            }
          />
        )}
      </div>

      {capabilities.incidents && (
        <div className="grid gap-4 lg:grid-cols-2">
          <IncidentsByStatusChart
            data={analytics.incidentsByStatus}
            onSelectIncidentStatus={onSelectIncidentStatus}
          />
          <IncidentsByPriorityChart
            data={analytics.incidentsByPriority}
            onOpenIncidents={onOpenIncidents}
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {capabilities.incidents && (
          <Card className="min-w-0">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Siren className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span className="truncate">Mis incidencias prioritarias</span>
                </CardTitle>
                <CardDescription>
                  Ordenadas por prioridad y antigüedad para empezar la jornada
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0"
                onClick={onOpenIncidents}
              >
                Ver todas
                <ArrowRight className="ml-1 size-3.5" />
              </Button>
            </CardHeader>
            <CardContent>
              {myDay.myPriorityIncidents.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No tienes incidencias abiertas asignadas en este momento.
                </p>
              ) : (
                <ul className="divide-y">
                  {myDay.myPriorityIncidents.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <DetailTitleButton
                          onClick={() =>
                            onOpenIncident
                              ? onOpenIncident(item.id as Id<"incidents">)
                              : onOpenIncidents()
                          }
                        >
                          {item.reference} · {item.label}
                        </DetailTitleButton>
                        <p className="truncate text-xs text-muted-foreground">
                          {item.statusLabel}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          INCIDENT_PRIORITY_META[item.priority].badgeClassName
                        }
                      >
                        {item.priorityLabel}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {capabilities.requests && (
          <Card className="min-w-0">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  <PackageCheck className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span className="truncate">
                    Mis peticiones listas para recoger
                  </span>
                </CardTitle>
                <CardDescription>
                  Material recibido en almacén o apartado a tu nombre
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0"
                onClick={onOpenRequests}
              >
                Ir a peticiones
                <ArrowRight className="ml-1 size-3.5" />
              </Button>
            </CardHeader>
            <CardContent>
              {myDay.myReadyRequests.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No tienes repuestos pendientes de recoger ahora.
                </p>
              ) : (
                <ul className="divide-y">
                  {myDay.myReadyRequests.map((req) => (
                    <li
                      key={req.id}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <DetailTitleButton
                          onClick={() =>
                            onOpenRequest
                              ? onOpenRequest(req.id as Id<"partRequests">)
                              : onOpenRequests()
                          }
                        >
                          {req.reference}
                          {req.equipment ? ` · ${req.equipment}` : ""}
                        </DetailTitleButton>
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        {req.statusLabel}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {capabilities.incidents && (
          <ProblematicEquipmentCard
            items={analytics.topProblematicEquipment}
            canViewEquipment={capabilities.equipment}
            onOpenEquipment={onOpenEquipment}
            onSelectEquipment={onSelectEquipment}
          />
        )}

        {capabilities.incidents && analytics.externalRepairs.length > 0 && (
          <ExternalRepairsCard
            items={analytics.externalRepairs}
            onOpenIncident={onOpenIncident}
            onOpenIncidents={onOpenIncidents}
          />
        )}
      </div>
    </div>
  );
}
