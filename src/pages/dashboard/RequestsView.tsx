import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AttachmentGroup } from "@/components/AttachmentGroup";
import { AttachmentImage } from "@/components/AttachmentImage";
import { ListArea } from "@/components/ListArea";
import { TablePagination } from "@/components/TablePagination";
import { RichText } from "@/components/RichText";
import { RichTextEditor } from "@/components/RichTextEditor";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { groupByDate, matchesQuery, sortByDate } from "@/lib/browse";
import { csvFilename, downloadCsv, toCsv } from "@/lib/export";
import {
  richDocIsEmpty,
  richDocToPlainText,
  richDocToStore,
} from "@/lib/richDoc";
import {
  FILE_ACCEPT,
  MAX_FILE_SIZE_LABEL,
  compressForUpload,
  exceedsFileLimit,
  uploadToStorage,
} from "@/lib/upload";
import { cn } from "@/lib/utils";
import {
  PART_CATEGORIES,
  PRIORITY_META,
  STATUS_META,
  equipmentLabel,
  formatDateTime,
  formatRelativeTime,
  getErrorMessage,
  requestMatchesEquipment,
  type Priority,
} from "@/lib/workshop";
import { useRowsThatFit } from "@/hooks/use-rows-that-fit";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { useMutation, useQuery } from "convex/react";
import {
  Archive,
  ArrowRight,
  Ban,
  Check,
  CircleAlert,
  CirclePause,
  ClipboardList,
  Clock,
  FileDown,
  FileText,
  Image as ImageIcon,
  Loader2,
  PackageCheck,
  Paperclip,
  Plus,
  RotateCcw,
  SearchX,
  ShoppingCart,
  Upload,
  User,
  Wrench,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  QueueToolbar,
  type QueueSortId,
  type QueueSortOption,
} from "./QueueToolbar";

/** Adjunto con su URL ya resuelta desde el almacenamiento de Convex. */
type RequestAttachment = {
  storageId: Id<"_storage">;
  name: string;
  kind: "image" | "document";
  url: string | null;
};

type RequestDoc = Omit<Doc<"partRequests">, "attachments"> & {
  attachments: RequestAttachment[];
};
type PartDoc = Doc<"spareParts">;
type EquipmentDoc = Doc<"equipment">;
type RequestStatusId = RequestDoc["status"];
/** Filtro de la cola: todos o un estado concreto (lo usan el menú y las tarjetas del resumen). */
export type RequestFilterId = "all" | RequestStatusId;

const STATUS_RANK: Record<RequestStatusId, number> = {
  pending: 0,
  onHold: 1,
  pendingSupplierQuote: 2,
  // El material comprado ya ha entrado: es lo primero que hay que resolver.
  materialReceived: 3,
  approved: 4,
  issued: 5,
  returned: 6,
  rejected: 7,
  cancelled: 8,
};

const PRIORITY_RANK: Record<RequestDoc["priority"], number> = {
  urgent: 0,
  normal: 1,
  low: 2,
};

/** Órdenes disponibles cuando la cola es larga. */
const SORT_OPTIONS: QueueSortOption[] = [
  { id: "recent", label: "Fecha: más recientes primero" },
  { id: "oldest", label: "Fecha: más antiguas primero" },
  { id: "queue", label: "Orden de trabajo: pendientes primero" },
];

const FILTERS: { id: RequestFilterId; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "pending", label: "Pendientes" },
  { id: "approved", label: "Aprobadas" },
  { id: "issued", label: "Entregadas" },
  { id: "onHold", label: "En espera" },
  { id: "returned", label: "Devueltas" },
  { id: "rejected", label: "Rechazadas" },
  { id: "cancelled", label: "Canceladas" },
  { id: "pendingSupplierQuote", label: "Presupuesto pendiente" },
  { id: "materialReceived", label: "Material recibido" },
];

/** Orden de trabajo: lo que está pendiente y lo urgente primero. */
function inQueueOrder(requests: RequestDoc[]): RequestDoc[] {
  return [...requests].sort(
    (a, b) =>
      STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      b.createdAt - a.createdAt,
  );
}

/** Todo lo que identifica una petición para el buscador. */
function searchableFields(request: RequestDoc): (string | undefined)[] {
  return [
    request.reference,
    request.requesterName,
    request.requesterTeam,
    request.equipment,
    // Se busca por el texto: el formato del editor no pinta nada en un filtro.
    richDocToPlainText(request.description),
    richDocToPlainText(request.notes),
    richDocToPlainText(request.decisionNote),
    richDocToPlainText(request.issueNote),
    richDocToPlainText(request.holdNote),
    richDocToPlainText(request.returnNote),
    richDocToPlainText(request.cancelNote),
    request.decidedBy,
    STATUS_META[request.status]?.label ?? STATUS_META.pending.label,
    PRIORITY_META[request.priority as Priority].label,
    request.lines.map((line) => `${line.code} ${line.name}`).join(" "),
  ];
}

function countByStatus(
  requests: RequestDoc[],
): Record<RequestFilterId, number> {
  const counts: Record<RequestFilterId, number> = {
    all: requests.length,
    pending: 0,
    approved: 0,
    issued: 0,
    onHold: 0,
    returned: 0,
    rejected: 0,
    cancelled: 0,
    pendingSupplierQuote: 0,
    materialReceived: 0,
  };
  for (const request of requests) {
    // Future-proof: ignore statuses that do not match the current UI filter map.
    if ("status" in request && request.status in counts)
      counts[request.status] += 1;
  }
  return counts;
}

/**
 * La decisión de una petición en una línea: quién la tomó, cuándo y por qué.
 *
 * El motivo se escribe con el editor —tiene formato—, así que aquí se aplana:
 * la cola se lee de un vistazo y una lista con viñetas en medio de la tarjeta
 * no ayuda a eso. Con formato se lee en la ficha.
 */
function decisionLine(request: RequestDoc): string {
  const reason = (value: string | undefined) =>
    value && !richDocIsEmpty(value) ? ` · ${richDocToPlainText(value)}` : "";
  const at = (value: number | undefined) =>
    value ? ` · ${formatDateTime(value)}` : "";

  switch (request.status) {
    case "approved":
      return `Aprobada por ${request.decidedBy ?? "el responsable"}${at(
        request.decidedAt,
      )}${reason(request.decisionNote)}`;
    case "rejected":
      return `Rechazada por ${request.decidedBy ?? "el responsable"}${reason(
        request.decisionNote,
      )}`;
    case "issued":
      return `Material entregado${at(request.issuedAt)}${reason(
        request.issueNote,
      )}`;
    case "onHold":
      return `En espera${at(request.holdSinceAt)}${reason(request.holdNote)}`;
    case "returned":
      return `Material devuelto${at(request.returnedAt)}${reason(
        request.returnNote,
      )}`;
    case "cancelled":
      return `Cancelada${at(request.cancelledAt)}${reason(request.cancelNote)}`;
    case "pendingSupplierQuote":
      return `Presupuesto externo en curso${at(request.quoteRequestedAt)}${reason(
        request.decisionNote,
      )}`;
    default:
      return "";
  }
}

/**
 * El motivo del último paso (la entrega, la espera, la devolución o la
 * cancelación) tal cual, sin el resto de la frase: es lo que se lee en una
 * línea cuando no cabe el formato. Vacío si ese paso no se explicó.
 */
function stepReason(request: RequestDoc): string {
  switch (request.status) {
    case "issued":
      return richDocToPlainText(request.issueNote);
    case "onHold":
      return richDocToPlainText(request.holdNote);
    case "returned":
      return richDocToPlainText(request.returnNote);
    case "cancelled":
      return richDocToPlainText(request.cancelNote);
    default:
      return "";
  }
}

function attachmentCounts(request: RequestDoc) {
  let images = 0;
  let documents = 0;
  for (const attachment of request.attachments) {
    if (attachment.kind === "image") images += 1;
    else documents += 1;
  }
  return { images, documents };
}

export function RequestsView({
  requests,
  parts,
  equipment: equipmentProp,
  equipmentFilter = "all",
  onEquipmentFilterChange = () => {},
  canManage = false,
  canPurchase = false,
  initialDetailId = null,
  initialFilter = "all",
}: {
  requests: RequestDoc[];
  parts: PartDoc[];
  equipment: EquipmentDoc[];
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
  const resume = useMutation(api.partRequests.resume);
  // Tolerancia a módulos desactualizados en caliente (el prop puede faltar)
  const equipment = equipmentProp ?? [];

  const [filter, setFilter] = useState<RequestFilterId>(initialFilter);
  const [detailId, setDetailId] = useState<Id<"partRequests"> | null>(
    initialDetailId ?? null,
  );
  const [decision, setDecision] = useState<{
    request: RequestDoc;
    mode: DecisionMode;
  } | null>(null);
  const [resumingId, setResumingId] = useState<string | null>(null);
  const [associateTarget, setAssociateTarget] = useState<RequestDoc | null>(
    null,
  );
  const [newOpen, setNewOpen] = useState(false);
  // Archivar desde la propia tarjeta (sin abrir el detalle).
  const archiveRequest = useMutation(api.partRequests.archive);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  // Cola larga: buscar, ordenar por fecha y enseñarla por páginas.
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<QueueSortId>("recent");
  const [compact, setCompact] = useState(false);

  const filterEquipment = equipment.find(
    (item) => item._id === equipmentFilter,
  );
  const byEquipment = requests.filter((request) =>
    requestMatchesEquipment(request, filterEquipment),
  );
  const matched = byEquipment.filter((request) =>
    matchesQuery(searchableFields(request), search),
  );
  const filtered =
    filter === "all"
      ? matched
      : matched.filter((request) => request.status === filter);

  const byDate = sort !== "queue";
  const ordered = byDate
    ? sortByDate(filtered, (request) => request.createdAt, sort)
    : inQueueOrder(filtered);
  // La misma medida que en las tablas: cuántas fichas caben en el alto del área
  // —contadas por el navegador— y la cola partida en páginas con esas fichas. La
  // vista compacta encoge cada ficha, así que vuelve a medir a propósito.
  const { areaRef, rowsFit } = useRowsThatFit({
    shape: "cards",
    remeasureKey: compact,
  });
  const paging = useTablePagination({
    total: ordered.length,
    rowsFit,
    // Cambiar lo que se mira devuelve a la primera página.
    resetKey: `${search}|${sort}|${filter}`,
  });
  const visible = ordered.slice(paging.from - 1, paging.to);
  // Por fecha se separa por épocas (hoy, ayer, meses…); con el orden de trabajo
  // la lista va seguida, porque agrupar rompería la prioridad.
  const sections = byDate
    ? groupByDate(visible, (request) => request.createdAt)
    : [{ key: "queue", label: "", items: visible }];

  const counts = countByStatus(matched);
  const emptyByEquipment = Boolean(filterEquipment) && byEquipment.length === 0;
  const detailRequest = detailId
    ? (requests.find((request) => request._id === detailId) ?? null)
    : null;

  /**
   * Reanudar una petición en espera: vuelve a la cola del día a día. No lleva
   * motivo, porque no decide nada nuevo: deshace la espera.
   */
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

  /**
   * Manda una petición decidida al archivo desde la propia tarjeta: sale de la
   * cola del día a día y se recupera desde el módulo Archivo.
   */
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

  /** Descarga en CSV exactamente lo que se ve: estado, modelo y búsqueda. */
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
      // El motivo del último paso, aparte de la decisión: entregas, esperas…
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
      // El motivo va en una línea: el CSV no admite formato.
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
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex flex-wrap rounded-lg border border-border/70 bg-card p-1 shadow-sm">
            {FILTERS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setFilter(option.id)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
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
          {/* El alto de las fichas queda acotado a la pantalla, así que se
              recorren con la barra del propio listado y el rótulo del día se
              queda pegado arriba. El pie con la paginación va fuera: sigue a la
              vista sin tener que bajar hasta el final. */}
          <ListArea
            ref={areaRef}
            resetKey={`${search}|${sort}|${filter}|${paging.page}`}
          >
            <div className="flex flex-col gap-5">
              {sections.map((section) => (
                <section key={section.key} className="flex flex-col gap-3">
                  {/* El rótulo se pega arriba solo en escritorio: en móvil la
                  cabecera de la aplicación ya ocupa ese sitio. */}
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

      {detailRequest && (
        <RequestDetailSheet
          request={detailRequest}
          parts={parts}
          canManage={canManage}
          onClose={() => setDetailId(null)}
          onAssociate={() => setAssociateTarget(detailRequest)}
          onApprove={() =>
            setDecision({ request: detailRequest, mode: "approve" })
          }
          onReject={() =>
            setDecision({ request: detailRequest, mode: "reject" })
          }
          onIssue={() => setDecision({ request: detailRequest, mode: "issue" })}
          onHold={() => setDecision({ request: detailRequest, mode: "hold" })}
          onCancel={() =>
            setDecision({ request: detailRequest, mode: "cancel" })
          }
          onResume={() => void handleResume(detailRequest)}
          resuming={resumingId === detailRequest._id}
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

/* ------------------------------------------------------------------ */
/* Tarjeta de petición                                                 */
/* ------------------------------------------------------------------ */

function RequestCard({
  request,
  compact = false,
  canManage,
  archiving = false,
  onOpen,
  onAssociate,
  onApprove,
  onReject,
  onIssue,
  onArchive,
}: {
  request: RequestDoc;
  /** Tarjeta reducida: para recorrer colas largas de un vistazo. */
  compact?: boolean;
  canManage: boolean;
  /** Esta petición se está mandando al archivo ahora mismo. */
  archiving?: boolean;
  onOpen: () => void;
  onAssociate: () => void;
  onApprove: () => void;
  onReject: () => void;
  onIssue: () => void;
  onArchive: () => void;
}) {
  const status = STATUS_META[request.status] ?? STATUS_META.pending;
  const priority = PRIORITY_META[request.priority as Priority];
  const units = request.lines.reduce((sum, line) => sum + line.quantity, 0);
  const noReference = request.lines.length === 0;
  const { images, documents } = attachmentCounts(request);

  return (
    <article
      data-row
      className={cn(
        "rounded-xl border border-border/70 bg-card shadow-sm transition-colors hover:border-signal/40",
        compact ? "p-3" : "p-4 sm:p-5",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-semibold tracking-wide text-muted-foreground">
            {request.reference}
          </span>
          <Badge variant="outline" className={priority.badgeClassName}>
            {priority.label}
          </Badge>
          <Badge variant="outline" className={status.badgeClassName}>
            <span
              className={cn("size-1.5 rounded-full", status.dotClassName)}
            />
            {status.label}
          </Badge>
          {noReference && (
            <Badge
              variant="outline"
              className="border-amber-500/25 bg-amber-500/10 text-amber-700"
            >
              <Wrench className="size-3" />
              Sin repuesto
            </Badge>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {formatRelativeTime(request.createdAt)}
        </span>
      </div>

      <div className="mt-3">
        <p className="text-base font-semibold tracking-tight">
          {request.requesterName}
          {request.requesterTeam && (
            <span className="font-normal text-muted-foreground">
              {" "}
              · {request.requesterTeam}
            </span>
          )}
        </p>
        {request.equipment && (
          <p className="mt-0.5 text-sm text-muted-foreground">
            Equipo afectado: {request.equipment}
          </p>
        )}
      </div>

      {request.description && (
        <RichText
          value={request.description}
          className="mt-3 line-clamp-2 text-sm leading-6 text-foreground/80"
        />
      )}

      {request.lines.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {request.lines.map((line) => (
            <li
              key={line.sparePartId}
              className="flex max-w-full items-center gap-2 rounded-lg border border-border/70 bg-muted/50 px-2.5 py-1.5 text-xs"
            >
              <span className="font-mono font-medium">{line.code}</span>
              <span className="max-w-[14ch] truncate text-muted-foreground sm:max-w-[24ch]">
                {line.name}
              </span>
              <span className="font-semibold tabular-nums">
                ×{line.quantity}
              </span>
            </li>
          ))}
        </ul>
      )}

      {noReference && request.status === "pending" && (
        <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs leading-5 text-amber-800">
          <Wrench className="mt-0.5 size-3.5 shrink-0" />
          Petición sin repuesto: investiga el proveedor y su nº de parte antes
          de aprobar.
        </p>
      )}

      {request.attachments.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5 rounded-lg border border-border/70 bg-muted/50 px-2.5 py-1.5">
            <Paperclip className="size-3.5" />
            {request.attachments.length} adjuntos
          </span>
          {images > 0 && (
            <span className="flex items-center gap-1.5 rounded-lg border border-border/70 bg-muted/50 px-2.5 py-1.5">
              <ImageIcon className="size-3.5" />
              {images} fotos
            </span>
          )}
          {documents > 0 && (
            <span className="flex items-center gap-1.5 rounded-lg border border-border/70 bg-muted/50 px-2.5 py-1.5">
              <FileText className="size-3.5" />
              {documents} documentos
            </span>
          )}
        </div>
      )}

      {request.notes && (
        // La nota la escribe el editor, así que se pinta con su formato: las
        // comillas eran el adorno de las notas de texto plano.
        <RichText
          value={request.notes}
          className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-sm italic leading-6 text-muted-foreground"
        />
      )}

      {request.status !== "pending" && decisionLine(request) !== "" && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="size-3.5" />
          {decisionLine(request)}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
        <span className="text-xs text-muted-foreground">
          {noReference
            ? "Sin repuestos asociados"
            : `${request.lines.length} líneas · ${units} unidades`}
        </span>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onOpen}>
            Ver detalle
          </Button>
          {canManage && request.status === "pending" && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onReject}
              >
                Rechazar
              </Button>
              {noReference ? (
                <Button
                  type="button"
                  size="sm"
                  className="gap-1.5"
                  onClick={onAssociate}
                >
                  <Wrench className="size-3.5" />
                  Asociar repuesto
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className="gap-1.5"
                  onClick={onApprove}
                >
                  <Check className="size-3.5" />
                  Aprobar
                </Button>
              )}
            </>
          )}
          {canManage && request.status === "approved" && (
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              onClick={onIssue}
            >
              <PackageCheck className="size-3.5" />
              Marcar entregada
            </Button>
          )}
          {/* El archivo es solo para lo ya decidido. */}
          {canManage && request.status !== "pending" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              title={`Mandar ${request.reference} al archivo`}
              aria-label={`Archivar ${request.reference}`}
              disabled={archiving}
              onClick={onArchive}
            >
              <Archive className="size-3.5" />
              Archivar
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Diálogo de aprobación / rechazo                                     */
/* ------------------------------------------------------------------ */

/**
 * Las decisiones que llevan motivo: aprobar, rechazar, entregar, poner en
 * espera y cancelar. Todas se escriben igual —el motivo, con el editor— y solo
 * cambian de rótulo y de lo que pasa después.
 */
type DecisionMode = "approve" | "reject" | "issue" | "hold" | "cancel";

/** Lo que cambia de una decisión a otra: su rótulo, su aviso y su botón. */
const DECISION_META: Record<
  DecisionMode,
  {
    title: string;
    label: string;
    placeholder: string;
    confirm: string;
    /** Qué pasa al confirmar; la aprobación lo enseña con el stock, no con una frase. */
    description?: string;
    success: (request: RequestDoc) => string;
  }
> = {
  approve: {
    title: "Aprobar petición",
    label: "Nota (opcional)",
    placeholder: "p. ej. material apartado en el mostrador 1",
    confirm: "Aprobar y descontar stock",
    success: (request) =>
      `${request.reference} aprobada: stock descontado del catálogo`,
  },
  reject: {
    title: "Rechazar petición",
    label: "Motivo del rechazo (opcional)",
    placeholder: "p. ej. pendiente de presupuesto del proveedor",
    confirm: "Rechazar petición",
    description:
      "La petición queda rechazada y el técnico verá el motivo. No se descuenta stock.",
    success: (request) => `${request.reference} rechazada`,
  },
  issue: {
    title: "Marcar como entregada",
    label: "Nota de la entrega (opcional)",
    placeholder: "p. ej. entregado en mano a Marcos Vega",
    confirm: "Marcar entregada",
    description:
      "El material sale del taller hacia el técnico que lo pidió: queda constancia de la entrega y de cómo se hizo.",
    success: (request) => `${request.reference} marcada como entregada`,
  },
  hold: {
    title: "Poner en espera",
    label: "Motivo de la espera (opcional)",
    placeholder: "p. ej. esperando confirmación del proveedor",
    confirm: "Poner en espera",
    description:
      "La petición sale del trabajo del día a día hasta que se resuelva: el material sigue apartado y se reanuda desde la ficha.",
    success: (request) => `${request.reference} en espera`,
  },
  cancel: {
    title: "Cancelar petición",
    label: "Motivo de la cancelación (opcional)",
    placeholder: "p. ej. el técnico ya no necesita el repuesto",
    confirm: "Cancelar petición",
    description:
      "La petición queda cancelada y el técnico verá el motivo. Es el final de la petición, no una espera: para retomarla habría que crear otra.",
    success: (request) => `${request.reference} cancelada`,
  },
};

/** El icono de cada decisión: el mismo que lleva el botón que la abre. */
const DECISION_ICON: Record<DecisionMode, typeof Check> = {
  approve: Check,
  reject: X,
  issue: PackageCheck,
  hold: CirclePause,
  cancel: Ban,
};

/**
 * Desde qué estados se puede poner en espera y cancelar: los mismos que deja el
 * servidor. Una petición entregada no se cancela —primero se devuelve— ni se
 * pone en espera, y una ya decidida con material apartado tampoco se cancela.
 */
const HOLDABLE: RequestStatusId[] = [
  "pending",
  "approved",
  "pendingSupplierQuote",
];
const CANCELLABLE: RequestStatusId[] = [
  "pending",
  "onHold",
  "pendingSupplierQuote",
];

function DecisionDialog({
  request,
  mode,
  parts,
  canPurchase,
  onClose,
}: {
  request: RequestDoc;
  mode: DecisionMode;
  parts: PartDoc[];
  canPurchase: boolean;
  onClose: () => void;
}) {
  const approve = useMutation(api.partRequests.approve);
  const requestPurchase = useMutation(api.purchasing.requestPurchase);
  const reject = useMutation(api.partRequests.reject);
  const markIssued = useMutation(api.partRequests.markIssued);
  const onHold = useMutation(api.partRequests.onHold);
  const cancel = useMutation(api.partRequests.cancel);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const meta = DECISION_META[mode];
  const DecisionIcon = DECISION_ICON[mode];

  const partById = new Map(parts.map((part) => [part._id, part]));
  const shortages = request.lines.filter((line) => {
    const part = partById.get(line.sparePartId);
    return !part || part.stock < line.quantity;
  });

  const isApprove = mode === "approve";
  const missingReference = isApprove && request.lines.length === 0;
  const blocked = isApprove && (missingReference || shortages.length > 0);
  // De lo que falta, qué ya está en la cola de compras: así no se compra dos
  // veces lo mismo y se ve que la petición va por buen camino. Solo se pregunta
  // si se puede mirar (el backend no contesta a quien no tiene la capacidad).
  const comprasQuery = useQuery(
    api.purchasing.byRequest,
    canPurchase ? { requestId: request._id } : ("skip" as const),
  );
  const compras = comprasQuery?.requests ?? [];
  const compradas = compras.filter(
    (row) => row.status !== "cancelled" && row.receivedAt === undefined,
  ).length;

  const handlePurchase = async () => {
    setBusy(true);
    setError(null);
    try {
      const { references, repeated } = await requestPurchase({
        requestId: request._id,
      });
      toast.success(
        references.length === 1
          ? `${references[0]} apartada para comprar`
          : `${references.length} peticiones de compra apartadas`,
        {
          description:
            repeated > 0
              ? `${repeated} línea${repeated === 1 ? "" : "s"} ya estaba${repeated === 1 ? "" : "n"} en la cola de compras.`
              : "Están sin tratar, en el módulo de compras.",
        },
      );
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async () => {
    setBusy(true);
    setError(null);
    try {
      // El editor deja un documento vacío cuando no se escribe nada: eso no es
      // un motivo, así que la decisión se firma sin él.
      const reason = richDocIsEmpty(note) ? {} : { note };
      const payload = { requestId: request._id, ...reason };
      if (mode === "approve") await approve(payload);
      else if (mode === "reject") await reject(payload);
      else if (mode === "issue") await markIssued(payload);
      else if (mode === "hold") await onHold(payload);
      else await cancel(payload);
      toast.success(meta.success(request));
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{meta.title}</DialogTitle>
          <DialogDescription>
            {request.reference} · {request.requesterName}
            {request.requesterTeam ? ` · ${request.requesterTeam}` : ""}
          </DialogDescription>
        </DialogHeader>

        {missingReference ? (
          <p className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2.5 text-sm leading-6 text-amber-800">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            Esta petición no tiene ningún repuesto asociado. Asocia el repuesto
            (del catálogo o creando uno nuevo) antes de aprobar.
          </p>
        ) : isApprove ? (
          <div className="rounded-lg border border-border/70 bg-muted/40 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Stock al aprobar
            </p>
            <ul className="mt-2 space-y-1.5">
              {request.lines.map((line) => {
                const part = partById.get(line.sparePartId);
                const remaining = (part?.stock ?? 0) - line.quantity;
                const hasShortage = !part || remaining < 0;
                return (
                  <li
                    key={line.sparePartId}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="truncate">
                      <span className="font-mono text-xs">{line.code}</span>{" "}
                      <span className="text-muted-foreground">{line.name}</span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 tabular-nums",
                        hasShortage
                          ? "font-semibold text-destructive"
                          : "text-muted-foreground",
                      )}
                    >
                      {part?.stock ?? 0} − {line.quantity} ={" "}
                      <span className="font-semibold text-foreground">
                        {Math.max(remaining, 0)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
            {shortages.length > 0 && (
              <div className="mt-3 grid gap-2 rounded-md bg-destructive/10 px-2.5 py-2 text-xs leading-5 text-destructive">
                <p className="flex items-start gap-2">
                  <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
                  {compradas > 0
                    ? `Stock insuficiente en ${shortages.length} líneas, pero ${compradas === 1 ? "ya hay una petición de compra viva" : `ya hay ${compradas} peticiones de compra vivas`} para ellas: entra en el almacén cuando llegue el material.`
                    : `Stock insuficiente en ${shortages.length} líneas. Rechaza la petición o repón el catálogo antes de aprobar.`}
                </p>
                {canPurchase && compradas < shortages.length && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-fit gap-2"
                    disabled={busy}
                    onClick={() => void handlePurchase()}
                  >
                    <ShoppingCart className="size-4" />
                    Comprar lo que falta
                  </Button>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">
            {meta.description}
          </p>
        )}

        <div className="grid gap-2">
          <Label htmlFor="decision-note">{meta.label}</Label>
          {/* El motivo se escribe con el editor, como las notas del cuaderno:
              negritas, listas y fotos si hacen falta (el presupuesto del
              proveedor, la foto del material apartado). */}
          <RichTextEditor
            id="decision-note"
            value={note}
            onChange={setNote}
            placeholder={meta.placeholder}
            disabled={busy}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={busy || blocked}
            className="gap-2"
          >
            <DecisionIcon className="size-4" />
            {meta.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Hoja de detalle                                                     */
/* ------------------------------------------------------------------ */

/**
 * El motivo de cada decisión de la petición, con el formato con el que se
 * escribió: es donde se lee entero —la lista, la foto del material, el enlace
 * del proveedor—, mientras que la cola y el archivo se quedan con su línea.
 */
function DecisionNotes({ request }: { request: RequestDoc }) {
  const notes: { label: string; value: string | undefined }[] = [
    { label: "Nota de la decisión", value: request.decisionNote },
    { label: "Nota de la entrega", value: request.issueNote },
    { label: "Motivo de la espera", value: request.holdNote },
    { label: "Motivo de la devolución", value: request.returnNote },
    { label: "Motivo de la cancelación", value: request.cancelNote },
  ];
  const written = notes.filter(
    (note) => note.value !== undefined && !richDocIsEmpty(note.value),
  );
  if (written.length === 0) return null;

  return (
    <>
      {written.map((note) => (
        <div
          key={note.label}
          className="rounded-xl border border-border/70 bg-muted/50 p-4"
        >
          <p className="text-xs font-medium text-muted-foreground">
            {note.label}
          </p>
          <RichText value={note.value} className="mt-1.5" />
        </div>
      ))}
    </>
  );
}

function RequestDetailSheet({
  request,
  parts,
  canManage,
  onClose,
  onAssociate,
  onApprove,
  onReject,
  onIssue,
  onHold,
  onCancel,
  onResume,
  resuming,
}: {
  request: RequestDoc;
  parts: PartDoc[];
  canManage: boolean;
  onClose: () => void;
  onAssociate: () => void;
  onApprove: () => void;
  onReject: () => void;
  onIssue: () => void;
  onHold: () => void;
  onCancel: () => void;
  onResume: () => void;
  resuming: boolean;
}) {
  const archiveRequest = useMutation(api.partRequests.archive);
  const [archiving, setArchiving] = useState(false);
  const status = STATUS_META[request.status] ?? STATUS_META.pending;
  const priority = PRIORITY_META[request.priority as Priority];
  const partById = new Map(parts.map((part) => [part._id, part]));
  const noReference = request.lines.length === 0;
  const images = request.attachments.filter((a) => a.kind === "image");
  const documents = request.attachments.filter((a) => a.kind === "document");

  /** Al archivo: sale de la cola del día a día y queda consultable allí. */
  const handleArchive = async () => {
    setArchiving(true);
    try {
      await archiveRequest({ requestId: request._id });
      toast.success(`${request.reference} enviada al archivo`);
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setArchiving(false);
    }
  };

  const details: { label: string; value: string }[] = [
    { label: "Solicitante", value: request.requesterName },
    { label: "Área o equipo de trabajo", value: request.requesterTeam ?? "—" },
    { label: "Equipo afectado", value: request.equipment ?? "—" },
    { label: "Creada", value: formatDateTime(request.createdAt) },
    {
      label: "Decisión",
      value: request.decidedAt
        ? `${request.decidedBy ?? "Responsable"} · ${formatDateTime(request.decidedAt)}`
        : "Pendiente",
    },
    {
      label: "Entrega",
      value: request.issuedAt ? formatDateTime(request.issuedAt) : "—",
    },
  ];

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold text-muted-foreground">
              {request.reference}
            </span>
            <Badge variant="outline" className={priority.badgeClassName}>
              {priority.label}
            </Badge>
            <Badge variant="outline" className={status.badgeClassName}>
              <span
                className={cn("size-1.5 rounded-full", status.dotClassName)}
              />
              {status.label}
            </Badge>
            {noReference && (
              <Badge
                variant="outline"
                className="border-amber-500/25 bg-amber-500/10 text-amber-700"
              >
                <Wrench className="size-3" />
                Sin repuesto
              </Badge>
            )}
            {request.equipmentId && (
              <Badge
                variant="outline"
                className="border-signal/25 bg-signal/10 text-signal"
              >
                Modelo en inventario
              </Badge>
            )}
          </div>
          <SheetTitle className="text-xl tracking-tight">
            {request.requesterName}
          </SheetTitle>
          <SheetDescription>{status.description}</SheetDescription>
        </SheetHeader>

        <div className="grid gap-4 px-4 pb-4 sm:px-6">
          <dl className="grid grid-cols-2 gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-sm">
            {details.map((detail) => (
              <div key={detail.label}>
                <dt className="text-xs text-muted-foreground">
                  {detail.label}
                </dt>
                <dd className="mt-0.5 text-sm font-medium">{detail.value}</dd>
              </div>
            ))}
          </dl>

          {request.description && (
            <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Qué pide
              </p>
              <RichText value={request.description} className="mt-1.5" />
            </div>
          )}

          {request.attachments.length > 0 && (
            <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Paperclip className="size-3.5" />
                Adjuntos
              </p>
              {images.length > 0 && (
                // Las fotos del expediente, como grupo: si su dirección pública
                // no llega, el porqué se lee una vez, aquí encima, y cada hueco
                // se queda con su icono en lugar de repetir el mismo párrafo
                // cinco veces.
                <AttachmentGroup>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {images.map((image) => (
                      <AttachmentImage
                        key={image.storageId}
                        url={image.url}
                        name={image.name}
                        layout="cell"
                        link
                        frameClassName="aspect-square overflow-hidden rounded-lg border border-border/70"
                        imageClassName="size-full object-cover transition-transform group-hover:scale-105"
                      />
                    ))}
                  </div>
                </AttachmentGroup>
              )}
              {documents.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {documents.map((document) => (
                    <li key={document.storageId}>
                      {document.url ? (
                        <a
                          href={document.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/50 px-3 py-2 text-sm transition-colors hover:border-signal/40"
                        >
                          <FileText className="size-4 shrink-0 text-muted-foreground" />
                          <span className="truncate">{document.name}</span>
                        </a>
                      ) : (
                        <span className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                          <FileText className="size-4 shrink-0" />
                          <span className="truncate">{document.name}</span>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Repuestos solicitados
              </p>
              {canManage && request.status === "pending" && !noReference && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={onAssociate}
                >
                  <Plus className="size-3.5" />
                  Asociar otro
                </Button>
              )}
            </div>

            {noReference ? (
              <div className="mt-3 rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 p-4 text-center">
                <p className="text-sm font-medium text-amber-800">
                  Todavía sin repuesto asociado
                </p>
                <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-amber-800/80">
                  Busca el proveedor y el part number a partir de la
                  descripción, y asocia el repuesto del catálogo o crea uno
                  nuevo.
                </p>
                {canManage && request.status === "pending" && (
                  <Button
                    type="button"
                    size="sm"
                    className="mt-3 gap-1.5"
                    onClick={onAssociate}
                  >
                    <Wrench className="size-3.5" />
                    Asociar repuesto
                  </Button>
                )}
              </div>
            ) : (
              <ul className="mt-3 divide-y divide-border/70">
                {request.lines.map((line) => {
                  const part = partById.get(line.sparePartId);
                  const hasShortage = !part || part.stock < line.quantity;
                  return (
                    <li
                      key={line.sparePartId}
                      className="flex items-center justify-between gap-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {line.name}
                        </p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {line.code}
                          {part?.partNumber ? ` · ${part.partNumber}` : ""}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold tabular-nums">
                          ×{line.quantity}
                        </p>
                        <p
                          className={cn(
                            "text-xs tabular-nums",
                            hasShortage
                              ? "text-destructive"
                              : "text-muted-foreground",
                          )}
                        >
                          {part
                            ? `stock ${part.stock} ${part.unit}`
                            : "no está en catálogo"}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {request.notes && (
            <div className="rounded-xl border border-border/70 bg-muted/50 p-4">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <User className="size-3.5" />
                Nota del solicitante
              </p>
              <RichText value={request.notes} className="mt-1.5" />
            </div>
          )}

          <DecisionNotes request={request} />
        </div>

        <SheetFooter className="border-t border-border/70 bg-background/80 px-4 py-4 sm:px-6">
          <div className="flex w-full flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cerrar
            </Button>
            {canManage && request.status === "pending" && (
              <>
                <Button type="button" variant="outline" onClick={onReject}>
                  Rechazar
                </Button>
                {noReference ? (
                  <Button type="button" className="gap-2" onClick={onAssociate}>
                    <Wrench className="size-4" />
                    Asociar repuesto
                  </Button>
                ) : (
                  <Button type="button" className="gap-2" onClick={onApprove}>
                    <Check className="size-4" />
                    Aprobar
                  </Button>
                )}
              </>
            )}
            {canManage && request.status === "approved" && (
              <Button type="button" className="gap-2" onClick={onIssue}>
                <PackageCheck className="size-4" />
                Marcar entregada
              </Button>
            )}
            {/* Espera y cancelación: la petición ya está decidida o a medias,
                así que se deciden desde la ficha, con su motivo. */}
            {canManage && HOLDABLE.includes(request.status) && (
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={onHold}
              >
                <CirclePause className="size-4" />
                En espera
              </Button>
            )}
            {canManage && request.status === "onHold" && (
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={resuming}
                onClick={onResume}
              >
                <RotateCcw className="size-4" />
                {resuming ? "Reanudando..." : "Reanudar"}
              </Button>
            )}
            {canManage && CANCELLABLE.includes(request.status) && (
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={onCancel}
              >
                <Ban className="size-4" />
                Cancelar petición
              </Button>
            )}
            {canManage && request.status !== "pending" && (
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={archiving}
                onClick={() => void handleArchive()}
              >
                <Archive className="size-4" />
                Archivar
              </Button>
            )}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Asociar repuesto (catálogo existente o investigación nueva)         */
/* ------------------------------------------------------------------ */

function AssociateDialog({
  request,
  parts,
  equipment,
  onClose,
}: {
  request: RequestDoc;
  parts: PartDoc[];
  equipment: EquipmentDoc[];
  onClose: () => void;
}) {
  const associateExisting = useMutation(api.partRequests.associateExisting);
  const associateNew = useMutation(api.partRequests.associateNew);

  const [mode, setMode] = useState<"existing" | "new">(
    parts.length > 0 ? "existing" : "new",
  );
  const [selectedId, setSelectedId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onlyCompatible, setOnlyCompatible] = useState(true);

  // Si la petición trae equipo del inventario, filtra el catálogo por modelo.
  const requestEquipment = equipment.find(
    (item) => item._id === request.equipmentId,
  );
  const compatibleParts = requestEquipment
    ? parts.filter((part) =>
        part.compatibleWith?.includes(requestEquipment._id),
      )
    : parts;
  const showOnly =
    Boolean(requestEquipment) && onlyCompatible && compatibleParts.length > 0;
  const visibleParts = showOnly ? compatibleParts : parts;

  // Datos investigados para la creación del repuesto
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>(
    PART_CATEGORIES[0] as string,
  );
  const [unit, setUnit] = useState("ud");
  const [stockText, setStockText] = useState("1");
  const [minStockText, setMinStockText] = useState("0");
  const [location, setLocation] = useState("");
  const [supplier, setSupplier] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [priceText, setPriceText] = useState("");
  const [purchaseUrl, setPurchaseUrl] = useState("");
  const [description, setDescription] = useState("");

  const parseNumber = (value: string, fallback: number) => {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const handleAssociateExisting = async () => {
    const part = parts.find((candidate) => candidate._id === selectedId);
    if (!part) {
      setError("Selecciona el repuesto del catálogo.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const message = await associateExisting({
        requestId: request._id,
        sparePartId: part._id,
        quantity: Math.max(1, Math.floor(parseNumber(quantity, 1))),
      });
      toast.success(message);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleAssociateNew = async () => {
    setError(null);
    if (!code.trim() || !name.trim()) {
      setError("El código y el nombre son obligatorios.");
      return;
    }
    const stock = parseNumber(stockText, -1);
    const minStock = parseNumber(minStockText, -1);
    const price = priceText.trim() ? parseNumber(priceText, -1) : 0;
    if (stock < 0 || minStock < 0 || price < 0) {
      setError("Stock, mínimo y precio deben ser números positivos.");
      return;
    }
    // La ficha del repuesto que nace aquí se describe con el editor: se manda
    // el documento y, si no dice nada, no se guarda descripción.
    const descriptionToSend = richDocToStore(description);
    setBusy(true);
    try {
      const message = await associateNew({
        requestId: request._id,
        quantity: Math.max(1, Math.floor(parseNumber(quantity, 1))),
        part: {
          code: code.trim(),
          name: name.trim(),
          ...(descriptionToSend ? { description: descriptionToSend } : {}),
          category,
          unit: unit.trim() || "ud",
          stock,
          minStock,
          location: location.trim(),
          supplier: supplier.trim(),
          partNumber: partNumber.trim(),
          unitPrice: price,
          purchaseUrl: purchaseUrl.trim(),
        },
      });
      toast.success(message);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Asociar repuesto a {request.reference}</DialogTitle>
          <DialogDescription>
            Elige un repuesto del catálogo o registra el que has investigado
            (proveedor, nº de parte, precio).
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <Label>Origen del repuesto</Label>
          <div className="inline-flex w-fit rounded-lg border border-border/70 bg-card p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setMode("existing")}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                mode === "existing"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Catálogo existente
            </button>
            <button
              type="button"
              onClick={() => setMode("new")}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                mode === "new"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Investigación nueva
            </button>
          </div>
        </div>

        {mode === "existing" ? (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="associate-part">Repuesto del catálogo</Label>
              {requestEquipment && (
                <div className="flex flex-wrap items-center gap-2">
                  {compatibleParts.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setOnlyCompatible((value) => !value)}
                      disabled={busy}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                        showOnly
                          ? "border-signal bg-signal/10 text-signal"
                          : "border-border/70 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {showOnly
                        ? `Solo compatibles con ${requestEquipment.model} (${compatibleParts.length})`
                        : `Ver todo el catálogo (${parts.length})`}
                    </button>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Sin repuestos marcados como compatibles con{" "}
                      {requestEquipment.model}: se muestra todo el catálogo.
                    </span>
                  )}
                </div>
              )}
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger
                  id="associate-part"
                  className="w-full"
                  disabled={busy}
                >
                  <SelectValue placeholder="Buscar por código o nombre" />
                </SelectTrigger>
                <SelectContent>
                  {visibleParts.map((part) => (
                    <SelectItem key={part._id} value={part._id}>
                      {part.code} — {part.name} (stock {part.stock})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid w-32 gap-2">
              <Label htmlFor="associate-qty">Cantidad</Label>
              <Input
                id="associate-qty"
                type="number"
                min={1}
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                className="tabular-nums"
                disabled={busy}
              />
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="new-code">Código interno *</Label>
                <Input
                  id="new-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="MON-10012"
                  className="font-mono"
                  disabled={busy}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-name">Nombre *</Label>
                <Input
                  id="new-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Monitor de realización 10 pulgadas"
                  disabled={busy}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-supplier">Proveedor</Label>
                <Input
                  id="new-supplier"
                  value={supplier}
                  onChange={(event) => setSupplier(event.target.value)}
                  placeholder="SmallHD"
                  disabled={busy}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-part-number">Nº de parte</Label>
                <Input
                  id="new-part-number"
                  value={partNumber}
                  onChange={(event) => setPartNumber(event.target.value)}
                  placeholder="OD-10-SDI"
                  className="font-mono"
                  disabled={busy}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-url">URL de la ficha</Label>
                <Input
                  id="new-url"
                  value={purchaseUrl}
                  onChange={(event) => setPurchaseUrl(event.target.value)}
                  placeholder="https://..."
                  disabled={busy}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-price">Precio unitario (€)</Label>
                <Input
                  id="new-price"
                  inputMode="decimal"
                  value={priceText}
                  onChange={(event) => setPriceText(event.target.value)}
                  placeholder="29,90"
                  className="tabular-nums"
                  disabled={busy}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-category">Categoría</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger
                    id="new-category"
                    className="w-full"
                    disabled={busy}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PART_CATEGORIES.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-unit">Unidad</Label>
                <Input
                  id="new-unit"
                  value={unit}
                  onChange={(event) => setUnit(event.target.value)}
                  placeholder="ud"
                  disabled={busy}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-stock">Stock inicial</Label>
                <Input
                  id="new-stock"
                  type="number"
                  min={0}
                  value={stockText}
                  onChange={(event) => setStockText(event.target.value)}
                  className="tabular-nums"
                  disabled={busy}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-min">Stock mínimo</Label>
                <Input
                  id="new-min"
                  type="number"
                  min={0}
                  value={minStockText}
                  onChange={(event) => setMinStockText(event.target.value)}
                  className="tabular-nums"
                  disabled={busy}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-location">Ubicación</Label>
                <Input
                  id="new-location"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder="D-09"
                  className="font-mono"
                  disabled={busy}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-qty">Cantidad a asociar</Label>
                <Input
                  id="new-qty"
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  className="tabular-nums"
                  disabled={busy}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-description">Descripción</Label>
              <RichTextEditor
                id="new-description"
                value={description}
                onChange={setDescription}
                placeholder="Especificaciones, nº de parte, compatibilidad..."
                disabled={busy}
              />
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="gap-2"
            onClick={
              mode === "existing" ? handleAssociateExisting : handleAssociateNew
            }
            disabled={busy}
          >
            {busy
              ? "Asociando..."
              : mode === "existing"
                ? "Asociar al catálogo"
                : "Crear y asociar"}
            {!busy && <Check className="size-4" />}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Nueva petición (la registra un técnico)                             */
/* ------------------------------------------------------------------ */

type PendingFile = {
  id: string;
  file: File;
  previewUrl?: string;
  storageId?: Id<"_storage">;
  uploading: boolean;
  error?: string;
};

function NewRequestDialog({
  parts,
  equipment,
  onClose,
}: {
  parts: PartDoc[];
  equipment: EquipmentDoc[];
  onClose: () => void;
}) {
  const create = useMutation(api.partRequests.create);
  const generateUploadUrl = useMutation(api.partRequests.generateUploadUrl);

  const [requesterName, setRequesterName] = useState("");
  const [requesterTeam, setRequesterTeam] = useState("");
  const [equipmentChoice, setEquipmentChoice] = useState("");
  const [equipmentManual, setEquipmentManual] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<
    { sparePartId: Id<"spareParts">; quantity: number }[]
  >([]);
  const [selectedId, setSelectedId] = useState("");
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [onlyCompatible, setOnlyCompatible] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const partById = new Map(parts.map((part) => [part._id, part]));
  const uploading = files.some((file) => file.uploading);

  // Equipo elegido: permite filtrar las referencias por modelo compatible.
  const selectedEquipment = equipment.find(
    (item) => item._id === equipmentChoice,
  );
  const compatibleParts = selectedEquipment
    ? parts.filter((part) =>
        part.compatibleWith?.includes(selectedEquipment._id),
      )
    : parts;
  const showOnly =
    Boolean(selectedEquipment) && onlyCompatible && compatibleParts.length > 0;
  const visibleParts = showOnly ? compatibleParts : parts;

  const reset = () => {
    setRequesterName("");
    setRequesterTeam("");
    setEquipmentChoice("");
    setEquipmentManual("");
    setOnlyCompatible(true);
    setPriority("normal");
    setDescription("");
    setNotes("");
    setLines([]);
    setSelectedId("");
    setFiles((current) => {
      current.forEach((file) => {
        if (file.previewUrl) URL.revokeObjectURL(file.previewUrl);
      });
      return [];
    });
    setError(null);
  };

  const addLine = () => {
    if (!selectedId) return;
    const part = parts.find((candidate) => candidate._id === selectedId);
    if (!part) return;
    if (lines.some((line) => line.sparePartId === part._id)) {
      toast.info("Ese repuesto ya está en la petición");
      return;
    }
    setLines([...lines, { sparePartId: part._id, quantity: 1 }]);
    setSelectedId("");
  };

  const updateQuantity = (sparePartId: string, quantity: number) => {
    setLines((current) =>
      current.map((line) =>
        line.sparePartId === sparePartId
          ? { ...line, quantity: Math.max(1, Math.floor(quantity || 1)) }
          : line,
      ),
    );
  };

  const uploadFile = async (entry: PendingFile) => {
    try {
      const uploadUrl = await generateUploadUrl();
      const storageId = await uploadToStorage(uploadUrl, entry.file);
      setFiles((current) =>
        current.map((item) =>
          item.id === entry.id
            ? { ...item, storageId, uploading: false }
            : item,
        ),
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "No se pudo subir el archivo.";
      setFiles((current) =>
        current.map((item) =>
          item.id === entry.id
            ? { ...item, uploading: false, error: message }
            : item,
        ),
      );
    }
  };

  const handleFilesChosen = async (chosen: FileList | null) => {
    if (!chosen) return;
    const accepted: PendingFile[] = [];
    for (const picked of Array.from(chosen)) {
      // Cada foto se recomprime antes de mirar el tope: la de un móvil se queda
      // en unos cientos de kB, así que cabe sin acercarse al límite.
      const file = await compressForUpload(picked);
      if (exceedsFileLimit(file)) {
        toast.error(`${picked.name}: supera los ${MAX_FILE_SIZE_LABEL}`);
        continue;
      }
      const entry: PendingFile = {
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}`,
        file,
        previewUrl: file.type.startsWith("image/")
          ? URL.createObjectURL(file)
          : undefined,
        uploading: true,
      };
      accepted.push(entry);
    }
    if (accepted.length === 0) return;
    setFiles((current) => [...current, ...accepted]);
    accepted.forEach((entry) => void uploadFile(entry));
  };

  const removeFile = (id: string) => {
    setFiles((current) => {
      const target = current.find((file) => file.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return current.filter((file) => file.id !== id);
    });
  };

  const handleSubmit = async () => {
    setError(null);
    if (!requesterName.trim()) {
      setError("Indica quién solicita el repuesto.");
      return;
    }
    const hasAttachments = files.some((file) => file.storageId);
    if (lines.length === 0 && richDocIsEmpty(description) && !hasAttachments) {
      setError(
        "Añade un repuesto del catálogo o describe lo que necesitas (con fotos o documentos si los tienes).",
      );
      return;
    }
    if (uploading) {
      setError("Espera a que se suban los archivos adjuntos.");
      return;
    }
    const failed = files.find((file) => file.error);
    if (failed) {
      setError(
        `No se ha podido subir «${failed.file.name}». Quítalo o inténtalo de nuevo.`,
      );
      return;
    }
    const equipmentText = selectedEquipment
      ? equipmentLabel(selectedEquipment)
      : equipmentChoice === "manual"
        ? equipmentManual.trim()
        : "";
    if (equipmentChoice === "manual" && !equipmentText) {
      setError("Escribe el equipo afectado o elige uno del inventario.");
      return;
    }

    setBusy(true);
    try {
      // El editor ya entrega el documento en bloques; esto solo decide qué se
      // guarda, y evita dejar un párrafo vacío por una descripción escrita y
      // luego borrada.
      const descriptionToSend = richDocToStore(description);
      const notesToSend = richDocToStore(notes);
      const attachments = files
        .filter((file): file is PendingFile & { storageId: Id<"_storage"> } =>
          Boolean(file.storageId),
        )
        .map((file) => ({
          storageId: file.storageId,
          name: file.file.name,
          kind: file.file.type.startsWith("image/")
            ? ("image" as const)
            : ("document" as const),
        }));

      const reference = await create({
        requesterName: requesterName.trim(),
        ...(requesterTeam.trim()
          ? { requesterTeam: requesterTeam.trim() }
          : {}),
        ...(equipmentText ? { equipment: equipmentText } : {}),
        ...(selectedEquipment ? { equipmentId: selectedEquipment._id } : {}),
        priority,
        ...(descriptionToSend ? { description: descriptionToSend } : {}),
        ...(attachments.length > 0 ? { attachments } : {}),
        ...(notesToSend ? { notes: notesToSend } : {}),
        lines,
      });
      toast.success(`Petición ${reference} creada`);
      reset();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Nueva petición de repuestos</DialogTitle>
          <DialogDescription>
            Si tienes el repuesto, añádelo del catálogo. Si no, describe lo que
            necesitas y el responsable buscará proveedor y nº de parte.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="requester">Solicitante *</Label>
            <Input
              id="requester"
              value={requesterName}
              onChange={(event) => setRequesterName(event.target.value)}
              placeholder="Nombre y apellido"
              disabled={busy}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="team">Área o turno</Label>
            <Input
              id="team"
              value={requesterTeam}
              onChange={(event) => setRequesterTeam(event.target.value)}
              placeholder="p. ej. Cámara"
              disabled={busy}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="priority">Prioridad</Label>
            <Select
              value={priority}
              onValueChange={(value) => setPriority(value as Priority)}
            >
              <SelectTrigger id="priority" className="w-full" disabled={busy}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="urgent">Urgente</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="low">Baja</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="equipment-choice">Equipo afectado</Label>
            <Select value={equipmentChoice} onValueChange={setEquipmentChoice}>
              <SelectTrigger
                id="equipment-choice"
                className="w-full"
                disabled={busy}
              >
                <SelectValue placeholder="Elegir equipo del inventario" />
              </SelectTrigger>
              <SelectContent>
                {equipment.map((item) => (
                  <SelectItem key={item._id} value={item._id}>
                    {equipmentLabel(item)}
                    {item.brand ? ` · ${item.brand}` : ""}
                  </SelectItem>
                ))}
                <SelectItem value="manual">
                  Otro — escribir el equipo a mano
                </SelectItem>
              </SelectContent>
            </Select>
            {equipmentChoice === "manual" && (
              <Input
                value={equipmentManual}
                onChange={(event) => setEquipmentManual(event.target.value)}
                placeholder="p. ej. Router de vídeo 7800FR"
                disabled={busy}
                aria-label="Equipo afectado (a mano)"
              />
            )}
            {selectedEquipment && (
              <p className="text-xs text-muted-foreground">
                En inventario
                {selectedEquipment.location
                  ? ` · ${selectedEquipment.location}`
                  : ""}
              </p>
            )}
            {equipment.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No hay equipos en el inventario todavía: escríbelo a mano.
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="description">Descripción de lo que se pide</Label>
          <RichTextEditor
            id="description"
            value={description}
            onChange={setDescription}
            placeholder="Qué necesitas, para qué, cantidades, plazos... (obligatorio si no añades repuestos)"
            disabled={busy}
          />
        </div>

        <div className="grid gap-2">
          <Label>Fotos y documentos</Label>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={FILE_ACCEPT}
            className="hidden"
            onChange={(event) => {
              void handleFilesChosen(event.target.files);
              event.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
          >
            <Upload className="size-4" />
            Añadir fotos o documentos
          </Button>

          {files.length > 0 && (
            <ul className="space-y-1.5">
              {files.map((file) => (
                <li
                  key={file.id}
                  className="flex items-center gap-3 rounded-lg border border-border/70 bg-card px-3 py-2"
                >
                  {file.previewUrl ? (
                    <img
                      src={file.previewUrl}
                      alt=""
                      className="size-9 shrink-0 rounded-md border border-border/70 object-cover"
                    />
                  ) : (
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <FileText className="size-4" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">
                      {file.file.name}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {file.error ? (
                        <span className="text-destructive">{file.error}</span>
                      ) : file.uploading ? (
                        "Subiendo..."
                      ) : (
                        `${Math.max(1, Math.round(file.file.size / 1024))} KB · listo`
                      )}
                    </span>
                  </span>
                  {file.uploading && (
                    <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeFile(file.id)}
                    disabled={busy || file.uploading}
                    aria-label={`Quitar ${file.file.name}`}
                  >
                    <X className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">
            Imágenes, PDF o documentos de oficina. Máximo {MAX_FILE_SIZE_LABEL}{" "}
            por archivo.
          </p>
        </div>

        <div className="grid gap-2">
          <Label>Referencias del catálogo (opcional)</Label>
          {selectedEquipment && (
            <div className="flex flex-wrap items-center gap-2">
              {compatibleParts.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setOnlyCompatible((value) => !value)}
                  disabled={busy}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    showOnly
                      ? "border-signal bg-signal/10 text-signal"
                      : "border-border/70 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {showOnly
                    ? `Solo compatibles con ${selectedEquipment.model} (${compatibleParts.length})`
                    : `Ver todo el catálogo (${parts.length})`}
                </button>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Sin repuestos marcados como compatibles con{" "}
                  {selectedEquipment.model}: se muestra todo el catálogo.
                </span>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="w-full" disabled={busy}>
                <SelectValue placeholder="Buscar repuesto en el catálogo" />
              </SelectTrigger>
              <SelectContent>
                {visibleParts.map((part) => (
                  <SelectItem key={part._id} value={part._id}>
                    {part.code} — {part.name} (stock {part.stock})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              className="shrink-0 gap-1.5"
              onClick={addLine}
              disabled={busy || !selectedId}
            >
              <Plus className="size-4" />
              Añadir
            </Button>
          </div>

          {lines.length > 0 && (
            <ul className="divide-y divide-border/70 rounded-lg border border-border/70 bg-card">
              {lines.map((line) => {
                const part = partById.get(line.sparePartId);
                return (
                  <li
                    key={line.sparePartId}
                    className="flex items-center justify-between gap-3 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {part?.name ?? "Repuesto"}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {part?.code}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(event) =>
                          updateQuantity(
                            line.sparePartId,
                            Number(event.target.value),
                          )
                        }
                        className="h-8 w-16 text-right tabular-nums"
                        disabled={busy}
                        aria-label={`Cantidad de ${part?.code ?? "repuesto"}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        onClick={() =>
                          setLines((current) =>
                            current.filter(
                              (item) => item.sparePartId !== line.sparePartId,
                            ),
                          )
                        }
                        disabled={busy}
                        aria-label="Quitar repuesto"
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="notes">Contexto o diagnóstico (opcional)</Label>
          <RichTextEditor
            id="notes"
            value={notes}
            onChange={setNotes}
            placeholder="Síntoma, diagnóstico o cualquier contexto útil"
            disabled={busy}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="gap-2"
            onClick={handleSubmit}
            disabled={busy || uploading}
          >
            {busy
              ? "Enviando..."
              : uploading
                ? "Subiendo archivos..."
                : "Crear petición"}
            {!busy && !uploading && <ArrowRight className="size-4" />}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
