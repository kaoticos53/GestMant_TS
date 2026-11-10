import { useState } from "react";
import { ListArea } from "@/components/ListArea";
import { TablePagination } from "@/components/TablePagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { QueueToolbar } from "./QueueToolbar";
import {
  AUDIT_SORT_OPTIONS,
  type AuditViewProps,
} from "./audit/types";
import { useAuditEntries } from "./audit/hooks/useAuditEntries";
import { AuditHeaderCard } from "./audit/components/AuditHeaderCard";
import { AuditFiltersCard } from "./audit/components/AuditFiltersCard";
import { AuditGroupSection } from "./audit/components/AuditGroupSection";
import { SecurityAuditPanel } from "./audit/components/SecurityAuditPanel";
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
 * Para administradores activos añade además el visor paginado de auditoría de
 * seguridad (`securityAuditLog`).
 */
export function AuditView({ onOpenIncident }: AuditViewProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [section, setSection] = useState<"documents" | "security">("documents");

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

  const documentsSection = (
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

  if (!isAdmin) {
    return documentsSection;
  }

  return (
    <Tabs
      value={section}
      onValueChange={(value) =>
        setSection(value === "security" ? "security" : "documents")
      }
      className="flex flex-col gap-5"
    >
      <TabsList className="w-fit">
        <TabsTrigger value="documents">Documentos del expediente</TabsTrigger>
        <TabsTrigger value="security">Auditoría de seguridad</TabsTrigger>
      </TabsList>

      <TabsContent value="documents" className="focus-visible:outline-none">
        {documentsSection}
      </TabsContent>

      <TabsContent value="security" className="focus-visible:outline-none">
        <SecurityAuditPanel />
      </TabsContent>
    </Tabs>
  );
}
