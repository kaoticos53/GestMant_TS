import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ListArea } from "@/components/ListArea";
import { TablePagination } from "@/components/TablePagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { isAdminUser } from "@/lib/roles";
import { IncidentDetailSheet } from "./incidents/components/IncidentDetailSheet";
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
  void onOpenIncident;
  const { user } = useAuth();
  const isAdmin = isAdminUser(user);
  const [section, setSection] = useState<"documents" | "security">("documents");
  const [detailIncidentId, setDetailIncidentId] =
    useState<Id<"incidents"> | null>(null);

  const incidentsForSheet = useQuery(
    api.incidents.list,
    detailIncidentId ? { includeArchived: true } : "skip",
  );
  const equipmentForSheet = useQuery(
    api.equipment.list,
    detailIncidentId ? {} : "skip",
  );
  const requestsForSheet = useQuery(
    api.partRequests.list,
    detailIncidentId ? { includeArchived: true } : "skip",
  );
  const detailIncident = detailIncidentId
    ? (incidentsForSheet ?? []).find((inc) => inc._id === detailIncidentId) ??
      null
    : null;

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
                      onOpenIncident={setDetailIncidentId}
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

  const sheetHost = detailIncident ? (
    <IncidentDetailSheet
      key={detailIncident._id}
      incident={detailIncident}
      equipment={equipmentForSheet ?? []}
      requests={requestsForSheet ?? []}
      currentUserId={user?._id ?? null}
      currentUserName={user?.name ?? user?.email ?? "Administrador"}
      canAssign={false}
      canOpenRequests={false}
      onClose={() => setDetailIncidentId(null)}
    />
  ) : null;

  if (!isAdmin) {
    return (
      <>
        {documentsSection}
        {sheetHost}
      </>
    );
  }

  return (
    <>
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
      {sheetHost}
    </>
  );
}
