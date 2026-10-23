import { useCallback, useMemo, useState } from "react";
import type { Doc } from "@/convex/_generated/dataModel";
import { useRowsThatFit } from "@/hooks/use-rows-that-fit";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { useTableSort } from "@/hooks/use-table-sort";
import { manualsForEquipment } from "@/lib/manuals";
import { sortRows } from "@/lib/tableSort";
import { equipmentLabel, nextReview } from "@/lib/workshop";
import type { ManualDoc } from "../../ManualsView";
import type { EquipmentDoc, RecordDoc } from "../types";

/**
 * Función pura de filtrado de equipos por búsqueda textual sobre múltiples campos.
 */
export function filterEquipment(
  equipment: EquipmentDoc[],
  search: string,
): EquipmentDoc[] {
  const query = search.trim().toLowerCase();
  if (!query) return equipment;

  return equipment.filter((item) =>
    [
      item.code ?? "",
      item.brand ?? "",
      item.name,
      item.model,
      item.location ?? "",
      item.serialNumber ?? "",
      item.supplier ?? "",
    ].some((value) => value.toLowerCase().includes(query)),
  );
}

interface UseEquipmentListStateOptions {
  equipment: EquipmentDoc[];
  parts: Doc<"spareParts">[];
  catalogModels: Doc<"equipmentModels">[];
  maintenance: RecordDoc[];
  manuals: ManualDoc[];
  currentUserId?: string | null;
  initialSearch?: string;
}

/**
 * Hook para gestionar la búsqueda, filtrado, ordenación y paginación de la tabla de equipos,
 * calculando de forma eficiente relaciones con repuestos, revisiones y manuales.
 */
export function useEquipmentListState({
  equipment,
  parts,
  catalogModels,
  maintenance,
  manuals,
  currentUserId = null,
  initialSearch = "",
}: UseEquipmentListStateOptions) {
  const [search, setSearch] = useState(initialSearch);

  const filtered = useMemo(
    () => filterEquipment(equipment, search),
    [equipment, search],
  );

  /** Intervenciones registradas para un equipo del inventario. */
  const recordsFor = (item: EquipmentDoc) =>
    maintenance.filter((record) => record.equipmentId === item._id);

  /** Conteo de repuestos compatibles con el equipo resuelto por modelo. */
  // Las dos cuentas que la tabla usa por celda se estabilizan con `useCallback`:
  // si se recrearan en cada render, las columnas se reharían siempre y el
  // `useMemo` no serviría de nada.
  const compatibleCount = useCallback(
    (item: EquipmentDoc) => {
      const resolvedModelId =
        item.modelId ??
        catalogModels.find(
          (m) =>
            m.model.trim().toLowerCase() === item.model.trim().toLowerCase(),
        )?._id;
      return parts.filter((part) =>
        Boolean(
          resolvedModelId && part.compatibleModels?.includes(resolvedModelId),
        ),
      ).length;
    },
    [catalogModels, parts],
  );

  /** Estado de revisión preventiva del equipo. */
  const reviewOf = (item: EquipmentDoc) =>
    nextReview(
      recordsFor(item),
      item.maintenanceIntervalDays,
      item.purchaseDate,
    );

  /** Manuales asignados al equipo y de su modelo. */
  const manualsOf = useCallback(
    (item: EquipmentDoc) => manualsForEquipment(manuals, item),
    [manuals],
  );

  const columns = useMemo(
    () =>
      ({
        equipment: {
          label: "Equipo",
          value: (item: EquipmentDoc) => equipmentLabel(item),
        },
        brand: {
          label: "Marca",
          value: (item: EquipmentDoc) => item.brand ?? "",
        },
        serial: {
          label: "Nº de serie",
          value: (item: EquipmentDoc) => item.serialNumber ?? "",
        },
        location: {
          label: "Ubicación",
          value: (item: EquipmentDoc) => item.location ?? "",
        },
        manuals: {
          label: "Manuales",
          value: (item: EquipmentDoc) => {
            const docs = manualsOf(item);
            return docs.assigned.length + docs.byModel.length;
          },
        },
        parts: {
          label: "Repuestos compatibles",
          value: (item: EquipmentDoc) => compatibleCount(item),
        },
      }) as const,
    [compatibleCount, manualsOf],
  );

  const [sort, setSort] = useTableSort({
    table: "equipment",
    columns,
    userId: currentUserId,
  });

  const rows = useMemo(
    () =>
      sortRows(filtered, (item, column) => columns[column].value(item), sort),
    [filtered, columns, sort],
  );

  const { areaRef, rowsFit } = useRowsThatFit();
  const paging = useTablePagination({
    total: rows.length,
    rowsFit,
    resetKey: search,
  });

  const visible = rows.slice(paging.from - 1, paging.to);

  return {
    search,
    setSearch,
    filtered,
    columns,
    sort,
    setSort,
    rows,
    areaRef,
    paging,
    visible,
    recordsFor,
    compatibleCount,
    reviewOf,
    manualsOf,
  };
}
