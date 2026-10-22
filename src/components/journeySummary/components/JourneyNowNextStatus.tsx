import { formatNowStepLabel } from "../helpers";
import type { JourneyNowNextStatusProps } from "../types";

export function JourneyNowNextStatus({
  current,
  totalStages,
  nowLabel,
  nextLabel,
  nextHint,
}: JourneyNowNextStatusProps) {
  const stepLabel = formatNowStepLabel(current, totalStages);

  return (
    <>
      <p className="mt-2.5 flex flex-wrap items-baseline gap-x-1.5 text-sm">
        <span className="text-muted-foreground">Ahora{stepLabel}:</span>
        <span className="font-medium">{nowLabel}</span>
      </p>
      <p className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 text-sm">
        <span className="text-muted-foreground">Siguiente:</span>
        {nextLabel !== null ? (
          <span className="font-medium text-signal">{nextLabel}</span>
        ) : (
          <span className="text-muted-foreground">{nextHint}</span>
        )}
      </p>
    </>
  );
}
