import { useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { QueueToolbar, type QueueSortId } from "./QueueToolbar";
import { ArchiveDetailHost } from "./archive/components/ArchiveDetailHost";
import { ArchiveFilterTabs } from "./archive/components/ArchiveFilterTabs";
import { ArchiveListSection } from "./archive/components/ArchiveListSection";
import { ArchiveTrashSection } from "./archive/components/ArchiveTrashSection";
import { BulkArchiveCard } from "./archive/components/BulkArchiveCard";
import { useArchiveData } from "./archive/hooks/useArchiveData";
import { useArchiveEntries } from "./archive/hooks/useArchiveEntries";
import { useBulkArchive } from "./archive/hooks/useBulkArchive";
import { useTrashOperations } from "./archive/hooks/useTrashOperations";
import {
  SORT_OPTIONS,
  type ArchiveKind,
  type OpenArchivedDoc,
} from "./archive/types";

export type { OpenArchivedDoc } from "./archive/types";

export interface ArchiveViewProps {
  canArchiveIncidents?: boolean;
  canArchiveRequests?: boolean;
  /** Puede leer el almacén: la ficha enseña el stock de cada línea. */
  canViewCatalog?: boolean;
  /** Puede leer el inventario: la ficha enlaza el equipo del caso. */
  canViewEquipment?: boolean;
  currentUserId?: Id<"users"> | null;
  /** Firma los informes que se exportan desde la ficha. */
  currentUserName?: string;
  /** Abrir una petición en su módulo, desde la ficha de la incidencia. */
  onOpenRequest?: (id: Id<"partRequests">) => void;
  /**
   * La ficha que hay que abrir al entrar. La usa el buscador global para llevar
   * una ficha archivada a su ficha en vez de a una cola donde ya no está.
   */
  initialEntry?: OpenArchivedDoc | null;
  /** Abre «Ajustes del taller», donde se configura el archivado automático. */
  onOpenSettings?: () => void;
}

/**
 * Archivo del taller: lo que ya está cerrado y decidido sale del día a día y
 * vive aquí. Se busca y se ordena igual que las colas (misma barra), se agrupa
 * por fecha de archivo y desde aquí se recupera lo que haga falta. También es
 * donde se hace la limpieza a mano: mandar de golpe al archivo todo lo
 * terminado antes de una fecha.
 */
export function ArchiveView({
  canArchiveIncidents = false,
  canArchiveRequests = false,
  canViewCatalog = false,
  canViewEquipment = false,
  currentUserId = null,
  currentUserName = "",
  onOpenRequest,
  initialEntry,
  onOpenSettings,
}: ArchiveViewProps) {
  const {
    allIncidents,
    allRequests,
    incidents,
    requests,
    activeIncidents,
    activeRequests,
    parts,
    equipment,
    trashedIncidentRows,
    trashedRequestRows,
    trashRetentionDays,
  } = useArchiveData({
    canArchiveIncidents,
    canArchiveRequests,
    canViewCatalog,
    canViewEquipment,
  });

  // Estado local de la vista
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<QueueSortId>("recent");
  const [kind, setKind] = useState<ArchiveKind>("all");
  const [compact, setCompact] = useState(false);
  const [openEntry, setOpenEntry] = useState<OpenArchivedDoc | null>(
    initialEntry ?? null,
  );

  // Pipeline memoizado de entradas
  const { allEntries, ordered, counts } = useArchiveEntries({
    incidents,
    requests,
    search,
    kind,
    sort,
  });

  // Operaciones de archivado masivo
  const {
    cutoffMonths,
    setCutoffMonths,
    cutoff,
    pending,
    canArchiveSomething,
    bulkTarget,
    setBulkTarget,
    bulkBusy,
    handleBulkArchive,
  } = useBulkArchive({
    activeIncidents,
    activeRequests,
    canArchiveIncidents,
    canArchiveRequests,
  });

  // Operaciones de papelera y desarchivado
  const {
    busyId,
    trashBusyId,
    trashDeleting,
    setTrashDeleting,
    trashOpen,
    setTrashOpen,
    handleRestore,
    handleTrashRestore,
    handleTrashDelete,
  } = useTrashOperations();

  return (
    <div className="flex flex-col gap-5">
      <BulkArchiveCard
        canArchiveIncidents={canArchiveIncidents}
        canArchiveRequests={canArchiveRequests}
        cutoffMonths={cutoffMonths}
        setCutoffMonths={setCutoffMonths}
        cutoff={cutoff}
        pending={pending}
        canArchiveSomething={canArchiveSomething}
        bulkTarget={bulkTarget}
        setBulkTarget={setBulkTarget}
        bulkBusy={bulkBusy}
        onBulkArchive={handleBulkArchive}
        onOpenSettings={onOpenSettings}
      />

      <ArchiveFilterTabs
        kind={kind}
        onKindChange={setKind}
        counts={counts}
      />

      <QueueToolbar
        search={search}
        onSearchChange={setSearch}
        placeholder="Buscar en el archivo: referencia, equipo, persona, repuesto…"
        sort={sort}
        onSortChange={setSort}
        sortOptions={SORT_OPTIONS}
        compact={compact}
        onCompactChange={setCompact}
        noun="fichas archivadas"
      />

      <ArchiveListSection
        search={search}
        onClearSearch={() => setSearch("")}
        totalEntries={allEntries.length}
        filteredEntries={ordered}
        sort={sort}
        kind={kind}
        compact={compact}
        canArchiveIncidents={canArchiveIncidents}
        canArchiveRequests={canArchiveRequests}
        busyId={busyId}
        onOpenEntry={setOpenEntry}
        onRestore={handleRestore}
      />

      <ArchiveTrashSection
        trashedIncidentRows={trashedIncidentRows}
        trashedRequestRows={trashedRequestRows}
        trashRetentionDays={trashRetentionDays}
        trashBusyId={trashBusyId}
        trashDeleting={trashDeleting}
        setTrashDeleting={setTrashDeleting}
        onOpen={setTrashOpen}
        onRestore={handleTrashRestore}
        onDeleteNow={handleTrashDelete}
      />

      <ArchiveDetailHost
        openEntry={openEntry}
        onCloseEntry={() => setOpenEntry(null)}
        trashOpen={trashOpen}
        onCloseTrash={() => setTrashOpen(null)}
        allIncidents={allIncidents}
        allRequests={allRequests}
        parts={parts}
        equipment={equipment}
        canViewCatalog={canViewCatalog}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
        onOpenRequest={onOpenRequest}
      />
    </div>
  );
}
