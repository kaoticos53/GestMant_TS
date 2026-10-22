import { BookOpen, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MANUAL_FILE_FORMAT } from "@/lib/manuals";

export interface ManualsEmptyStateProps {
  totalManuals: number;
  canManage?: boolean;
  onNewManual: () => void;
  onClearFilters: () => void;
}

/**
 * Estados vacíos del catálogo de manuales:
 * - Sin manuales en el módulo: invitación a registrar el primer manual o nota.
 * - Sin resultados para los filtros actuales: mensaje y botón para limpiar filtros.
 */
export function ManualsEmptyState({
  totalManuals,
  canManage = false,
  onNewManual,
  onClearFilters,
}: ManualsEmptyStateProps) {
  if (totalManuals === 0) {
    return (
      <div className="p-10 text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-signal/10 text-signal">
          <BookOpen className="size-5" />
        </span>
        <p className="mt-4 text-base font-semibold tracking-tight">
          Todavía no hay manuales
        </p>
        <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
          Sube el manual de un equipo en {MANUAL_FILE_FORMAT} o escribe una
          nota del taller con lo que conviene saber de un modelo. Tanto vale
          un manual de un modelo suelto como el de un equipo concreto.
        </p>
        {canManage && (
          <Button
            type="button"
            className="mt-5 gap-2"
            onClick={onNewManual}
          >
            <FileUp className="size-4" />
            Subir manual
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="p-10 text-center">
      <p className="text-base font-semibold tracking-tight">
        Sin resultados
      </p>
      <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
        Ningún manual coincide con los filtros de la lista.
      </p>
      <Button
        type="button"
        variant="outline"
        className="mt-4"
        onClick={onClearFilters}
      >
        Limpiar filtros
      </Button>
    </div>
  );
}
