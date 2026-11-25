import { DetailTitleButton } from "@/components/DetailTitleButton";
import type { Id } from "@/convex/_generated/dataModel";
import type { RequestDelivery } from "@/lib/requestFlow";
import { formatDateTime } from "@/lib/workshop";

export interface RequestInfoCardProps {
  requesterName: string;
  requesterTeam?: string;
  equipment?: string;
  createdAt: number;
  decidedAt?: number;
  decidedBy?: string;
  issuedAt?: number;
  delivery: RequestDelivery;
  lastDeliveredAt: number | null;
  incidentId?: Id<"incidents">;
  onOpenIncident?: (id: Id<"incidents">) => void;
}

export function RequestInfoCard({
  requesterName,
  requesterTeam,
  equipment,
  createdAt,
  decidedAt,
  decidedBy,
  issuedAt,
  delivery,
  lastDeliveredAt,
  incidentId,
  onOpenIncident,
}: RequestInfoCardProps) {
  const deliveryValue = issuedAt
    ? formatDateTime(issuedAt)
    : delivery.anyDelivered
      ? `${delivery.deliveredUnits} de ${delivery.totalUnits} unidades entregadas${
          lastDeliveredAt === null
            ? ""
            : ` · última el ${formatDateTime(lastDeliveredAt)}`
        }`
      : "—";

  const details: { label: string; value: string }[] = [
    { label: "Solicitante", value: requesterName },
    { label: "Puesto", value: requesterTeam ?? "—" },
    { label: "Equipo afectado", value: equipment ?? "—" },
    { label: "Creada", value: formatDateTime(createdAt) },
    {
      label: "Decisión",
      value: decidedAt
        ? `${decidedBy ?? "Responsable"} · ${formatDateTime(decidedAt)}`
        : "Pendiente",
    },
    {
      label: "Entrega",
      value: deliveryValue,
    },
  ];

  return (
    <dl className="grid grid-cols-2 gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      {details.map((detail) => (
        <div key={detail.label}>
          <dt className="text-xs text-muted-foreground">{detail.label}</dt>
          <dd className="mt-0.5 text-sm font-medium">{detail.value}</dd>
        </div>
      ))}
      {incidentId && (
        <div className="col-span-2 border-t border-border/60 pt-2">
          <dt className="text-xs text-muted-foreground">Origen</dt>
          <dd className="mt-0.5 text-sm font-medium">
            {onOpenIncident ? (
              <DetailTitleButton
                onClick={() => onOpenIncident(incidentId)}
                className="text-sm font-medium text-signal"
              >
                Incidencia vinculada
              </DetailTitleButton>
            ) : (
              "Incidencia vinculada"
            )}
          </dd>
        </div>
      )}
    </dl>
  );
}
