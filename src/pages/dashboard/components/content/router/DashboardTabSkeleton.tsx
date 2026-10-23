import { Skeleton } from "@/components/ui/skeleton";

/**
 * Esqueleto de carga intermedio para pestañas mientras se resuelven las consultas principales.
 */
export function DashboardTabSkeleton() {
  return (
    <div
      className="grid gap-4"
      aria-busy="true"
      aria-label="Cargando contenido de la pestaña"
    >
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
    </div>
  );
}
