import { Layers, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export interface EquipmentModelsHeaderProps {
  onOpenCreate: () => void;
}

export function EquipmentModelsHeader({ onOpenCreate }: EquipmentModelsHeaderProps) {
  return (
    <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <CardTitle className="text-base flex items-center gap-2">
          <Layers className="size-5 text-primary" />
          <span>Catálogo maestro de modelos de equipos</span>
        </CardTitle>
        <CardDescription>
          Gestiona la ficha técnica de cada modelo. Los repuestos compatibles y
          manuales se vinculan a estos modelos para compartirse entre todos los
          equipos físicos correspondientes.
        </CardDescription>
      </div>
      <Button
        type="button"
        onClick={onOpenCreate}
        size="sm"
        className="shrink-0 gap-1.5"
      >
        <Plus className="size-4" />
        <span>Nuevo modelo</span>
      </Button>
    </CardHeader>
  );
}
