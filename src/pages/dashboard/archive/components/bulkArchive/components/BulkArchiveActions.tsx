import { Button } from "@/components/ui/button";
import { Archive, SlidersHorizontal } from "lucide-react";
import { formatArchiveButtonLabel } from "../helpers";
import type { BulkArchiveActionsProps } from "../types";

export function BulkArchiveActions({
  canArchiveIncidents,
  canArchiveRequests,
  pending,
  onSelectTarget,
  onOpenSettings,
}: BulkArchiveActionsProps) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {canArchiveIncidents && (
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          disabled={pending.incidents === 0}
          onClick={() => onSelectTarget("incidents")}
        >
          <Archive className="size-4" />
          {formatArchiveButtonLabel("incidents", pending.incidents)}
        </Button>
      )}
      {canArchiveRequests && (
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          disabled={pending.requests === 0}
          onClick={() => onSelectTarget("requests")}
        >
          <Archive className="size-4" />
          {formatArchiveButtonLabel("requests", pending.requests)}
        </Button>
      )}
      {onOpenSettings && (
        <Button
          type="button"
          variant="ghost"
          className="gap-2 text-muted-foreground"
          onClick={onOpenSettings}
          title="El archivado automático de cada noche se ajusta en Ajustes del taller"
        >
          <SlidersHorizontal className="size-4" />
          Ajustes del taller
        </Button>
      )}
    </div>
  );
}
