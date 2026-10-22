import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RichText } from "@/components/RichText";
import { formatPublicCode } from "@/lib/publicCode";
import { reporterNoticeText } from "@/lib/incidentMail";
import { formatDateTime } from "@/lib/workshop";
import { getEquipmentInventoryInfo } from "./helpers";
import type { IncidentNotificationSectionProps } from "./types";

export function IncidentNotificationSection({
  incident,
  linkedEquipment,
  canWork,
  onCorrectEquipment,
  onCreateEquipment,
}: IncidentNotificationSectionProps) {
  const inventoryInfo = getEquipmentInventoryInfo(linkedEquipment);

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Datos de la notificación
        </p>
        {canWork && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs"
            onClick={onCorrectEquipment}
          >
            <Pencil className="size-3.5" />
            Corregir datos del equipo
          </Button>
        )}
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Notificada por</dt>
          <dd>{incident.reporterName}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Puesto</dt>
          <dd>{incident.reporterRole ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Ubicación</dt>
          <dd>{incident.location ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">
            Fecha de notificación
          </dt>
          <dd>{formatDateTime(incident.reportedAt)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Modelo</dt>
          <dd>{incident.model ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Nº de serie</dt>
          <dd className="font-mono">{incident.serialNumber ?? "—"}</dd>
        </div>
        {incident.publicCode && (
          <div className="col-span-2">
            <dt className="text-xs text-muted-foreground">
              Código con el que lo sigue quien notificó
            </dt>
            <dd className="select-all font-mono">
              {formatPublicCode(incident.publicCode)}
            </dd>
          </div>
        )}
        <div className="col-span-2">
          <dt className="text-xs text-muted-foreground">
            Aviso a quien notificó
          </dt>
          <dd>{reporterNoticeText(incident)}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-muted-foreground">Equipo en inventario</dt>
          <dd className="mt-1 flex flex-wrap items-center gap-2">
            {inventoryInfo.isLinked ? (
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">
                  {inventoryInfo.label}
                </span>
                {inventoryInfo.serialNumber && (
                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                    s/n: {inventoryInfo.serialNumber}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-amber-700 dark:text-amber-400">
                  {inventoryInfo.label}
                </span>
                {canWork && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 gap-1 border-amber-500/30 bg-amber-500/10 px-2 text-xs text-amber-700 hover:bg-amber-500/20 dark:text-amber-300"
                    onClick={onCreateEquipment}
                  >
                    <Plus className="size-3" />
                    Dar de alta en inventario
                  </Button>
                )}
              </div>
            )}
          </dd>
        </div>
      </dl>

      <RichText
        value={incident.description}
        className="mt-3 rounded-lg border border-border/70 bg-background/60 p-3 text-sm leading-6"
      />
    </div>
  );
}
