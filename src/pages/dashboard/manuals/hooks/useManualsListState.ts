import { useCallback, useMemo, useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { filterManuals, manualBrands, manualModels } from "@/lib/manuals";
import type { EquipmentDoc, ManualDoc } from "../types";

/** Valor del filtro de equipo que busca los manuales sin equipo asignado. */
export const NO_EQUIPMENT_FILTER = "__none__";

/** Clase de documento: todo, solo PDF, solo notas del taller o mis notas. */
export type ManualKindFilter = "all" | "file" | "note" | "mine";

export const MANUAL_KIND_FILTER_OPTIONS: {
  value: ManualKindFilter;
  label: string;
}[] = [
  { value: "all", label: "PDF y notas" },
  { value: "file", label: "Solo PDF" },
  { value: "note", label: "Notas del taller" },
  { value: "mine", label: "Mis notas" },
];

export interface ManualFilterCriteria {
  query: string;
  type: string;
  brand: string;
  model: string;
  equipmentFilter: string;
  kind?: ManualKindFilter;
  currentUserId?: string | null;
}

/** ¿El manual pasa el filtro de clase de documento? */
export function matchesManualKind(
  manual: Pick<ManualDoc, "kind" | "authorId">,
  kind: ManualKindFilter | undefined,
  currentUserId: string | null | undefined,
): boolean {
  switch (kind) {
    case "file":
      return manual.kind === "file";
    case "note":
      return manual.kind === "note";
    case "mine":
      return (
        manual.kind === "note" &&
        Boolean(currentUserId) &&
        manual.authorId === currentUserId
      );
    default:
      return true;
  }
}

/**
 * Función pura que filtra la lista de manuales aplicando los criterios de búsqueda,
 * tipo, marca, modelo, clase de documento y la regla especial de manuales
 * huérfanos sin equipo (`__none__`).
 */
export function filterManualsWithSpecialRules(
  manuals: ManualDoc[],
  filters: ManualFilterCriteria,
): ManualDoc[] {
  const byKind = filterManualsBase(manuals, filters);
  return filters.kind && filters.kind !== "all"
    ? byKind.filter((manual) =>
        matchesManualKind(manual, filters.kind, filters.currentUserId),
      )
    : byKind;
}

function filterManualsBase(
  manuals: ManualDoc[],
  filters: ManualFilterCriteria,
): ManualDoc[] {
  const withoutEquipment = filters.equipmentFilter === NO_EQUIPMENT_FILTER;
  const base = filterManuals(manuals, {
    query: filters.query,
    type: filters.type === "all" ? undefined : filters.type,
    brand: filters.brand === "all" ? undefined : filters.brand,
    model: filters.model === "all" ? undefined : filters.model,
    equipmentId:
      filters.equipmentFilter === "all" || withoutEquipment
        ? undefined
        : (filters.equipmentFilter as Id<"equipment">),
  });

  return withoutEquipment
    ? base.filter((manual) => !manual.equipmentId)
    : base;
}

export interface UseManualsListStateReturn {
  search: string;
  setSearch: (search: string) => void;
  type: string;
  setType: (type: string) => void;
  brand: string;
  handleBrandChange: (brand: string) => void;
  model: string;
  setModel: (model: string) => void;
  equipmentFilter: string;
  setEquipmentFilter: (equipment: string) => void;
  kind: ManualKindFilter;
  setKind: (kind: ManualKindFilter) => void;
  brands: string[];
  models: string[];
  filtered: ManualDoc[];
  equipmentById: Map<Id<"equipment">, EquipmentDoc>;
  equipmentOf: (manual: ManualDoc) => EquipmentDoc | undefined;
  clearFilters: () => void;
  isFiltering: boolean;
}

/**
 * Hook para gestionar los filtros reactivos en cascada (marca -> modelo),
 * la búsqueda en texto y la resolución O(1) de equipos para el catálogo de manuales.
 */
export function useManualsListState(
  manuals: ManualDoc[],
  equipment: EquipmentDoc[],
  initialSearch = "",
  currentUserId: string | null = null,
): UseManualsListStateReturn {
  const [search, setSearch] = useState(initialSearch);
  const [type, setType] = useState<string>("all");
  const [brand, setBrand] = useState<string>("all");
  const [model, setModel] = useState<string>("all");
  const [equipmentFilter, setEquipmentFilter] = useState<string>("all");
  const [kind, setKind] = useState<ManualKindFilter>("all");

  // Índice memoizado O(1) para resolver equipos por ID sin búsquedas lineales O(N)
  const equipmentById = useMemo(
    () => new Map(equipment.map((item) => [item._id, item])),
    [equipment],
  );

  const equipmentOf = useCallback(
    (manual: ManualDoc) =>
      manual.equipmentId ? equipmentById.get(manual.equipmentId) : undefined,
    [equipmentById],
  );

  const brands = useMemo(() => manualBrands(manuals), [manuals]);
  const models = useMemo(
    () => manualModels(manuals, brand === "all" ? undefined : brand),
    [manuals, brand],
  );

  const filtered = useMemo(
    () =>
      filterManualsWithSpecialRules(manuals, {
        query: search,
        type,
        brand,
        model,
        equipmentFilter,
        kind,
        currentUserId,
      }),
    [manuals, search, type, brand, model, equipmentFilter, kind, currentUserId],
  );

  const handleBrandChange = useCallback((newBrand: string) => {
    setBrand(newBrand);
    setModel("all"); // Reset automático del modelo dependiente
  }, []);

  const clearFilters = useCallback(() => {
    setSearch("");
    setType("all");
    setBrand("all");
    setModel("all");
    setEquipmentFilter("all");
    setKind("all");
  }, []);

  const isFiltering =
    search.trim() !== "" ||
    type !== "all" ||
    brand !== "all" ||
    model !== "all" ||
    equipmentFilter !== "all" ||
    kind !== "all";

  return {
    search,
    setSearch,
    type,
    setType,
    brand,
    handleBrandChange,
    model,
    setModel,
    equipmentFilter,
    setEquipmentFilter,
    kind,
    setKind,
    brands,
    models,
    filtered,
    equipmentById,
    equipmentOf,
    clearFilters,
    isFiltering,
  };
}
