import { Cpu } from "lucide-react";

export interface EquipmentModelsEmptyStateProps {
  hasSearch: boolean;
}

export function EquipmentModelsEmptyState({ hasSearch }: EquipmentModelsEmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-border/70 p-8 text-center text-xs text-muted-foreground space-y-2">
      <Cpu className="mx-auto size-8 text-muted-foreground/60" />
      <p className="font-medium text-foreground">
        {hasSearch
          ? "No se encontraron modelos que coincidan con la búsqueda."
          : "No hay modelos registrados en el catálogo maestro."}
      </p>
      <p>
        Puedes registrar un nuevo modelo pulsando en «Nuevo modelo» o al dar de
        alta repuestos y manuales.
      </p>
    </div>
  );
}
