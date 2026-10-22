import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FileClock, RotateCcw } from "lucide-react";

/** Estado de carga mientras se consulta la auditoría en Convex. */
export function AuditSkeletonState() {
  return (
    <div className="grid gap-3">
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-24 rounded-xl" />
    </div>
  );
}

/** Estado vacío cuando el taller aún no tiene ningún movimiento documental. */
export function AuditInitialEmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center shadow-sm">
      <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-signal/10 text-signal">
        <FileClock className="size-5" />
      </span>
      <h2 className="mt-4 text-lg font-semibold tracking-tight">
        Todavía no hay movimientos de documentos
      </h2>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
        Aquí aparecerá cada documento que se adjunte, se edite o se retire del
        expediente de una incidencia, con quién lo hizo y cuándo.
      </p>
    </div>
  );
}

/** Estado vacío cuando los filtros o búsqueda activos no arrojan ningún resultado. */
export function AuditFilteredEmptyState({
  unfilteredTotal,
  onResetFilters,
}: {
  unfilteredTotal: number;
  onResetFilters: () => void;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center shadow-sm">
      <h2 className="text-base font-semibold tracking-tight">
        Ningún movimiento con estos filtros
      </h2>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
        {`Hay ${unfilteredTotal} movimientos en el historial: prueba con otra persona, otro tipo de movimiento o unas fechas más amplias.`}
      </p>
      <Button
        type="button"
        className="mt-5 gap-2"
        onClick={onResetFilters}
      >
        <RotateCcw className="size-4" />
        Ver todo el historial
      </Button>
    </div>
  );
}
