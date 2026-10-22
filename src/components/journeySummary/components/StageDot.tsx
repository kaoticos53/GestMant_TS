import { Check, CircleDot, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StageDotProps } from "../types";

/**
 * El punto indicador de cada etapa: hecho, ahora, pendiente o no se pasó.
 */
export function StageDot({ state, index }: StageDotProps) {
  const base =
    "flex size-4 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold leading-none";

  if (state === "done") {
    return (
      <span className={cn(base, "border-signal/40 bg-signal/15 text-signal")}>
        <Check className="size-2.5" aria-hidden="true" />
      </span>
    );
  }

  if (state === "current") {
    return (
      <span
        className={cn(base, "border-signal bg-signal text-primary-foreground")}
      >
        <CircleDot className="size-2.5" aria-hidden="true" />
      </span>
    );
  }

  if (state === "skipped") {
    return (
      <span
        className={cn(
          base,
          "border-dashed border-border bg-transparent text-muted-foreground/70",
        )}
      >
        <Minus className="size-2.5" aria-hidden="true" />
      </span>
    );
  }

  return (
    <span className={cn(base, "border-border bg-muted text-muted-foreground")}>
      {index + 1}
    </span>
  );
}
