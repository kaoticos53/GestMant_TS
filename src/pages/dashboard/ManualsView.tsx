import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { ListArea } from "@/components/ListArea";
import { TablePagination } from "@/components/TablePagination";
import { SortableTableHead, TableSortBar } from "@/components/TableSort";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/convex/_generated/api";
import { useRowsThatFit } from "@/hooks/use-rows-that-fit";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { useTableSort } from "@/hooks/use-table-sort";
import { sortRows } from "@/lib/tableSort";
import { equipmentLabel } from "@/lib/workshop";

import { ManualDeleteDialog } from "./ManualDeleteDialog";
import { ManualDetailSheet } from "./ManualDetailSheet";
import { ManualFormDialog } from "./ManualFormDialog";
import { ManualsEmptyState } from "./manuals/components/ManualsEmptyState";
import { ManualsFilterBar } from "./manuals/components/ManualsFilterBar";
import { ManualsTableRow } from "./manuals/components/ManualsTableRow";
import { useManualExport } from "./manuals/hooks/useManualExport";
import { useManualsListState } from "./manuals/hooks/useManualsListState";
import type { EquipmentDoc, ManualChangeDoc, ManualDoc } from "./manuals/types";

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
    () =>
      ({
        manual: { label: "Manual", value: (manual: ManualDoc) => manual.title },
        type: { label: "Tipo", value: (manual: ManualDoc) => manual.type },
        brandModel: {
          label: "Marca y modelo",
          value: (manual: ManualDoc) =>
            [manual.brand, manual.model].filter(Boolean).join(" · "),
        },
        equipment: {
          label: "Equipo",
          value: (manual: ManualDoc) => {
            const linked = listState.equipmentOf(manual);
            return linked ? equipmentLabel(linked) : "";
          },
        },
        updated: {
          label: "Actualizado",
          value: (manual: ManualDoc) => manual.updatedAt,
        },
      }) as const,
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
          <>
            <TableSortBar
              columns={columns}
              sort={sort}
              onSortChange={setSort}
            />
            <ListArea ref={areaRef} resetKey={paging.page}>
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <SortableTableHead
                      column="manual"
                      label="Manual"
                      sort={sort}
                      onSortChange={setSort}
                    />
                    <SortableTableHead
                      column="type"
                      label="Tipo"
                      sort={sort}
                      onSortChange={setSort}
                      className="hidden lg:table-cell"
                    />
                    <SortableTableHead
                      column="brandModel"
                      label="Marca y modelo"
                      sort={sort}
                      onSortChange={setSort}
                      className="hidden md:table-cell"
                    />
                    <SortableTableHead
                      column="equipment"
                      label="Equipo"
                      sort={sort}
                      onSortChange={setSort}
                      className="hidden xl:table-cell"
                    />
                    <SortableTableHead
                      column="updated"
                      label="Actualizado"
                      sort={sort}
                      onSortChange={setSort}
                      className="hidden xl:table-cell"
                    />
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((manual) => (
                    <ManualsTableRow
                      key={manual._id}
                      manual={manual}
                      linkedEquipment={listState.equipmentOf(manual)}
                      rights={rights}
                      onOpenDetail={setDetail}
                      onEdit={(target) => setFormTarget({ manual: target })}
                      onDelete={setDeleteTarget}
                    />
                  ))}
                </TableBody>
              </Table>
            </ListArea>
          </>
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

      {detail && (
        <ManualDetailSheet
          manual={detail}
          equipment={equipment}
          onClose={() => setDetail(null)}
        />
      )}

      {formTarget && (
        <ManualFormDialog
          key={formTarget.manual?._id ?? "nuevo"}
          manual={formTarget.manual}
          equipment={equipment}
          canManage={canManage}
          onClose={() => setFormTarget(null)}
        />
      )}

      {deleteTarget && (
        <ManualDeleteDialog
          manual={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => setDetail(null)}
        />
      )}
    </div>
  );
}
