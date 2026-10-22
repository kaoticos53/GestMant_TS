import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";
import type { EquipmentDoc, PartDoc } from "../types";

export interface RequestLineItem {
  sparePartId: Id<"spareParts">;
  quantity: number;
}

export interface EquipmentModelItem {
  _id: Id<"equipmentModels">;
  model: string;
}

/**
 * Resuelve el equipo seleccionado según la clave de elección del selector.
 */
export function resolveSelectedEquipment(
  equipment: EquipmentDoc[],
  equipmentChoice: string,
): EquipmentDoc | undefined {
  if (!equipmentChoice || equipmentChoice === "manual") return undefined;
  return equipment.find((item) => item._id === equipmentChoice);
}

/**
 * Resuelve el ID del modelo del equipo (por referencia directa de modelId o coincidencia por nombre de modelo).
 */
export function resolveModelId(
  selectedEquipment: EquipmentDoc | undefined,
  catalogModels: EquipmentModelItem[],
): Id<"equipmentModels"> | undefined {
  if (!selectedEquipment) return undefined;
  if (selectedEquipment.modelId) return selectedEquipment.modelId;

  const targetName = selectedEquipment.model.trim().toLowerCase();
  const match = catalogModels.find(
    (m) => m.model.trim().toLowerCase() === targetName,
  );
  return match?._id;
}

/**
 * Filtra los repuestos que declaran compatibilidad con el modelo dado.
 */
export function filterCompatibleParts(
  parts: PartDoc[],
  selectedModelId: Id<"equipmentModels"> | undefined,
): PartDoc[] {
  if (!selectedModelId) return parts;
  return parts.filter((part) =>
    part.compatibleModels?.includes(selectedModelId),
  );
}

/**
 * Asegura que una cantidad de repuestos sea un entero positivo mayor o igual a 1.
 */
export function sanitizeQuantity(quantity: number): number {
  return Math.max(1, Math.floor(quantity || 1));
}

export interface UseRequestPartsSelectionOptions {
  parts: PartDoc[];
  equipment: EquipmentDoc[];
  catalogModels: EquipmentModelItem[];
  equipmentChoice: string;
}

export interface UseRequestPartsSelectionReturn {
  lines: RequestLineItem[];
  selectedId: string;
  setSelectedId: (id: string) => void;
  onlyCompatible: boolean;
  setOnlyCompatible: React.Dispatch<React.SetStateAction<boolean>>;
  showOnly: boolean;
  selectedEquipment: EquipmentDoc | undefined;
  compatibleParts: PartDoc[];
  visibleParts: PartDoc[];
  partById: Map<Id<"spareParts">, PartDoc>;
  addLine: () => void;
  updateQuantity: (sparePartId: Id<"spareParts"> | string, quantity: number) => void;
  removeLine: (sparePartId: Id<"spareParts"> | string) => void;
  clearLines: () => void;
}

/**
 * Hook para gestionar el filtrado por compatibilidad de equipo,
 * selección de repuestos y manipulación de líneas en la petición.
 */
export function useRequestPartsSelection({
  parts,
  equipment,
  catalogModels,
  equipmentChoice,
}: UseRequestPartsSelectionOptions): UseRequestPartsSelectionReturn {
  const [lines, setLines] = useState<RequestLineItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [onlyCompatible, setOnlyCompatible] = useState(true);

  const selectedEquipment = useMemo(
    () => resolveSelectedEquipment(equipment, equipmentChoice),
    [equipment, equipmentChoice],
  );

  const selectedModelId = useMemo(
    () => resolveModelId(selectedEquipment, catalogModels),
    [selectedEquipment, catalogModels],
  );

  const compatibleParts = useMemo(
    () => filterCompatibleParts(parts, selectedModelId),
    [parts, selectedModelId],
  );

  const showOnly = Boolean(
    selectedEquipment && onlyCompatible && compatibleParts.length > 0,
  );

  const visibleParts = useMemo(
    () => (showOnly ? compatibleParts : parts),
    [showOnly, compatibleParts, parts],
  );

  const partById = useMemo(
    () => new Map(parts.map((part) => [part._id, part])),
    [parts],
  );

  const addLine = useCallback(() => {
    if (!selectedId) return;
    const part = parts.find((candidate) => candidate._id === selectedId);
    if (!part) return;

    if (lines.some((line) => line.sparePartId === part._id)) {
      toast.info("Ese repuesto ya está en la petición");
      return;
    }

    setLines((prev) => [...prev, { sparePartId: part._id, quantity: 1 }]);
    setSelectedId("");
  }, [parts, selectedId, lines]);

  const updateQuantity = useCallback(
    (sparePartId: Id<"spareParts"> | string, quantity: number) => {
      setLines((current) =>
        current.map((line) =>
          line.sparePartId === sparePartId
            ? { ...line, quantity: sanitizeQuantity(quantity) }
            : line,
        ),
      );
    },
    [],
  );

  const removeLine = useCallback((sparePartId: Id<"spareParts"> | string) => {
    setLines((current) =>
      current.filter((item) => item.sparePartId !== sparePartId),
    );
  }, []);

  const clearLines = useCallback(() => {
    setLines([]);
    setSelectedId("");
    setOnlyCompatible(true);
  }, []);

  return {
    lines,
    selectedId,
    setSelectedId,
    onlyCompatible,
    setOnlyCompatible,
    showOnly,
    selectedEquipment,
    compatibleParts,
    visibleParts,
    partById,
    addLine,
    updateQuantity,
    removeLine,
    clearLines,
  };
}
