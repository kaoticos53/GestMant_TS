import { Truck } from "lucide-react";
import { formatDateTime } from "@/lib/workshop";
import { formatExternalRepairCost, getExternalRepairBadge } from "./helpers";
import type { IncidentExternalRepairSectionProps } from "./types";

export function IncidentExternalRepairSection({
  incident,
}: IncidentExternalRepairSectionProps) {
  const repair = incident.externalRepair;
  if (!repair) return null;

  const badge = getExternalRepairBadge(incident.status);

  return (
    <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Truck className="size-4 text-indigo-600 dark:text-indigo-400" />
          <p className="text-xs font-medium uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
            Reparación externa
          </p>
        </div>
        <span className="rounded bg-indigo-500/15 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:text-indigo-300">
          {badge.label}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Empresa externa / SAT</dt>
          <dd className="font-medium text-foreground">
            {repair.companyName}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Fecha de envío</dt>
          <dd>{formatDateTime(repair.sentAt)}</dd>
        </div>
        {(repair.contactName || repair.contactPhone) && (
          <div>
            <dt className="text-xs text-muted-foreground">Contacto SAT</dt>
            <dd>
              {repair.contactName}
              {repair.contactPhone && (
                <span className="text-xs text-muted-foreground ml-1">
                  ({repair.contactPhone})
                </span>
              )}
            </dd>
          </div>
        )}
        {repair.receivedAt && (
          <div>
            <dt className="text-xs text-muted-foreground">Fecha de retorno</dt>
            <dd>{formatDateTime(repair.receivedAt)}</dd>
          </div>
        )}
        {repair.cost !== undefined && (
          <div>
            <dt className="text-xs text-muted-foreground">Coste reparación</dt>
            <dd className="font-semibold text-foreground">
              {formatExternalRepairCost(repair.cost)}
            </dd>
          </div>
        )}
        {repair.repairNotes && (
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted-foreground">Informe del SAT externo</dt>
            <dd className="rounded bg-background/60 p-2.5 text-xs border border-border/40 mt-1 leading-5">
              {repair.repairNotes}
            </dd>
          </div>
        )}
        {repair.workshopNotes && (
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted-foreground">Comprobación en taller</dt>
            <dd className="rounded bg-background/60 p-2.5 text-xs border border-border/40 mt-1 leading-5">
              {repair.workshopNotes}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}
