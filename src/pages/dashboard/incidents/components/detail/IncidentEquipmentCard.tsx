import { Pencil, Plus, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RichText } from "@/components/RichText";
import { formatPublicCode } from "@/lib/publicCode";
import { reporterNoticeText } from "@/lib/incidentMail";
import { equipmentLabel, formatDateTime } from "@/lib/workshop";
import type { EquipmentDoc, IncidentDoc } from "../../types";

export interface IncidentEquipmentCardProps {
  incident: IncidentDoc;
  linkedEquipment: EquipmentDoc | null;
  canWork: boolean;
  inWorkshop: boolean;
  onCorrectEquipment: () => void;
  onCreateEquipment: () => void;
}

export function IncidentEquipmentCard({
  incident,
  linkedEquipment,
  canWork,
  inWorkshop,
  onCorrectEquipment,
  onCreateEquipment,
}: IncidentEquipmentCardProps) {
  return (
    <div className="space-y-4">
      {/* Datos de la notificación */}
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
              {linkedEquipment ? (
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">
                    {equipmentLabel(linkedEquipment)}
                  </span>
                  {linkedEquipment.serialNumber && (
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                      s/n: {linkedEquipment.serialNumber}
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-amber-700 dark:text-amber-400">
                    Equipo no inventariado
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

      {/* Asignación */}
      <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Asignación
        </p>
        <div className="mt-2 grid gap-2 text-sm">
          <p>
            <span className="text-muted-foreground">Técnico: </span>
            {incident.assigneeName ?? "Sin asignar"}
          </p>
          {inWorkshop && (
            <p>
              <span className="text-muted-foreground">Entrada a taller: </span>
              {incident.workshopAssigneeName ?? "—"}
            </p>
          )}
          {incident.closedAt && (
            <p>
              <span className="text-muted-foreground">Cerrada: </span>
              {formatDateTime(incident.closedAt)}
            </p>
          )}
          {incident.notes && (
            <RichText
              value={incident.notes}
              className="rounded-lg border border-border/70 bg-background/60 p-3 text-sm leading-6"
            />
          )}
        </div>
      </div>

      {/* Ficha de reparación externa (si la hubiere) */}
      {incident.externalRepair && (
        <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Truck className="size-4 text-indigo-600 dark:text-indigo-400" />
              <p className="text-xs font-medium uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
                Reparación externa
              </p>
            </div>
            <span className="rounded bg-indigo-500/15 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:text-indigo-300">
              {incident.status === "externalRepair"
                ? "En curso en el SAT externo"
                : "Retornada al taller"}
            </span>
          </div>

          <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Empresa externa / SAT</dt>
              <dd className="font-medium text-foreground">
                {incident.externalRepair.companyName}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Fecha de envío</dt>
              <dd>{formatDateTime(incident.externalRepair.sentAt)}</dd>
            </div>
            {(incident.externalRepair.contactName ||
              incident.externalRepair.contactPhone) && (
              <div>
                <dt className="text-xs text-muted-foreground">Contacto SAT</dt>
                <dd>
                  {incident.externalRepair.contactName}
                  {incident.externalRepair.contactPhone && (
                    <span className="text-xs text-muted-foreground ml-1">
                      ({incident.externalRepair.contactPhone})
                    </span>
                  )}
                </dd>
              </div>
            )}
            {incident.externalRepair.receivedAt && (
              <div>
                <dt className="text-xs text-muted-foreground">Fecha de retorno</dt>
                <dd>{formatDateTime(incident.externalRepair.receivedAt)}</dd>
              </div>
            )}
            {incident.externalRepair.cost !== undefined && (
              <div>
                <dt className="text-xs text-muted-foreground">Coste reparación</dt>
                <dd className="font-semibold text-foreground">
                  {incident.externalRepair.cost.toLocaleString("es-ES", {
                    style: "currency",
                    currency: "EUR",
                  })}
                </dd>
              </div>
            )}
            {incident.externalRepair.repairNotes && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted-foreground">Informe del SAT externo</dt>
                <dd className="rounded bg-background/60 p-2.5 text-xs border border-border/40 mt-1 leading-5">
                  {incident.externalRepair.repairNotes}
                </dd>
              </div>
            )}
            {incident.externalRepair.workshopNotes && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted-foreground">Comprobación en taller</dt>
                <dd className="rounded bg-background/60 p-2.5 text-xs border border-border/40 mt-1 leading-5">
                  {incident.externalRepair.workshopNotes}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </div>
  );
}
