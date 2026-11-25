import { Skeleton } from "@/components/ui/skeleton";

export interface ListViewSkeletonProps {
  /** Número de filas simuladas mientras llegan los datos de la vista. */
  rows?: number;
}

/**
 * Esqueleto genérico de carga para vistas de cola o tabla paginada, evitando
 * mostrar estados vacíos o contadores en cero antes de la primera suscripción.
 */
export function ListViewSkeleton({ rows = 5 }: ListViewSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Cargando datos"
      className="rounded-xl border border-border/70 bg-card p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
        <Skeleton className="h-9 w-full max-w-xs" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
