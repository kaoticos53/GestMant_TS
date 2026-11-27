import { useState } from "react";
import {
  Activity,
  ArrowRight,
  HardDrive,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AnalyticsSystemHealth } from "@/lib/analytics";
import type { JobLogFilter } from "@/lib/backgroundJobs";
import { formatDateTime } from "@/lib/workshop";
import { KpiCard } from "../components/AnalyticsPrimitives";
import { BackgroundJobsLogDialog } from "../components/BackgroundJobsLogDialog";

export interface SystemLensProps {
  health: AnalyticsSystemHealth;
  periodLabel: string;
  onOpenSettings?: () => void;
  onOpenUsers?: () => void;
  onOpenAudit?: () => void;
}

export function SystemLens({
  health,
  periodLabel,
  onOpenSettings,
  onOpenUsers,
  onOpenAudit,
}: SystemLensProps) {
  const hasAlerts = health.unreadableFiles > 0 || health.failedJobs > 0;
  const [jobsLog, setJobsLog] = useState<JobLogFilter | null>(null);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          testId="kpi-system-storage"
          label="Almacenamiento y limpieza"
          icon={<HardDrive className="size-4 text-signal" />}
          value={health.trashFilesCount}
          highlight={
            health.unreadableFiles > 0
              ? `${health.unreadableFiles} ilegibles`
              : "En papelera"
          }
          highlightClassName={
            health.unreadableFiles > 0
              ? "text-rose-600 dark:text-rose-400"
              : "text-muted-foreground"
          }
          footerText={
            health.lastCleanupAt !== null
              ? `Última limpieza: ${formatDateTime(health.lastCleanupAt)}`
              : "Sin pasadas registradas aún"
          }
          onClick={onOpenSettings}
        />

        <KpiCard
          testId="kpi-system-jobs"
          label="Trabajos en segundo plano"
          icon={<Activity className="size-4 text-amber-600 dark:text-amber-400" />}
          value={health.failedJobs}
          highlight={`${health.activeJobs} en curso`}
          highlightClassName="text-signal"
          footerText="Fallidos en los últimos 7 días · ver registro"
          onClick={() =>
            setJobsLog(health.failedJobs > 0 ? "failed" : "all")
          }
        />

        <KpiCard
          testId="kpi-system-users"
          label="Usuarios del taller"
          icon={<Users className="size-4 text-emerald-600 dark:text-emerald-400" />}
          value={health.activeUsers}
          highlight={`${health.inactiveUsers} de baja`}
          highlightClassName="text-muted-foreground"
          footerText="Cuentas activas con acceso al taller"
          onClick={onOpenUsers}
        />

        <KpiCard
          testId="kpi-system-audit"
          label={`Eventos de seguridad (${periodLabel})`}
          icon={<ShieldCheck className="size-4 text-slate-600 dark:text-slate-400" />}
          value={health.recentAuditEvents}
          highlight="Auditoría"
          highlightClassName="text-muted-foreground"
          footerText="Cambios de rol, bajas e intentos bloqueados"
          onClick={onOpenAudit}
        />
      </div>

      <Card className="min-w-0">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-4 shrink-0 text-signal" />
              <span className="truncate">Estado operativo del sistema</span>
            </CardTitle>
            <CardDescription>
              Resumen de mantenimiento y alertas técnicas para administración
            </CardDescription>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setJobsLog("all")}
            >
              Ver trabajos
            </Button>
            {onOpenSettings && (
              <Button variant="ghost" size="sm" onClick={onOpenSettings}>
                Ir a Ajustes
                <ArrowRight className="ml-1 size-3.5" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!hasAlerts ? (
            <p className="py-4 text-sm text-muted-foreground">
              Todo en orden: sin archivos ilegibles ni trabajos fallidos recientes.
            </p>
          ) : (
            <ul className="divide-y text-sm">
              {health.unreadableFiles > 0 && (
                <li className="flex items-center justify-between gap-3 py-2.5">
                  <span>
                    La limpieza detectó archivos que no se pudieron leer en
                    almacenamiento.
                  </span>
                  <Badge variant="destructive" className="shrink-0">
                    {health.unreadableFiles} ilegibles
                  </Badge>
                </li>
              )}
              {health.failedJobs > 0 && (
                <li className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <span>
                    Hay trabajos en segundo plano terminados con error en los
                    últimos 7 días.
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge variant="destructive">
                      {health.failedJobs} fallidos
                    </Badge>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setJobsLog("failed")}
                    >
                      Ver errores
                    </Button>
                  </span>
                </li>
              )}
            </ul>
          )}
        </CardContent>
      </Card>

      <BackgroundJobsLogDialog
        open={jobsLog !== null}
        onOpenChange={(open) => {
          if (!open) setJobsLog(null);
        }}
        initialFilter={jobsLog ?? "all"}
      />
    </div>
  );
}
