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

/**
 * El resumen del módulo, en una tira de cifras.
 *
 * Antes eran cuatro tarjetas de 130 px con el número a 30 px y un icono suelto:
 * ocupaban una franja entera de la pantalla y empujaban la lista hacia abajo.
 * Ahora cada cifra es una fila compacta —icono, número y qué cuenta—, el
 * detalle cabe debajo en una línea y la tira mide la mitad. Sigue haciendo lo
 * mismo: es un botón que abre su módulo con el filtro puesto, con su nombre
 * accesible («Ver peticiones pendientes: 7 urgentes») para quien no ve el
 * icono. En pantallas estrechas se reparte en dos columnas.
 */
export function DashboardStats({ loading, hidden, stats }: DashboardStatsProps) {
  return (
    <section
      aria-label="Resumen"
      className={cn(
        "mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3",
        hidden && "hidden",
      )}
    >
      {loading
        ? Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[68px] rounded-lg" />
          ))
        : stats.map((stat) => (
            <button
              key={stat.label}
              type="button"
              onClick={stat.go}
              aria-label={`Ver ${stat.label.toLowerCase()}: ${stat.hint}`}
              title={`Ir a ${stat.label.toLowerCase()} · ${stat.hint}`}
              className="group flex cursor-pointer items-center gap-2.5 rounded-lg border border-border/70 bg-card px-3 py-2 text-left shadow-xs transition-colors hover:border-signal/40 hover:bg-signal/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-md ${stat.iconClassName}`}
              >
                <stat.icon className="size-3.5" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                {/* En el móvil el nombre va debajo de la cifra: al lado se
                    quedaba en «Petici…». */}
                <span className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-1.5">
                  <span className="text-xl font-semibold tabular-nums tracking-tight">
                    {stat.value}
                  </span>
                  <span className="line-clamp-2 text-xs font-medium text-muted-foreground sm:truncate">
                    {stat.label}
                  </span>
                </span>
                <span className="truncate text-[11px] text-muted-foreground/80">
                  {stat.hint}
                </span>
              </span>
              <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
            </button>
          ))}
    </section>
  );
}
