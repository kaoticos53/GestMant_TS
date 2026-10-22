import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import type { DashboardEmptyNoticeProps } from "./types";

export function DashboardEmptyNotice({
  canManageInventory,
  isSeeding,
  onSeed,
  onStartEmpty,
}: DashboardEmptyNoticeProps) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center shadow-sm">
      <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-signal/10 text-signal">
        <Sparkles className="size-5" />
      </span>
      <h2 className="mt-4 text-lg font-semibold tracking-tight">
        El taller todavía no tiene datos
      </h2>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
        Puedes cargar la muestra de ejemplo para recorrer el flujo completo, o
        empezar con el taller vacío y dar de alta tus propios repuestos,
        equipos e incidencias.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {canManageInventory && (
          <Button
            type="button"
            className="gap-2"
            onClick={onSeed}
            disabled={isSeeding}
          >
            <Sparkles className="size-4" />
            {isSeeding ? "Cargando datos..." : "Cargar datos de ejemplo"}
          </Button>
        )}
        <Button type="button" variant="outline" onClick={onStartEmpty}>
          Empezar con el taller vacío
        </Button>
      </div>
      {!canManageInventory && (
        <p className="mt-3 text-sm text-muted-foreground">
          Los datos de ejemplo los carga quien puede modificar el catálogo de
          repuestos.
        </p>
      )}
    </div>
  );
}
