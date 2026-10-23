import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CompatibleModelsBadgeList,
  CompatibleModelsSearchResults,
  CreateNewModelButton,
  useCompatibleModels,
  type CompatibleModelsSectionProps,
} from "./compatibleModels";

/**
 * Subcomponente especializado para la búsqueda, creación al vuelo y asociación
 * de modelos de equipo compatibles con un repuesto del inventario.
 */
export function CompatibleModelsSection({
  catalogModels,
  compatibleModelIds,
  onAddModel,
  onRemoveModel,
  disabled = false,
}: CompatibleModelsSectionProps) {
  const {
    modelQuery,
    setModelQuery,
    trimmedModelQuery,
    buscandoModelos,
    isBusy,
    compatiblesModels,
    coincidenciasModelos,
    hasExactMatch,
    handleCreateAndAddModel,
    handleSelectModel,
  } = useCompatibleModels({
    catalogModels,
    compatibleModelIds,
    onAddModel,
    disabled,
  });

  return (
    <div className="grid gap-2 sm:col-span-2">
      <Label htmlFor="part-model-search">Modelos compatibles (recomendado)</Label>
      <p className="text-xs leading-5 text-muted-foreground">
        Asocia el repuesto al modelo técnico para que sea compatible con todos los
        equipos físicos de ese modelo.
      </p>
      <div className="grid gap-2">
        <Input
          id="part-model-search"
          value={modelQuery}
          onChange={(event) => setModelQuery(event.target.value)}
          placeholder="Buscar modelo por marca o nombre (ej. Toyota, Rexroth...)"
          autoComplete="off"
          disabled={isBusy}
        />

        <CompatibleModelsSearchResults
          matches={coincidenciasModelos}
          disabled={isBusy}
          onSelectModel={handleSelectModel}
        />

        {buscandoModelos && !hasExactMatch && (
          <CreateNewModelButton
            query={trimmedModelQuery}
            disabled={isBusy}
            onCreate={() => void handleCreateAndAddModel()}
          />
        )}

        <CompatibleModelsBadgeList
          models={compatiblesModels}
          disabled={disabled}
          onRemoveModel={onRemoveModel}
        />
      </div>
    </div>
  );
}

export type { CompatibleModelsSectionProps };
