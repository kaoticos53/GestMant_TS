import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Check, ClipboardList, FileDown, Plus, SearchX, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ListArea } from "@/components/ListArea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TablePagination } from "@/components/TablePagination";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { csvFilename, downloadCsv, toCsv } from "@/lib/export";
import { richDocToPlainText } from "@/lib/richDoc";
import { cn } from "@/lib/utils";
import {
  PRIORITY_META,
  STATUS_META,
  equipmentLabel,
  formatDateTime,
  getErrorMessage,
} from "@/lib/workshop";

import { QueueToolbar } from "./QueueToolbar";
import {
  FILTERS,
  SORT_OPTIONS,
  type DecisionMode,
  type RequestDoc,
  type RequestFilterId,
} from "./requests/types";
import { stepReason } from "./requests/helpers";
import { useRequestFilters } from "./requests/hooks/useRequestFilters";
import { RequestCard } from "./requests/components/RequestCard";
import { RequestDetailSheet } from "./requests/components/RequestDetailSheet";
import { DecisionDialog } from "./requests/dialogs/DecisionDialog";
import { AssociateDialog } from "./requests/dialogs/AssociateDialog";
import { NewRequestDialog } from "./requests/dialogs/NewRequestDialog";

export function RequestsView({
  equipmentFilter = "all",
  onEquipmentFilterChange = () => {},
  canManage = false,
  canPurchase = false,
  initialDetailId = null,
  initialFilter = "all",
}: {
  /** Modelo del inventario por el que se filtra la cola ("all" = sin filtro). */
  equipmentFilter?: string;
  onEquipmentFilterChange?: (value: string) => void;
  /** Solo responsable de repuestos/admin deciden peticiones (fail-closed). */
  canManage?: boolean;
  /** Puede generar peticiones de compra cuando el almacén no cubre la petición. */
  canPurchase?: boolean;
  /** Petición abierta al montar (la elige la búsqueda global). */
  initialDetailId?: Id<"partRequests"> | null;
  /** Estado con el que se abre la cola (lo eligen las tarjetas del resumen). */
  initialFilter?: RequestFilterId;
}) {
  const requests = useQuery(api.partRequests.list, {}) ?? [];
  const parts = useQuery(api.spareParts.list) ?? [];
  const equipment = useQuery(api.equipment.list, {}) ?? [];
  const resume = useMutation(api.partRequests.resume);
  const archiveRequest = useMutation(api.partRequests.archive);

  const [decision, setDecision] = useState<{
    request: RequestDoc;
    mode: DecisionMode;
  } | null>(null);
  const [resumingId, setResumingId] = useState<string | null>(null);
  const [associateTarget, setAssociateTarget] = useState<RequestDoc | null>(
    null,
  );
  const [newOpen, setNewOpen] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const {
    filter,
    setFilter,
    detailId,
    setDetailId,
    search,
    setSearch,
    sort,
    setSort,
    compact,
    setCompact,
    filterEquipment,
    filtered,
    paging,
    areaRef,
    sections,
    counts,
    emptyByEquipment,
    detailRequest,
  } = useRequestFilters({
    requests,
    equipment,
    equipmentFilter,
    initialFilter,
    initialDetailId,
  });

  // Lo que se pide abrir y no está en la cola: una petición archivada, a la que
  // enlaza la ficha de su incidencia. Se pide solo esa, en vez de cargar el
  // archivo entero con sus adjuntos, y se abre en solo lectura.
  const focused = useQuery(
    api.partRequests.detail,
    detailId !== null && !requests.some((request) => request._id === detailId)
      ? { requestId: detailId }
      : "skip",
  );
  const openRequest = detailRequest ?? focused ?? null;

  const handleResume = async (request: RequestDoc) => {
    setResumingId(request._id);
    try {
      await resume({ requestId: request._id });
      toast.success(`${request.reference} reanudada`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setResumingId(null);
    }
  };

  const handleArchive = async (request: RequestDoc) => {
    setArchivingId(request._id);
    try {
      await archiveRequest({ requestId: request._id });
      toast.success(
        `${request.reference} al archivo · puedes recuperarla desde Archivo`,
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setArchivingId(null);
    }
  };

  const handleExport = () => {
    const header = [
      "Referencia",
      "Estado",
      "Prioridad",
      "Solicitante",
      "Área",
      "Equipo",
      "Líneas",
      "Descripción",
      "Notas",
      "Decisión",
      "Motivo",
      "Decidido por",
      "Creada",
      "Decidida",
      "Entregada",
    ];
    const rows = filtered.map((request) => [
      request.reference,
      STATUS_META[request.status].label,
      PRIORITY_META[request.priority].label,
      request.requesterName,
      request.requesterTeam ?? "",
      request.equipment ?? "",
      (request.lines ?? [])
        .map((line) => `${line.code} ${line.name} x${line.quantity}`)
        .join(" | "),
      richDocToPlainText(request.description),
      richDocToPlainText(request.notes),
      richDocToPlainText(request.decisionNote),
      stepReason(request),
      request.decidedBy ?? "",
      formatDateTime(request.createdAt),
      request.decidedAt ? formatDateTime(request.decidedAt) : "",
      request.issuedAt ? formatDateTime(request.issuedAt) : "",
    ]);
    downloadCsv(csvFilename("peticiones"), toCsv(header, rows));
    toast.success(`Peticiones exportadas: ${rows.length}`);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          {/* Una sola línea de filtros, con su estado anunciado: era la fila que
              más alto empujaba la cola cuando había diez estados. */}
          <div
            role="group"
            aria-label="Filtrar peticiones por estado"
            className="flex min-w-0 flex-1 flex-wrap items-center gap-0.5 rounded-lg border border-border/70 bg-card p-1 shadow-sm max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:[scrollbar-width:none] max-sm:[&::-webkit-scrollbar]:hidden"
          >
            {FILTERS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={filter === option.id}
                onClick={() => setFilter(option.id)}
                className={cn(
                  "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  filter === option.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
                <span className="ml-1.5 text-xs tabular-nums opacity-70">
                  {counts[option.id]}
                </span>
              </button>
            ))}
          </div>

          <Select
            value={equipmentFilter}
            onValueChange={onEquipmentFilterChange}
          >
            <SelectTrigger
              className="w-full sm:w-56"
              aria-label="Filtrar peticiones por equipo"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los equipos</SelectItem>
              {equipment.map((item) => (
                <SelectItem key={item._id} value={item._id}>
                  {equipmentLabel(item)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={handleExport}
            disabled={filtered.length === 0}
            title="Descarga en CSV las peticiones que se ven filtradas"
          >
            <FileDown className="size-4" />
            Exportar CSV ({filtered.length})
          </Button>
          <Button
            type="button"
            className="gap-2"
            onClick={() => setNewOpen(true)}
          >
            <Plus className="size-4" />
            Nueva petición
          </Button>
        </div>
      </div>

      <QueueToolbar
        search={search}
        onSearchChange={setSearch}
        placeholder="Buscar por referencia, solicitante, repuesto, equipo…"
        sort={sort}
        onSortChange={setSort}
        sortOptions={SORT_OPTIONS}
        compact={compact}
        onCompactChange={setCompact}
        noun="peticiones"
      />

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center shadow-sm">
          <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-signal/10 text-signal">
            {search !== "" ? (
              <SearchX className="size-5" />
            ) : filter === "pending" && !emptyByEquipment ? (
              <Check className="size-5" />
            ) : (
              <ClipboardList className="size-5" />
            )}
          </span>
          <p className="mt-4 text-base font-semibold tracking-tight">
            {search !== ""
              ? `Ninguna petición coincide con «${search}»`
              : emptyByEquipment
                ? `No hay peticiones de ${filterEquipment?.model ?? "ese equipo"}`
                : filter === "pending"
                  ? "No hay peticiones pendientes"
                  : "No hay peticiones en este estado"}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
            {search !== ""
              ? "Prueba con otra referencia, un repuesto o el nombre de quien la pide, o limpia la búsqueda."
              : emptyByEquipment
                ? "Ninguna petición coincide con este equipo. Prueba con otro o quita el filtro."
                : filter === "pending"
                  ? "La cola está al día: no hay nada que revisar ahora mismo."
                  : "Cambia de filtro o registra una petición de repuestos."}
          </p>
          {search !== "" ? (
            <Button
              type="button"
              variant="outline"
              className="mt-5 gap-2"
              onClick={() => setSearch("")}
            >
              <X className="size-4" />
              Limpiar la búsqueda
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="mt-5 gap-2"
              onClick={() => setNewOpen(true)}
            >
              <Plus className="size-4" />
              Nueva petición
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <ListArea
            ref={areaRef}
            resetKey={`${search}|${sort}|${filter}|${paging.page}`}
          >
            <div className="flex flex-col gap-5">
              {sections.map((section) => (
                <section key={section.key} className="flex flex-col gap-3">
                  {section.label !== "" && (
                    <h2
                      data-row-header
                      className="flex items-center justify-between gap-2 rounded-md bg-background/85 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur-sm lg:sticky lg:top-0 lg:z-10"
                    >
                      {section.label}
                      <span className="tabular-nums opacity-70">
                        {section.items.length}
                      </span>
                    </h2>
                  )}
                  <div className={compact ? "grid gap-2" : "grid gap-4"}>
                    {section.items.map((request) => (
                      <RequestCard
                        key={request._id}
                        request={request}
                        compact={compact}
                        canManage={canManage}
                        onOpen={() => setDetailId(request._id)}
                        onAssociate={() => setAssociateTarget(request)}
                        onApprove={() =>
                          setDecision({ request, mode: "approve" })
                        }
                        onReject={() =>
                          setDecision({ request, mode: "reject" })
                        }
                        onIssue={() => setDecision({ request, mode: "issue" })}
                        onArchive={() => void handleArchive(request)}
                        archiving={archivingId === request._id}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </ListArea>

          <TablePagination
            paging={paging}
            singular="petición"
            plural="peticiones"
            className="rounded-xl border border-border/70 bg-card shadow-sm"
          />
        </div>
      )}

      {decision && (
        <DecisionDialog
          request={decision.request}
          mode={decision.mode}
          parts={parts}
          canPurchase={canPurchase}
          onClose={() => setDecision(null)}
        />
      )}

      {associateTarget && (
        <AssociateDialog
          key={associateTarget._id}
          request={associateTarget}
          parts={parts}
          equipment={equipment}
          onClose={() => setAssociateTarget(null)}
        />
      )}

      {openRequest && (
        <RequestDetailSheet
          request={openRequest}
          parts={parts}
          // Lo archivado se abre en solo lectura: su trabajo terminó y sus pasos
          // ya no se dan desde la cola. Quien quiera volver a tramitarla la
          // recupera desde Archivo, que es donde vive.
          canManage={canManage && openRequest.archivedAt === undefined}
          onClose={() => setDetailId(null)}
          onAssociate={() => setAssociateTarget(openRequest)}
          onApprove={() =>
            setDecision({ request: openRequest, mode: "approve" })
          }
          onReject={() => setDecision({ request: openRequest, mode: "reject" })}
          onIssue={() => setDecision({ request: openRequest, mode: "issue" })}
          onHold={() => setDecision({ request: openRequest, mode: "hold" })}
          onReturn={() => setDecision({ request: openRequest, mode: "return" })}
          onCancel={() => setDecision({ request: openRequest, mode: "cancel" })}
          onResume={() => void handleResume(openRequest)}
          resuming={resumingId === openRequest._id}
        />
      )}

      {newOpen && (
        <NewRequestDialog
          parts={parts}
          equipment={equipment}
          onClose={() => setNewOpen(false)}
        />
      )}
    </div>
  );
}
