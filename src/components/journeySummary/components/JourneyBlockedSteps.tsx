import { Fragment } from "react";
import type { JourneyBlockedStepsProps } from "../types";
import { StageDot } from "./StageDot";

export function JourneyBlockedSteps({ blockedByStage }: JourneyBlockedStepsProps) {
  if (blockedByStage.length === 0) return null;

  return (
    <div className="mt-2.5 border-t border-border/60 pt-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Aún no se puede
      </p>
      <dl className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-2 gap-y-1 text-xs leading-5">
        {blockedByStage.map((group) => (
          <Fragment key={group.stage.key}>
            <dt className="flex items-baseline gap-1.5 text-muted-foreground">
              <StageDot state={group.stage.state} index={group.index} />
              <span className="whitespace-nowrap">{group.stage.label}</span>
            </dt>
            <dd>
              <ul className="space-y-0.5">
                {group.steps.map((step) => (
                  <li key={step.action}>
                    <span className="font-medium text-foreground/80">
                      {step.label}
                    </span>{" "}
                    <span className="text-muted-foreground">
                      — {step.reason}.
                    </span>
                  </li>
                ))}
              </ul>
            </dd>
          </Fragment>
        ))}
      </dl>
    </div>
  );
}
