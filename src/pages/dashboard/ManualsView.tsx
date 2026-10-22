import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { TablePagination } from "@/components/TablePagination";
import { api } from "@/convex/_generated/api";
import { useRowsThatFit } from "@/hooks/use-rows-that-fit";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { useTableSort } from "@/hooks/use-table-sort";
import { sortRows } from "@/lib/tableSort";
import {
  ManualsEmptyState,
  ManualsFilterBar,
  ManualsModals,
  ManualsTable,
  buildManualsSortColumns,
  useManualExport,
  useManualsListState,
} from "./manuals";
import type { EquipmentDoc, ManualChangeDoc, ManualDoc } from "./manuals";

// Re-exportación para retrocompatibilidad con consumidores externos
export type { ManualChangeDoc, ManualDoc, EquipmentDoc };

/**
 * Módulo de manuales: la documentación del taller, clasificada por tipo, marca y modelo.
 * Gestiona la consulta, filtrado en cascada, descarga de PDF y acciones CRUD según permisos.
 */
export function ManualsView({
  canManage = false,
  currentUserId = null,
  initialSearch = "",
}: {
  /** Solo responsable/admin suben, cambian y borran manuales (fail-closed). */
  canManage?: boolean;
  /** Quién mira: es lo que permite corregir su propia nota del taller. */
  currentUserId?: string | null;
  /** Texto con el que se abre la vista (viene de la búsqueda global). */
  initialSearch?: string;
}) {
  const manuals = useQuery(api.manuals.list) ?? [];
  const equipment = useQuery(api.equipment.list, {}) ?? [];

  const [formTarget, setFormTarget] = useState<{
    manual: ManualDoc | null;
  } | null>(null);
  const [detail, setDetail] = useState<ManualDoc | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ManualDoc | null>(null);

  const listState = useManualsListState(manuals, equipment, initialSearch);
  const rights = useMemo(
    () => ({ manage: canManage, userId: currentUserId }),
    [canManage, currentUserId],
  );

  const columns = useMemo(
    () => buildManualsSortColumns(listState.equipmentOf),
    [listState.equipmentOf],
  );

  const [sort, setSort] = useTableSort({
    table: "manuals",
    columns,
    userId: currentUserId,
  });

  const rows = sortRows(
    listState.filtered,
    (manual, column) => columns[column].value(manual),
    sort,
  );

  const { areaRef, rowsFit } = useRowsThatFit();
  const paging = useTablePagination({
    total: rows.length,
    rowsFit,
    resetKey: `${listState.search}|${listState.type}|${listState.brand}|${listState.model}|${listState.equipmentFilter}`,
  });
  const visible = rows.slice(paging.from - 1, paging.to);

  const { exportCsv } = useManualExport(rows, listState.equipmentOf);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-border/70 bg-card shadow-sm">
        <ManualsFilterBar
          search={listState.search}
          onSearchChange={listState.setSearch}
          type={listState.type}
          onTypeChange={listState.setType}
          brand={listState.brand}
          onBrandChange={listState.handleBrandChange}
          model={listState.model}
          onModelChange={listState.setModel}
          equipmentFilter={listState.equipmentFilter}
          onEquipmentFilterChange={listState.setEquipmentFilter}
          brands={listState.brands}
          models={listState.models}
          equipment={equipment}
          canManage={canManage}
          onExportCsv={exportCsv}
          onNewManual={() => setFormTarget({ manual: null })}
        />

        {manuals.length === 0 || listState.filtered.length === 0 ? (
          <ManualsEmptyState
            totalManuals={manuals.length}
            canManage={canManage}
            onNewManual={() => setFormTarget({ manual: null })}
            onClearFilters={listState.clearFilters}
          />
        ) : (
          <ManualsTable
            columns={columns}
            sort={sort}
            onSortChange={setSort}
            areaRef={areaRef}
            resetKey={paging.page}
            visibleManuals={visible}
            equipmentOf={listState.equipmentOf}
            rights={rights}
            onOpenDetail={setDetail}
            onEdit={(target) => setFormTarget({ manual: target })}
            onDelete={setDeleteTarget}
          />
        )}

        {listState.filtered.length > 0 && (
          <TablePagination
            paging={paging}
            singular="manual"
            plural="manuales"
            detail={
              listState.isFiltering
                ? `${manuals.length} en el módulo`
                : undefined
            }
          />
        )}
      </div>

      <ManualsModals
        detail={detail}
        onCloseDetail={() => setDetail(null)}
        formTarget={formTarget}
        onCloseForm={() => setFormTarget(null)}
        deleteTarget={deleteTarget}
        onCloseDelete={() => setDeleteTarget(null)}
        equipment={equipment}
        canManage={canManage}
      />
    </div>
  );
}
