import { Badge } from "@/components/ui/badge";
import type { Doc } from "@/convex/_generated/dataModel";
import {
  PRIORITY_META,
  STATUS_META,
  formatRelativeTime,
} from "@/lib/workshop";
import { ClipboardList } from "lucide-react";

interface EquipmentRequestsSectionProps {
  equipmentId: string;
  relatedCount: number;
  shownRequests: Doc<"partRequests">[];
  onViewRequests: (equipmentId: string) => void;
}

/**
 * Sección de peticiones de repuesto vinculadas al equipo con acceso rápido a la cola.
 */
export function EquipmentRequestsSection({
  equipmentId,
  relatedCount,
  shownRequests,
  onViewRequests,
}: EquipmentRequestsSectionProps) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <ClipboardList className="size-3.5" />
        Peticiones de este equipo
      </p>
      {relatedCount === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
          Todavía no hay peticiones vinculadas a este equipo.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-border/70">
          {shownRequests.map((request) => {
            const status =
              STATUS_META[request.status] ?? STATUS_META.pending;
            const priority = PRIORITY_META[request.priority];
            return (
              <li key={request._id}>
                <button
                  type="button"
                  onClick={() => onViewRequests(equipmentId)}
                  className="flex w-full items-center justify-between gap-3 py-2.5 text-left transition-colors hover:text-signal"
                  title="Ver estas peticiones en la cola"
                >
                  <span className="min-w-0">
                    <span className="font-mono text-xs text-muted-foreground">
                      {request.reference}
                    </span>
                    <span className="block truncate text-sm">
                      {request.requesterName}
                      {request.requesterTeam
                        ? ` · ${request.requesterTeam}`
                        : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <Badge
                      variant="outline"
                      className={priority.badgeClassName}
                    >
                      {priority.label}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={status.badgeClassName}
                    >
                      {status.label}
                    </Badge>
                    <span className="hidden text-xs text-muted-foreground sm:block">
                      {formatRelativeTime(request.createdAt)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {relatedCount > shownRequests.length && (
        <p className="mt-2 text-xs text-muted-foreground">
          y {relatedCount - shownRequests.length} peticiones más…
        </p>
      )}
    </div>
  );
}
