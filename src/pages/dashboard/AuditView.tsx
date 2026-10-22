import { ListArea } from "@/components/ListArea";
import { TablePagination } from "@/components/TablePagination";
import { QueueToolbar } from "./QueueToolbar";
import {
  AUDIT_SORT_OPTIONS,
  type AuditViewProps,
} from "./audit/types";
import { useAuditEntries } from "./audit/hooks/useAuditEntries";
import { AuditHeaderCard } from "./audit/components/AuditHeaderCard";
import { AuditFiltersCard } from "./audit/components/AuditFiltersCard";
import { AuditGroupSection } from "./audit/components/AuditGroupSection";
import {
  AuditFilteredEmptyState,
  AuditInitialEmptyState,
  AuditSkeletonState,
} from "./audit/components/AuditEmptyStates";

/**
 * Auditoría de documentos: el rastro del expediente de todas las incidencias en
 * una sola vista —quién adjuntó, editó o retiró cada documento y cuándo—, con
 * filtros por persona, por fechas y por tipo de movimiento.
 *
 * Es una lectura de administración (la capacidad `viewAudit` está bloqueada),
 * y por eso el Dashboard solo la monta para el administrador. El filtrado
 * grande lo hace la consulta sobre los índices de la tabla; aquí se añade la
 * búsqueda de texto y el orden, como en las colas.
 *
 * La lista se parte en páginas con la misma medida que las colas y las tablas:
 * cuántos movimientos caben lo dice el alto del área —contado por el navegador—,
 * y el pie va fuera, pegado a la vista, en vez de un «Mostrar más» al final de
 * todo.
 */
export function AuditView({ onOpenIncident }: AuditViewProps) {
  const {
    filters,
    search,
    sort,
    compact,
    setSearch,
    setSort,
    setCompact,
    applyFilters,
    handleApplyPreset,
    resetFilters,
    handleExport,
    audit,
    rango,
    activePreset,
    filterCount,
    sorted,
    groups,
    summary,
    breakdown,
    paging,
    areaRef,
    listKey,
  } = useAuditEntries();

  return (
    <div className="flex flex-col gap-5">
      <AuditHeaderCard rango={rango} audit={audit} />

      <AuditFiltersCard
        filters={filters}
        authors={audit?.authors ?? []}
        activePreset={activePreset}
        filterCount={filterCount}
        search={search}
        sortedCount={sorted.length}
        summary={summary}
        breakdown={breakdown}
        onApplyFilters={applyFilters}
        onApplyPreset={handleApplyPreset}
        onResetFilters={resetFilters}
        onExport={handleExport}
      />

      {audit === undefined ? (
        <AuditSkeletonState />
      ) : audit.unfilteredTotal === 0 ? (
        <AuditInitialEmptyState />
      ) : (
        <>
          <QueueToolbar
            search={search}
            onSearchChange={setSearch}
            placeholder="Buscar por referencia, persona o documento"
            sort={sort}
            onSortChange={setSort}
            sortOptions={AUDIT_SORT_OPTIONS}
            compact={compact}
            onCompactChange={setCompact}
            noun="movimientos"
          />

          {sorted.length === 0 ? (
            <AuditFilteredEmptyState
              unfilteredTotal={audit.unfilteredTotal}
              onResetFilters={resetFilters}
            />
          ) : (
            <div className="flex flex-col gap-4">
              <ListArea ref={areaRef} resetKey={`${listKey}|${paging.page}`}>
                <div className="flex flex-col gap-4">
                  {groups.map((group) => (
                    <AuditGroupSection
                      key={group.key}
                      label={group.label}
                      compact={compact}
                      entries={group.items}
                      onOpenIncident={onOpenIncident}
                    />
                  ))}
                </div>
              </ListArea>

              <TablePagination
                paging={paging}
                singular="movimiento"
                plural="movimientos"
                className="rounded-xl border border-border/70 bg-card shadow-sm"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
