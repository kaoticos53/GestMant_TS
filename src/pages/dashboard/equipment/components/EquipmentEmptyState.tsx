import { Button } from "@/components/ui/button";
import { Cpu, Plus } from "lucide-react";

interface EquipmentEmptyStateProps {
  isEmpty: boolean;
  search: string;
  canManage: boolean;
  onNewEquipment: () => void;
  onClearSearch: () => void;
}

/**
 * Componente para renderizar estados vacíos en la vista de equipos:
 * inventario sin elementos o búsqueda sin coincidencias.
 */
export function EquipmentEmptyState({
  isEmpty,
  search,
  canManage,
  onNewEquipment,
  onClearSearch,
}: EquipmentEmptyStateProps) {
  if (isEmpty) {
    return (
      <div className="p-10 text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-signal/10 text-signal">
          <Cpu className="size-5" />
        </span>
        <p className="mt-4 text-base font-semibold tracking-tight">
          El inventario de equipos está vacío
        </p>
        <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
          Da de alta los equipos del taller para que los técnicos puedan
          elegirlos en sus peticiones y filtrar los repuestos por equipo.
        </p>
        {canManage && (
          <Button type="button" className="mt-5 gap-2" onClick={onNewEquipment}>
            <Plus className="size-4" />
            Nuevo equipo
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="p-10 text-center">
      <p className="text-base font-semibold tracking-tight">Sin resultados</p>
      <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
        Ningún equipo coincide con «{search}».
      </p>
      <Button
        type="button"
        variant="outline"
        className="mt-4"
        onClick={onClearSearch}
      >
        Limpiar búsqueda
      </Button>
    </div>
  );
}
