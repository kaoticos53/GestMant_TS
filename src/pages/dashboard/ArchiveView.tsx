import { useState } from "react";
import { Download, X } from "lucide-react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { csvFilename, downloadCsv, toCsv } from "@/lib/export";
import { formatDateTime } from "@/lib/workshop";
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
  KIND_META,
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
  /** Puede consultar el historial de compras vinculado a una petición. */
  canViewPurchasing?: boolean;
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
  canViewPurchasing = false,
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
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sort, setSort] = useState<QueueSortId>("recent");
  const [kind, setKind] = useState<ArchiveKind>("all");
  const [compact, setCompact] = useState(false);
  const [openEntry, setOpenEntry] = useState<OpenArchivedDoc | null>(
    initialEntry ?? null,
  );

  const rawFromMs = fromDate
    ? new Date(`${fromDate}T00:00:00`).getTime()
    : undefined;
  const rawToMs = toDate
    ? new Date(`${toDate}T23:59:59.999`).getTime()
    : undefined;
  const fromMs =
    rawFromMs !== undefined && !Number.isNaN(rawFromMs) ? rawFromMs : undefined;
  const toMs =
    rawToMs !== undefined && !Number.isNaN(rawToMs) ? rawToMs : undefined;

  // Pipeline memoizado de entradas
  const { allEntries, ordered, counts } = useArchiveEntries({
    incidents,
    requests,
    search,
    kind,
    sort,
    fromMs,
    toMs,
  });

  const handleExportCsv = () => {
    if (ordered.length === 0) {
      toast.info("No hay fichas archivadas filtradas para exportar.");
      return;
    }
    const header = [
      "Tipo",
      "Referencia",
      "Título",
      "Detalle",
      "Estado",
      "Fecha de archivo",
      "Archivado por",
    ];
    const rows = ordered.map((entry) => [
      KIND_META[entry.kind].label,
      entry.reference,
      entry.title,
      entry.subtitle,
      entry.statusLabel,
      formatDateTime(entry.date),
      entry.archivedBy ?? "",
    ]);
    downloadCsv(csvFilename("archivo-taller"), toCsv(header, rows));
    toast.success(`Exportadas ${ordered.length} fichas archivadas.`);
  };

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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ArchiveFilterTabs
          kind={kind}
          onKindChange={setKind}
          counts={counts}
        />

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              aria-label="Archivado desde"
              title="Archivado desde"
              className="h-9 w-[140px]"
            />
            <span className="text-xs text-muted-foreground">a</span>
            <Input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              aria-label="Archivado hasta"
              title="Archivado hasta"
              className="h-9 w-[140px]"
            />
            {(fromDate !== "" || toDate !== "") && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 gap-1 px-2 text-xs text-muted-foreground"
                onClick={() => {
                  setFromDate("");
                  setToDate("");
                }}
              >
                <X className="size-3.5" />
                Limpiar fechas
              </Button>
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1.5"
            onClick={handleExportCsv}
            disabled={ordered.length === 0}
          >
            <Download className="size-4" />
            Exportar CSV ({ordered.length})
          </Button>
        </div>
      </div>

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
        onClearSearch={() => {
          setSearch("");
          setFromDate("");
          setToDate("");
        }}
        totalEntries={allEntries.length}
        filteredEntries={ordered}
        sort={sort}
        kind={kind}
        dateKey={`${fromDate}|${toDate}`}
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
        canViewPurchasing={canViewPurchasing}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
        onOpenRequest={onOpenRequest}
      />
    </div>
  );
}
