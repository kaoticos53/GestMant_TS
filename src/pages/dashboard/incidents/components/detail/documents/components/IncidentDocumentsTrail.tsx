import { ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { documentTrailLabel, formatDateTime } from "@/lib/workshop";
import type { IncidentDocumentsTrailProps } from "../types";

export function IncidentDocumentsTrail({
  trail,
  canAssign,
}: IncidentDocumentsTrailProps) {
  if (!canAssign) return null;

  return (
    <Collapsible className="mt-3 border-t border-border/70 pt-3">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronDown className="size-3.5" />
          Rastro de cambios
          {trail && ` (${trail.length})`}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ol className="mt-2 space-y-2">
          {trail && trail.length === 0 && (
            <li className="text-xs text-muted-foreground">
              Sin cambios: ningún documento se ha movido en este expediente.
            </li>
          )}
          {trail?.map((entry) => (
            <li
              key={entry._id}
              className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-xs"
            >
              <p className="text-foreground">{documentTrailLabel(entry)}</p>
              <p className="mt-0.5 text-muted-foreground">
                {entry.by} · {formatDateTime(entry.at)}
              </p>
            </li>
          ))}
        </ol>
      </CollapsibleContent>
    </Collapsible>
  );
}
