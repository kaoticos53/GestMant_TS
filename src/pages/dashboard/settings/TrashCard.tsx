import { Skeleton } from "@/components/ui/skeleton";
import { TrashDeleteDialog } from "./trash/components/TrashDeleteDialog";
import { TrashFilterBar } from "./trash/components/TrashFilterBar";
import { TrashIncidentSection } from "./trash/components/TrashIncidentSection";
import { TrashRequestSection } from "./trash/components/TrashRequestSection";
import { TrashRetentionConfig } from "./trash/components/TrashRetentionConfig";
import { TrashStorageSection } from "./trash/components/TrashStorageSection";
import type { TrashCardProps } from "./trash/types";
import { useTrashOperations } from "./trash/useTrashOperations";
import { useTrashRetention } from "./trash/useTrashRetention";

/**
 * Papelera del taller: lo que se retira —incidencias, peticiones y archivos—
 * no se borra en el acto, sino que espera aquí el plazo configurado con opción
 * de recuperarse tal y como estaba o adelantarse su borrado definitivo.
 */
export function TrashCard({
  canManageIncidents = true,
  canDecideRequests = true,
}: TrashCardProps) {
  const {
    days,
    setDays,
    savingDays,
    daysValid,
    daysValue,
    retentionDays,
    settings,
    handleSaveDays,
  } = useTrashRetention();

  const {
    trash,
    trashedIncidents,
    trashedRequests,
    storagePending,
    storageKept,
    storageTotal,
    totalItems,
    isLoading,
    busyId,
    deletingEntity,
    setDeletingEntity,
    filter,
    setFilter,
    handleRestoreIncident,
    handleRestoreRequest,
    handleRestoreStorage,
    handleConfirmDelete,
  } = useTrashOperations({ canManageIncidents, canDecideRequests });

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
      <TrashRetentionConfig
        days={days}
        setDays={setDays}
        savingDays={savingDays}
        daysValid={daysValid}
        daysValue={daysValue}
        retentionDays={retentionDays}
        disabled={settings === undefined}
        onSaveDays={handleSaveDays}
      />

      {isLoading ? (
        <div className="mt-5 grid gap-2">
          <Skeleton className="h-14 rounded-lg" />
          <Skeleton className="h-14 rounded-lg" />
        </div>
      ) : totalItems === 0 ? (
        <p className="mt-5 rounded-lg border border-dashed border-border px-3.5 py-4 text-xs leading-5 text-muted-foreground text-center">
          La papelera está vacía: las incidencias o peticiones retiradas y los
          archivos purgados aparecerán aquí durante su plazo de retención antes
          de borrarse.
        </p>
      ) : (
        <div className="mt-5 flex flex-col gap-4">
          <TrashFilterBar
            filter={filter}
            onFilterChange={setFilter}
            totalItems={totalItems}
            incidentsCount={trashedIncidents.length}
            requestsCount={trashedRequests.length}
            storageCount={storageTotal}
            canManageIncidents={canManageIncidents}
            canDecideRequests={canDecideRequests}
          />

          {canManageIncidents && (filter === "all" || filter === "incidents") && (
            <TrashIncidentSection
              items={trashedIncidents}
              busyId={busyId}
              onRestore={handleRestoreIncident}
              onDelete={(item) => setDeletingEntity({ type: "incident", item })}
            />
          )}

          {canDecideRequests && (filter === "all" || filter === "requests") && (
            <TrashRequestSection
              items={trashedRequests}
              busyId={busyId}
              onRestore={handleRestoreRequest}
              onDelete={(item) => setDeletingEntity({ type: "request", item })}
            />
          )}

          {(filter === "all" || filter === "storage") && (
            <TrashStorageSection
              trashData={trash}
              storagePending={storagePending}
              storageKept={storageKept}
              storageTotal={storageTotal}
              retentionDays={retentionDays}
              busyId={busyId}
              onRestore={handleRestoreStorage}
              onDelete={(item) => setDeletingEntity({ type: "storage", item })}
            />
          )}
        </div>
      )}

      <TrashDeleteDialog
        entity={deletingEntity}
        busyId={busyId}
        onClose={() => setDeletingEntity(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
