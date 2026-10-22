import type { TrashGroupProps } from "../types";

export function TrashGroup({ title, count, children }: TrashGroupProps) {
  return (
    <section className="mt-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
        <span className="ml-1.5 tabular-nums opacity-70">{count}</span>
      </h3>
      <div className="mt-2 grid max-h-72 gap-2 overflow-y-auto pr-1">
        {children}
      </div>
    </section>
  );
}
