import { cn } from "@/lib/utils";
import { getStageAccessibilityLabel } from "../helpers";
import type { JourneyStagesListProps } from "../types";
import { StageDot } from "./StageDot";

export function JourneyStagesList({ stages }: JourneyStagesListProps) {
  return (
    <ol className="flex items-start gap-1.5">
      {stages.map((stage, index) => (
        <li
          key={stage.key}
          aria-current={stage.state === "current" ? "step" : undefined}
          className="flex min-w-0 flex-1 items-start gap-1.5 last:flex-none"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <StageDot state={stage.state} index={index} />
              <span
                className={cn(
                  "line-clamp-2 text-[11px] font-medium leading-tight sm:text-xs",
                  stage.state === "current"
                    ? "text-signal"
                    : stage.state === "done"
                      ? "text-foreground"
                      : "text-muted-foreground",
                  stage.state === "skipped" && "text-muted-foreground/70",
                )}
                title={stage.label}
              >
                {stage.label}
              </span>
            </div>
            <span className="sr-only">
              {getStageAccessibilityLabel(stage.state)}
            </span>
          </div>
          {index < stages.length - 1 && (
            <span
              aria-hidden="true"
              className={cn(
                "mt-2 hidden h-px w-5 shrink-0 sm:block",
                stages[index + 1].state === "pending" ||
                  stages[index + 1].state === "skipped"
                  ? "bg-border"
                  : "bg-signal/40",
              )}
            />
          )}
        </li>
      ))}
    </ol>
  );
}
