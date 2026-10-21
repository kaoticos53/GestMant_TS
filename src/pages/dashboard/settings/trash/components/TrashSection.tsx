import type { ReactNode } from "react";

interface TrashSectionProps {
  title: string;
  count: number;
  children: ReactNode;
}

/**
 * Contenedor con scroll acotado y cabecera semántica para un grupo de elementos en la papelera.
 */
export function TrashSection({ title, count, children }: TrashSectionProps) {
  return (
    <section className="mt-4">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-1.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
        <span className="text-xs font-medium tabular-nums text-muted-foreground">
          {count} {count === 1 ? "elemento" : "elementos"}
        </span>
      </div>
      <div className="mt-2.5 grid max-h-80 gap-2.5 overflow-y-auto pr-1">
        {children}
      </div>
    </section>
  );
}
