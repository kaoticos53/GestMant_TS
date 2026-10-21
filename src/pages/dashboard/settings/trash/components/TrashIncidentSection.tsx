import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { WithdrawnIncidentItem } from "@/convex/_incidents/trash";
import { reporterNoticeText } from "@/lib/incidentMail";
import { trashRemainingLabel } from "@/lib/trash";
import { INCIDENT_STATUS_META, formatDateTime } from "@/lib/workshop";
import { ArchiveRestore, Trash2 } from "lucide-react";
import { TrashSection } from "./TrashSection";

interface TrashIncidentSectionProps {
  items: WithdrawnIncidentItem[];
  busyId: string | null;
  onRestore: (item: WithdrawnIncidentItem) => void | Promise<void>;
  onDelete: (item: WithdrawnIncidentItem) => void;
}

/**
 * Sección de visualización y acciones para incidencias retiradas a la papelera.
 */
export function TrashIncidentSection({
  items,
  busyId,
  onRestore,
  onDelete,
}: TrashIncidentSectionProps) {
  if (items.length === 0) return null;

  return (
    <TrashSection title="Incidencias retiradas" count={items.length}>
      {items.map((item) => {
        const meta =
          INCIDENT_STATUS_META[item.status] ?? INCIDENT_STATUS_META.reported;
        return (
          <article
            key={item.id}
            className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border/70 bg-background/60 p-3"
          >
            <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-semibold text-muted-foreground">
                  {item.reference}
                </span>
                <Badge variant="outline" className={meta.badgeClassName}>
                  {meta.label}
                </Badge>
                <span className="text-[11px] font-medium uppercase tracking-wide text-destructive">
                  {trashRemainingLabel(item.purgeAt)}
                </span>
              </div>
              <p className="text-sm font-medium leading-5">
                {[item.equipmentKind, item.model].filter(Boolean).join(" ") ||
                  "Incidencia sin equipo"}
              </p>
              {item.description !== "" && (
                <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                  {item.description}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Retirada el {formatDateTime(item.deletedAt)}
                {item.deletedBy ? ` por ${item.deletedBy}` : ""}
                {item.deletedReason ? ` · ${item.deletedReason}` : ""}
                {item.archived ? " · saldrá del archivo al recuperarla" : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                Aviso a quien notificó: {reporterNoticeText(item)}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={busyId === item.id}
                onClick={() => void onRestore(item)}
              >
                <ArchiveRestore className="size-4" />
                Recuperar
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5 text-destructive hover:text-destructive"
                disabled={busyId === item.id}
                onClick={() => onDelete(item)}
              >
                <Trash2 className="size-4" />
                Borrar ya
              </Button>
            </div>
          </article>
        );
      })}
    </TrashSection>
  );
}
