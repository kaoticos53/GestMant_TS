import { useCallback, useMemo, useState } from "react";
import type { TableSort } from "@/lib/tableSort";
import {
  buildPurchaseHistoryRows,
  filterPurchaseHistoryRows,
  sortPurchaseHistoryRows,
  type PurchaseHistoryColumn,
  type PurchaseHistoryFilters,
  type PurchaseHistoryRow,
  type PurchaseOrderDoc,
} from "@/lib/purchasing";
import type { ReceptionDoc } from "../types";

export const DEFAULT_PURCHASE_FILTERS: PurchaseHistoryFilters = {
  query: "",
  pedido: "",
  solicitud: "",
  proveedor: "todos",
  descripcion: "",
  observaciones: "",
  estado: "todos",
  fechaTipo: "pedido",
  fechaDesde: "",
  fechaHasta: "",
};

export interface HistoryFiltersApi {
  filters: PurchaseHistoryFilters;
  setFilters: React.Dispatch<React.SetStateAction<PurchaseHistoryFilters>>;
  advancedOpen: boolean;
  setAdvancedOpen: React.Dispatch<React.SetStateAction<boolean>>;
  toggleAdvancedOpen: () => void;
  sort: TableSort<PurchaseHistoryColumn> | null;
  setSort: React.Dispatch<React.SetStateAction<TableSort<PurchaseHistoryColumn> | null>>;
  allRows: PurchaseHistoryRow[];
  proveedores: string[];
  filtrosActivosCount: number;
  limpiarFiltros: () => void;
  filteredAndSortedRows: PurchaseHistoryRow[];
}

/**
 * Hook para la gestión del estado de filtros, ordenación y cómputo de filas del histórico de compras.
 */
export function useHistoryFilters(
  orders: PurchaseOrderDoc[],
  receptions: ReceptionDoc[],
): HistoryFiltersApi {
  const [filters, setFilters] = useState<PurchaseHistoryFilters>(DEFAULT_PURCHASE_FILTERS);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [sort, setSort] = useState<TableSort<PurchaseHistoryColumn> | null>(null);

  const toggleAdvancedOpen = useCallback(() => {
    setAdvancedOpen((prev) => !prev);
  }, []);

  const allRows = useMemo(
    () => buildPurchaseHistoryRows(orders, receptions),
    [orders, receptions],
  );

  const proveedores = useMemo(() => {
    const list = [...new Set(allRows.map((r) => r.supplier).filter(Boolean))];
    return list.sort((a, b) => a.localeCompare(b, "es"));
  }, [allRows]);

  const filtrosActivosCount = useMemo(() => {
    let count = 0;
    if (filters.pedido?.trim()) count++;
    if (filters.solicitud?.trim()) count++;
    if (filters.proveedor && filters.proveedor !== "todos") count++;
    if (filters.descripcion?.trim()) count++;
    if (filters.observaciones?.trim()) count++;
    if (filters.estado && filters.estado !== "todos") count++;
    if (filters.fechaDesde) count++;
    if (filters.fechaHasta) count++;
    return count;
  }, [filters]);

  const limpiarFiltros = useCallback(() => {
    setFilters(DEFAULT_PURCHASE_FILTERS);
  }, []);

  const filteredAndSortedRows = useMemo(() => {
    const filtered = filterPurchaseHistoryRows(allRows, filters);
    return sortPurchaseHistoryRows(filtered, sort);
  }, [allRows, filters, sort]);

  return {
    filters,
    setFilters,
    advancedOpen,
    setAdvancedOpen,
    toggleAdvancedOpen,
    sort,
    setSort,
    allRows,
    proveedores,
    filtrosActivosCount,
    limpiarFiltros,
    filteredAndSortedRows,
  };
}
