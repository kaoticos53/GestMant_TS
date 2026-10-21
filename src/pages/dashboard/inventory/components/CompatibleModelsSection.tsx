import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { Plus, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { matchesQuery } from "@/lib/browse";
import { getErrorMessage } from "@/lib/workshop";
import { modelLabel } from "../helpers";
import { COMPATIBLE_RESULTS, type EquipmentModelDoc } from "../types";

export interface CompatibleModelsSectionProps {
  catalogModels: EquipmentModelDoc[];
  compatibleModelIds: Id<"equipmentModels">[];
  onAddModel: (id: Id<"equipmentModels">) => void;
  onRemoveModel: (id: Id<"equipmentModels">) => void;
  disabled?: boolean;
}

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
  const ensureModel = useMutation(api.equipmentModels.ensureModel);

  const [modelQuery, setModelQuery] = useState("");
  const [isCreatingModel, setIsCreatingModel] = useState(false);

  // Indexación Map en O(n) para resolución en O(1) de los modelos asociados
  const modelsMap = useMemo(
    () => new Map(catalogModels.map((m) => [m._id, m])),
    [catalogModels],
  );

  const compatiblesModels = useMemo(
    () =>
      compatibleModelIds
        .map((id) => modelsMap.get(id))
        .filter((m): m is EquipmentModelDoc => m !== undefined),
    [compatibleModelIds, modelsMap],
  );

  const trimmedModelQuery = modelQuery.trim();
  const buscandoModelos = trimmedModelQuery !== "";

  // Búsqueda memoizada con Set para exclusión en O(1)
  const coincidenciasModelos = useMemo(() => {
    if (!buscandoModelos) return [];
    const selectedSet = new Set(compatibleModelIds);
    return catalogModels
      .filter(
        (m) =>
          !selectedSet.has(m._id) &&
          matchesQuery(
            [modelLabel(m), m.model, m.name, m.brand, m.category],
            trimmedModelQuery,
          ),
      )
      .slice(0, COMPATIBLE_RESULTS);
  }, [buscandoModelos, compatibleModelIds, catalogModels, trimmedModelQuery]);

  const hasExactMatch = useMemo(() => {
    if (!buscandoModelos) return true;
    const queryLower = trimmedModelQuery.toLowerCase();
    return catalogModels.some(
      (m) =>
        m.model.toLowerCase() === queryLower ||
        modelLabel(m).toLowerCase() === queryLower,
    );
  }, [buscandoModelos, catalogModels, trimmedModelQuery]);

  const handleCreateAndAddModel = async () => {
    if (!trimmedModelQuery) return;
    setIsCreatingModel(true);
    try {
      const modelId = await ensureModel({
        model: trimmedModelQuery,
      });
      onAddModel(modelId);
      setModelQuery("");
      toast.success(
        `Modelo «${trimmedModelQuery}» registrado en el catálogo y asociado`,
      );
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsCreatingModel(false);
    }
  };

  const isBusy = disabled || isCreatingModel;

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

        {coincidenciasModelos.length > 0 && (
          <ul
            aria-label="Modelos que coinciden"
            className="overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm"
          >
            {coincidenciasModelos.map((item) => (
              <li key={item._id}>
                <button
                  type="button"
                  onClick={() => {
                    onAddModel(item._id);
                    setModelQuery("");
                  }}
                  disabled={isBusy}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs transition-colors hover:bg-muted/60"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground">
                      {modelLabel(item)}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {item.name}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
                    {item.category && <span>{item.category}</span>}
                    <Plus className="size-3.5" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {buscandoModelos && !hasExactMatch && (
          <button
            type="button"
            onClick={handleCreateAndAddModel}
            disabled={isBusy}
            className="flex w-full items-center justify-between gap-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-left text-xs font-medium text-primary transition-colors hover:bg-primary/10"
          >
            <span className="flex items-center gap-2 truncate">
              <Sparkles className="size-3.5 shrink-0 text-amber-500" />
              <span>
                Registrar nuevo modelo «<strong>{trimmedModelQuery}</strong>» y
                asociar
              </span>
            </span>
            <Plus className="size-3.5 shrink-0" />
          </button>
        )}

        {compatiblesModels.length === 0 ? (
          <p className="text-xs leading-5 text-muted-foreground">
            Ningún modelo asociado todavía.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {compatiblesModels.map((item) => (
              <button
                key={item._id}
                type="button"
                onClick={() => onRemoveModel(item._id)}
                disabled={disabled}
                title="Quitar modelo compatible"
                aria-label={`Quitar ${modelLabel(item)}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-signal bg-signal/10 px-3 py-1 text-xs font-medium text-signal transition-colors hover:border-destructive/40 hover:text-destructive"
              >
                {modelLabel(item)}
                <X className="size-3.5" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
