import { Archive, Check, PackageCheck, Wrench } from "lucide-react";
import { Can } from "@/components/AbilityProvider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { asRequest } from "@/lib/abilities";
import { cn } from "@/lib/utils";
import { getRequestActionFlags, getRequestUnitsSummary } from "./helpers";
import type { RequestCardFooterProps } from "./types";

export function RequestCardFooter({
  request,
  compact,
  archiving,
  selected = false,
  onToggleSelect,
  onOpen,
  onAssociate,
  onApprove,
  onReject,
  onIssue,
  onArchive,
}: RequestCardFooterProps) {
  const flags = getRequestActionFlags(request.status, request.lines.length > 0);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-t border-border/70",
        compact ? "mt-2 pt-2" : "mt-4 pt-4",
      )}
    >
      <span className="text-xs text-muted-foreground">
        {getRequestUnitsSummary(request.lines)}
      </span>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onOpen}>
          Ver detalle
        </Button>
        {flags.canReject && (
          <Can I="decide" this={asRequest(request)}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onReject}
            >
              Rechazar
            </Button>
          </Can>
        )}
        {flags.canAssociate && (
          <Can I="update" this={asRequest(request)}>
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              onClick={onAssociate}
            >
              <Wrench className="size-3.5" />
              Asociar repuesto
            </Button>
          </Can>
        )}
        {flags.canApprove && (
          <Can I="decide" this={asRequest(request)}>
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              onClick={onApprove}
            >
              <Check className="size-3.5" />
              Aprobar
            </Button>
          </Can>
        )}
        {flags.canIssue && (
          <Can I="update" this={asRequest(request)}>
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              onClick={onIssue}
            >
              <PackageCheck className="size-3.5" />
              Entregar material
            </Button>
          </Can>
        )}
        {flags.canArchive && (
          <Can I="archive" this={asRequest(request)}>
            <div className="flex items-center gap-2">
              {onToggleSelect && (
                <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border/70 px-2 py-1 text-xs text-muted-foreground hover:text-foreground">
                  <Checkbox
                    checked={selected}
                    onCheckedChange={() => onToggleSelect()}
                    aria-label={`Seleccionar ${request.reference}`}
                  />
                  <span>Sel.</span>
                </label>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                title={`Mandar ${request.reference} al archivo`}
                aria-label={`Archivar ${request.reference}`}
                disabled={archiving}
                onClick={onArchive}
              >
                <Archive className="size-3.5" />
                Archivar
              </Button>
            </div>
          </Can>
        )}
      </div>
    </div>
  );
}
