import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { getFlipButtonMeta } from "../helpers";
import type { SortFlipButtonProps } from "../types";

export function SortFlipButton<Column extends string>({
  sort,
  onFlip,
}: SortFlipButtonProps<Column>) {
  const { ariaLabel, title } = getFlipButtonMeta(sort);

  return (
    <button
      type="button"
      onClick={onFlip}
      disabled={sort === null}
      aria-label={ariaLabel}
      title={title}
      className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {sort === null ? (
        <ArrowUpDown className="size-3.5" aria-hidden="true" />
      ) : sort.direction === "asc" ? (
        <ArrowUp className="size-3.5" aria-hidden="true" />
      ) : (
        <ArrowDown className="size-3.5" aria-hidden="true" />
      )}
    </button>
  );
}
