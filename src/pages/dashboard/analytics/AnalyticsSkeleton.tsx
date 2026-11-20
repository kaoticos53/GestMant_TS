import { Skeleton } from "@/components/ui/skeleton";

export function AnalyticsSkeleton() {
  return (
    <div
      className="space-y-6"
      role="status"
      aria-label="Cargando métricas y gráficos del taller"
    >
      <span className="sr-only">Cargando métricas y gráficos del taller...</span>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Skeleton className="h-[108px] rounded-xl" />
        <Skeleton className="h-[108px] rounded-xl" />
        <Skeleton className="h-[108px] rounded-xl" />
        <Skeleton className="h-[108px] rounded-xl" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-[320px] rounded-xl" />
        <Skeleton className="h-[320px] rounded-xl" />
        <Skeleton className="h-[320px] rounded-xl" />
        <Skeleton className="h-[320px] rounded-xl" />
      </div>
    </div>
  );
}
