import { useCallback, useMemo, useState } from "react";
import type { Doc } from "@/convex/_generated/dataModel";
import { useRowsThatFit } from "@/hooks/use-rows-that-fit";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { useTableSort } from "@/hooks/use-table-sort";
import { csvFilename, downloadCsv, toCsv } from "@/lib/export";
import { manualsForEquipment } from "@/lib/manuals";
import {
  EQUIPMENT_OPERATIONAL_META,
  resolveOperationalState,
  type EquipmentOperationalState,
} from "@/lib/movements";
import { sortRows } from "@/lib/tableSort";
import { equipmentLabel, formatDate, nextReview } from "@/lib/workshop";
import type { ManualDoc } from "../../ManualsView";
import type { EquipmentDoc, RecordDoc } from "../types";

export type EquipmentOperationalFilter = "all" | EquipmentOperationalState;
export type EquipmentReviewFilter = "all" | "overdue";

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

/** Exporta a CSV la lista actual de equipos con estado operativo y ubicación. */
export function exportEquipmentCsv(
  rows: readonly EquipmentDoc[],
  reviewOverdueOf: (item: EquipmentDoc) => boolean,
): number {
  const header = [
    "Código",
    "Nombre",
    "Marca",
    "Modelo",
    "Nº de serie",
    "Ubicación",
    "Proveedor",
    "Estado operativo",
    "Preventivo vencido",
    "Fecha de compra",
  ];
  const exportRows = rows.map((item) => {
    const opState = resolveOperationalState(item);
    return [
      item.code ?? "",
      item.name,
      item.brand ?? "",
      item.model,
      item.serialNumber ?? "",
      item.location ?? "",
      item.supplier ?? "",
      EQUIPMENT_OPERATIONAL_META[opState].label,
      reviewOverdueOf(item) ? "Sí" : "No",
      item.purchaseDate ? formatDate(item.purchaseDate) : "",
    ];
  });
  downloadCsv(csvFilename("equipos"), toCsv(header, exportRows));
  return exportRows.length;
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
  const [operationalFilter, setOperationalFilter] =
    useState<EquipmentOperationalFilter>("all");
  const [hideDecommissioned, setHideDecommissioned] = useState(false);
  const [reviewFilter, setReviewFilter] =
    useState<EquipmentReviewFilter>("all");
  const [locationFilter, setLocationFilter] = useState("all");

  /** Intervenciones registradas para un equipo del inventario. */
  const recordsFor = useCallback(
    (item: EquipmentDoc) =>
      maintenance.filter((record) => record.equipmentId === item._id),
    [maintenance],
  );

  /** Estado de revisión preventiva del equipo. */
  const reviewOf = useCallback(
    (item: EquipmentDoc) =>
      nextReview(
        recordsFor(item),
        item.maintenanceIntervalDays,
        item.purchaseDate,
      ),
    [recordsFor],
  );

  const locations = useMemo(
    () =>
      Array.from(
        new Set(
          equipment
            .map((item) => item.location?.trim() ?? "")
            .filter((loc) => loc.length > 0),
        ),
      ).sort((a, b) => a.localeCompare(b, "es")),
    [equipment],
  );

  const filtered = useMemo(
    () =>
      filterEquipment(equipment, search).filter((item) => {
        const opState = resolveOperationalState(item);
        if (hideDecommissioned && opState === "decommissioned") return false;
        if (operationalFilter !== "all" && opState !== operationalFilter) {
          return false;
        }
        if (
          reviewFilter === "overdue" &&
          reviewOf(item).state !== "overdue"
        ) {
          return false;
        }
        if (
          locationFilter !== "all" &&
          (item.location?.trim() ?? "") !== locationFilter
        ) {
          return false;
        }
        return true;
      }),
    [
      equipment,
      search,
      hideDecommissioned,
      operationalFilter,
      reviewFilter,
      reviewOf,
      locationFilter,
    ],
  );

  const hasActiveFilters =
    search.trim() !== "" ||
    operationalFilter !== "all" ||
    hideDecommissioned ||
    reviewFilter !== "all" ||
    locationFilter !== "all";

  const clearFilters = () => {
    setSearch("");
    setOperationalFilter("all");
    setHideDecommissioned(false);
    setReviewFilter("all");
    setLocationFilter("all");
  };

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
    resetKey: `${search}|${operationalFilter}|${hideDecommissioned}|${reviewFilter}|${locationFilter}`,
  });

  const visible = rows.slice(paging.from - 1, paging.to);

  return {
    search,
    setSearch,
    operationalFilter,
    setOperationalFilter,
    hideDecommissioned,
    setHideDecommissioned,
    reviewFilter,
    setReviewFilter,
    locationFilter,
    setLocationFilter,
    locations,
    hasActiveFilters,
    clearFilters,
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
