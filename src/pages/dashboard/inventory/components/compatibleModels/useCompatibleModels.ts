import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getErrorMessage } from "@/lib/workshop";
import type { EquipmentModelDoc } from "../../types";
import {
  checkHasExactMatch,
  resolveCompatibleModels,
  resolveModelsMap,
  searchCompatibleModels,
} from "./helpers";

interface UseCompatibleModelsProps {
  catalogModels: EquipmentModelDoc[];
  compatibleModelIds: Id<"equipmentModels">[];
  onAddModel: (id: Id<"equipmentModels">) => void;
  disabled?: boolean;
}

export function useCompatibleModels({
  catalogModels,
  compatibleModelIds,
  onAddModel,
  disabled = false,
}: UseCompatibleModelsProps) {
  const ensureModel = useMutation(api.equipmentModels.ensureModel);

  const [modelQuery, setModelQuery] = useState("");
  const [isCreatingModel, setIsCreatingModel] = useState(false);

  const modelsMap = useMemo(
    () => resolveModelsMap(catalogModels),
    [catalogModels],
  );

  const compatiblesModels = useMemo(
    () => resolveCompatibleModels(compatibleModelIds, modelsMap),
    [compatibleModelIds, modelsMap],
  );

  const trimmedModelQuery = modelQuery.trim();
  const buscandoModelos = trimmedModelQuery !== "";

  const coincidenciasModelos = useMemo(
    () =>
      searchCompatibleModels(
        catalogModels,
        compatibleModelIds,
        trimmedModelQuery,
      ),
    [catalogModels, compatibleModelIds, trimmedModelQuery],
  );

  const hasExactMatch = useMemo(
    () => checkHasExactMatch(catalogModels, trimmedModelQuery),
    [catalogModels, trimmedModelQuery],
  );

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

  const handleSelectModel = (id: Id<"equipmentModels">) => {
    onAddModel(id);
    setModelQuery("");
  };

  const isBusy = disabled || isCreatingModel;

  return {
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
  };
}
