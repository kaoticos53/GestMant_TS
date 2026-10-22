import { Clock } from "lucide-react";
import { RichText } from "@/components/RichText";
import { cn } from "@/lib/utils";
import type { RequestCardBodyProps } from "./types";

export function RequestCardBody({
  requesterName,
  requesterTeam,
  equipment,
  description,
  notes,
  status,
  decisionText,
  compact,
}: RequestCardBodyProps) {
  return (
    <>
      <div className={compact ? "mt-1" : "mt-3"}>
        <p
          className={
            compact
              ? "text-sm font-semibold tracking-tight"
              : "text-base font-semibold tracking-tight"
          }
        >
          {requesterName}
          {requesterTeam && (
            <span className="font-normal text-muted-foreground">
              {" "}
              · {requesterTeam}
            </span>
          )}
        </p>
        {equipment && (
          <p className="mt-0.5 text-sm text-muted-foreground">
            Equipo afectado: {equipment}
          </p>
        )}
      </div>

      {description && (
        <RichText
          value={description}
          className={cn(
            "text-sm leading-6 text-foreground/80 [&_img]:max-h-36 [&_img]:w-auto [&_img]:rounded-md [&_img]:object-contain",
            compact
              ? "mt-1 line-clamp-1 [&_img]:hidden"
              : "mt-3 line-clamp-2",
          )}
        />
      )}

      {notes && !compact && (
        <RichText
          value={notes}
          className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-sm italic leading-6 text-muted-foreground"
        />
      )}

      {status !== "pending" && decisionText !== "" && (
        <p
          className={cn(
            "flex items-center gap-1.5 text-xs text-muted-foreground",
            compact ? "mt-1.5" : "mt-3",
          )}
        >
          <Clock className="size-3.5" />
          {decisionText}
        </p>
      )}
    </>
  );
}
