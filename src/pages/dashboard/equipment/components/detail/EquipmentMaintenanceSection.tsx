import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RichText } from "@/components/RichText";
import type { Doc } from "@/convex/_generated/dataModel";
import { MAINTENANCE_META, formatDate } from "@/lib/workshop";
import { Pencil, Plus, Trash2, Wrench } from "lucide-react";
import type { EquipmentDoc, RecordDoc } from "../../types";

interface EquipmentMaintenanceSectionProps {
  item: EquipmentDoc;
  maintenance: RecordDoc[];
  requests: Doc<"partRequests">[];
  review: { state: "overdue" | "ok" | "none"; dueAt?: number | null };
  canManage?: boolean;
  onNewRecord: () => void;
  onEditRecord: (record: RecordDoc) => void;
  onDeleteRecord: (record: RecordDoc) => void;
}

/**
 * Sección de intervenciones técnicas y plan de mantenimiento preventivo del equipo.
 */
export function EquipmentMaintenanceSection({
  item,
  maintenance,
  requests,
  review,
  canManage = false,
  onNewRecord,
  onEditRecord,
  onDeleteRecord,
}: EquipmentMaintenanceSectionProps) {
  const reviewBadge =
    review.state === "overdue" ? (
      <Badge
        variant="outline"
        className="border-amber-500/25 bg-amber-500/10 text-amber-700"
      >
        Revisión vencida
      </Badge>
    ) : review.state === "ok" ? (
      <Badge
        variant="outline"
        className="border-emerald-600/25 bg-emerald-600/10 text-emerald-700"
      >
        Revisión al día
      </Badge>
    ) : null;

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Wrench className="size-3.5" />
          Historial de mantenimiento
        </p>
        {canManage && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={onNewRecord}
          >
            <Plus className="size-3.5" />
            Registrar intervención
          </Button>
        )}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {item.maintenanceIntervalDays ? (
          <>
            {reviewBadge}
            <span>
              Plan: cada {item.maintenanceIntervalDays} días
              {review.dueAt
                ? ` · próxima revisión ${formatDate(review.dueAt)}`
                : " · sin primera revisión registrada"}
            </span>
          </>
        ) : (
          <span>Sin plan de mantenimiento preventivo.</span>
        )}
      </div>

      {maintenance.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
          Todavía no hay intervenciones registradas en este equipo.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-border/70">
          {maintenance.map((record) => {
            const meta = MAINTENANCE_META[record.kind];
            const linked = record.requestId
              ? requests.find((req) => req._id === record.requestId)
              : undefined;
            return (
              <li
                key={record._id}
                className="flex items-start justify-between gap-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className={meta.badgeClassName}>
                      {meta.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(record.performedAt)}
                    </span>
                    {record.technician && (
                      <span className="text-xs text-muted-foreground">
                        · {record.technician}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm font-medium">{record.title}</p>
                  {record.description && (
                    <RichText
                      value={record.description}
                      className="mt-0.5 text-xs leading-5 text-muted-foreground"
                    />
                  )}
                  {linked && (
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                      Petición {linked.reference}
                    </p>
                  )}
                </div>
                {canManage && (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label="Editar intervención"
                      onClick={() => onEditRecord(record)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-destructive"
                      aria-label="Borrar intervención"
                      onClick={() => onDeleteRecord(record)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
