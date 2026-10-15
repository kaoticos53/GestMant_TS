import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ChevronRight, type LucideIcon } from "lucide-react";

export interface DashboardStatItem {
  label: string;
  value: number;
  hint: string;
  icon: LucideIcon;
  iconClassName: string;
  go: () => void;
}

export interface DashboardStatsProps {
  loading: boolean;
  hidden: boolean;
  stats: DashboardStatItem[];
}

export function DashboardStats({ loading, hidden, stats }: DashboardStatsProps) {
  return (
    <section
      aria-label="Resumen"
      className={cn(
        "mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4",
        hidden && "hidden",
      )}
    >
      {loading
        ? Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))
        : stats.map((stat) => (
            <button
              key={stat.label}
              type="button"
              onClick={stat.go}
              aria-label={`Ver ${stat.label.toLowerCase()}`}
              title={`Ir a ${stat.label.toLowerCase()}`}
              className="group flex cursor-pointer flex-col rounded-xl border border-border/70 bg-card p-4 text-left shadow-sm transition-colors hover:border-signal/40 hover:bg-signal/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex w-full items-start justify-between gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </span>
                <span
                  className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${stat.iconClassName}`}
                >
                  <stat.icon className="size-4" />
                </span>
              </span>
              <span className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">
                {stat.value}
              </span>
              <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                {stat.hint}
                <ChevronRight className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
              </span>
            </button>
          ))}
    </section>
  );
}
