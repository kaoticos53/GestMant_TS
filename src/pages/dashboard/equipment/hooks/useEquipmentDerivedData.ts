import { useMemo } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { nextReview, requestMatchesEquipment } from "@/lib/workshop";
import { useQuery } from "convex/react";
import type { EquipmentDoc, RecordDoc } from "../types";

interface UseEquipmentDerivedDataOptions {
  item: EquipmentDoc;
  parts: Doc<"spareParts">[];
  requests: Doc<"partRequests">[];
  maintenance?: RecordDoc[];
}

/**
 * Hook para memoizar datos derivados y relaciones del equipo:
 * peticiones coincidentes, repuestos compatibles y estado de revisiones.
 */
export function useEquipmentDerivedData({
  item,
  parts,
  requests,
  maintenance = [],
}: UseEquipmentDerivedDataOptions) {
  // Mismo motivo que en el formulario: el respaldo, estable entre renders.
  const catalogModelsQuery = useQuery(api.equipmentModels.list);
  const catalogModels = useMemo(
    () => catalogModelsQuery ?? [],
    [catalogModelsQuery],
  );

  const related = useMemo(
    () => requests.filter((request) => requestMatchesEquipment(request, item)),
    [requests, item],
  );

  const resolvedModelId = useMemo(
    () =>
      item.modelId ??
      catalogModels.find(
        (m) => m.model.trim().toLowerCase() === item.model.trim().toLowerCase(),
      )?._id,
    [item.modelId, item.model, catalogModels],
  );

  const compatible = useMemo(
    () =>
      parts.filter((part) =>
        Boolean(
          resolvedModelId && part.compatibleModels?.includes(resolvedModelId),
        ),
      ),
    [parts, resolvedModelId],
  );

  const shownRequests = useMemo(() => related.slice(0, 6), [related]);

  const review = useMemo(
    () =>
      nextReview(maintenance, item.maintenanceIntervalDays, item.purchaseDate),
    [maintenance, item.maintenanceIntervalDays, item.purchaseDate],
  );

  return {
    related,
    shownRequests,
    resolvedModelId,
    compatible,
    review,
  };
}
