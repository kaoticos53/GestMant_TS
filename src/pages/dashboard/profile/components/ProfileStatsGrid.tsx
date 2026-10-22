import type { ProfileStatsGridProps } from "../types";

/** Cuadrícula de 4 tarjetas estadísticas personales. */
export function ProfileStatsGrid({ stats }: ProfileStatsGridProps) {
  return (
    <section
      aria-label="Mi resumen"
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-xl border border-border/70 bg-card p-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-muted-foreground">
              {stat.label}
            </p>
            <span
              className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${stat.iconClassName}`}
            >
              <stat.icon className="size-4" />
            </span>
          </div>
          <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">
            {stat.value}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{stat.hint}</p>
        </div>
      ))}
    </section>
  );
}
