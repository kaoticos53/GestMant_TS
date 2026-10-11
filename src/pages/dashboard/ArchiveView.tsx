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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ListArea } from "@/components/ListArea";
import { TablePagination } from "@/components/TablePagination";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { AFTER_MONTHS_OPTIONS, archivableBefore } from "@/lib/archive";
import { groupByDate, matchesQuery, monthsAgo, sortByDate } from "@/lib/browse";
import { richDocToPlainText } from "@/lib/richDoc";
import { cn } from "@/lib/utils";
import {
  INCIDENT_STATUS_META,
  STATUS_META,
  formatDate,
  formatDateTime,
  getErrorMessage,
} from "@/lib/workshop";
import { useRowsThatFit } from "@/hooks/use-rows-that-fit";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { useMutation } from "convex/react";
import {
  Archive,
  ArchiveRestore,
  CalendarClock,
  ClipboardList,
  SearchX,
  SlidersHorizontal,
  Siren,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  QueueToolbar,
  type QueueSortId,
  type QueueSortOption,
} from "./QueueToolbar";

type IncidentDoc = Doc<"incidents">;
type RequestDoc = Doc<"partRequests">;

/** Qué se está mirando dentro del archivo. */
type ArchiveKind = "all" | "incident" | "request";

/** Órdenes del archivo: la fecha de archivo es lo que lo ordena todo. */
const SORT_OPTIONS: QueueSortOption[] = [
  { id: "recent", label: "Archivo: lo último archivado primero" },
  { id: "oldest", label: "Archivo: lo más antiguo primero" },
];

/** Antigüedades del selector de la limpieza a mano. */
const CUTOFF_OPTIONS = AFTER_MONTHS_OPTIONS.map((option) => ({
  id: String(option.months),
  label: option.label,
}));

/**
 * Una fila del archivo: lo que se enseña y lo que se busca. Incidencias y
 * peticiones se unifican aquí para poder buscarlas de una vez («PET-0012» o
 * «cámara plató 2» da igual el módulo del que vengan).
 */
interface ArchiveEntryBase {
  reference: string;
  title: string;
  subtitle: string;
  statusLabel: string;
  statusClassName: string;
  /** Cuándo se archivó (es lo que ordena y agrupa). */
  date: number;
  archivedBy?: string;
  fields: (string | number | undefined)[];
}

type ArchiveEntry =
  | (ArchiveEntryBase & { kind: "incident"; id: Id<"incidents"> })
  | (ArchiveEntryBase & { kind: "request"; id: Id<"partRequests"> });

function incidentEntry(incident: IncidentDoc): ArchiveEntry {
  const meta = INCIDENT_STATUS_META[incident.status];
  return {
    id: incident._id,
    kind: "incident",
    reference: incident.reference,
    title: `${incident.equipmentKind} · ${incident.model}`,
    // Lo descrito se enseña aquí como una línea del listado, no como un bloque
    // con formato: se queda su texto (el formato se lee entero en la ficha).
    subtitle: richDocToPlainText(incident.description),
    statusLabel: meta.label,
    statusClassName: meta.badgeClassName,
    date: incident.archivedAt ?? incident.closedAt ?? incident.reportedAt,
    archivedBy: incident.archivedBy,
    fields: [
      incident.reference,
      incident.equipmentKind,
      incident.model,
      incident.serialNumber,
      // El buscador del archivo compara texto: una descripción con formato se
      // busca por lo que dice, no por el marcado de su documento.
      richDocToPlainText(incident.description),
      incident.location,
      incident.reporterName,
      incident.assigneeName,
      incident.workshopAssigneeName,
      richDocToPlainText(incident.notes),
      incident.archivedBy,
    ],
  };
}

function requestEntry(request: RequestDoc): ArchiveEntry {
  const meta = STATUS_META[request.status];
  const lines = request.lines
    .map((line) => `${line.code} ${line.name}`)
    .join(" · ");
  const statusContext =
    request.status === "issued"
      ? `Entregada · ${request.issuedAt ? formatDateTime(request.issuedAt) : ""}`
      : request.status === "onHold"
        ? `En espera${request.holdSinceAt ? ` · desde ${formatDateTime(request.holdSinceAt)}` : ""}`
        : request.status === "returned"
          ? `Devuelta${request.returnedAt ? ` · ${formatDateTime(request.returnedAt)}` : ""}`
          : request.status === "cancelled"
            ? `Cancelada${request.cancelledAt ? ` · ${formatDateTime(request.cancelledAt)}` : ""}`
            : request.status === "pendingSupplierQuote"
              ? `Presupuesto pendiente${request.quoteRequestedAt ? ` · ${formatDateTime(request.quoteRequestedAt)}` : ""}`
              : request.decidedAt
                ? `${meta.label}${` · ${request.decidedAt ? formatDateTime(request.decidedAt) : ""}`}`
                : meta.label;
  return {
    id: request._id,
    kind: "request",
    reference: request.reference,
    title:
      lines ||
      richDocToPlainText(request.description) ||
      "Petición sin repuesto",
    subtitle: [request.requesterName, request.requesterTeam, request.equipment]
      .filter(Boolean)
      .join(" · "),
    statusLabel: statusContext,
    statusClassName: meta.badgeClassName ?? STATUS_META.pending.badgeClassName,
    date:
      request.archivedAt ??
      request.issuedAt ??
      request.decidedAt ??
      request.quoteRequestedAt ??
      request.returnedAt ??
      request.holdSinceAt ??
      request.createdAt,
    archivedBy: request.archivedBy,
    fields: [
      request.reference,
      request.requesterName,
      request.requesterTeam,
      request.equipment,
      richDocToPlainText(request.description),
      // Los motivos de cada decisión: el archivo busca por su texto, que es lo
      // que se lee de un vistazo en una fila.
      richDocToPlainText(request.decisionNote),
      richDocToPlainText(request.issueNote),
      richDocToPlainText(request.returnNote),
      richDocToPlainText(request.cancelNote),
      richDocToPlainText(request.holdNote),
      request.decidedBy,
      request.archivedBy,
      lines,
    ],
  };
}

const KIND_META: Record<
  "incident" | "request",
  { label: string; icon: typeof Siren }
> = {
  incident: { label: "Incidencia", icon: Siren },
  request: { label: "Petición", icon: ClipboardList },
};

/**
 * Archivo del taller: lo que ya está cerrado y decidido sale del día a día y
 * vive aquí. Se busca y se ordena igual que las colas (misma barra), se agrupa
 * por fecha de archivo y desde aquí se recupera lo que haga falta. También es
 * donde se hace la limpieza a mano: mandar de golpe al archivo todo lo
 * terminado antes de una fecha.
 *
 * El archivado automático de cada noche no se ajusta aquí, sino en «Ajustes del
 * taller» (junto al aviso de trabajo sin constancia): los ajustes de fondo del
 * taller viven juntos y este módulo se queda con el día a día.
 */
export function ArchiveView({
  incidents = [],
  requests = [],
  activeIncidents = [],
  activeRequests = [],
  canArchiveIncidents = false,
  canArchiveRequests = false,
  onOpenSettings,
}: {
  /** Incidencias ya archivadas. */
  incidents?: IncidentDoc[];
  /** Peticiones ya archivadas. */
  requests?: RequestDoc[];
  /** Cola viva de incidencias (para saber cuántas se archivarían). */
  activeIncidents?: IncidentDoc[];
  /** Cola viva de peticiones (para saber cuántas se archivarían). */
  activeRequests?: RequestDoc[];
  canArchiveIncidents?: boolean;
  canArchiveRequests?: boolean;
  /** Abre «Ajustes del taller», donde se configura el archivado automático. */
  onOpenSettings?: () => void;
}) {
  const unarchiveIncident = useMutation(api.incidents.unarchive);
  const unarchiveRequest = useMutation(api.partRequests.unarchive);
  const archiveIncidents = useMutation(api.incidents.archiveClosedBefore);
  const archiveRequests = useMutation(api.partRequests.archiveDecidedBefore);

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<QueueSortId>("recent");
  const [kind, setKind] = useState<ArchiveKind>("all");
  const [compact, setCompact] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cutoffMonths, setCutoffMonths] = useState("12");
  const [bulkTarget, setBulkTarget] = useState<"incidents" | "requests" | null>(
    null,
  );
  const [bulkBusy, setBulkBusy] = useState(false);

  const entries = [
    ...incidents.map(incidentEntry),
    ...requests.map(requestEntry),
  ];
  const matched = entries.filter((entry) => matchesQuery(entry.fields, search));
  const counts: Record<ArchiveKind, number> = {
    all: matched.length,
    incident: matched.filter((entry) => entry.kind === "incident").length,
    request: matched.filter((entry) => entry.kind === "request").length,
  };
  const filtered =
    kind === "all" ? matched : matched.filter((entry) => entry.kind === kind);
  const ordered = sortByDate(
    filtered,
    (entry) => entry.date,
    sort === "oldest" ? "oldest" : "recent",
  );
  // La misma medida que en las tablas: cuántas fichas caben en el alto del área
  // —contadas por el navegador— y el archivo partido en páginas con esas fichas.
  // La vista compacta encoge cada ficha, así que vuelve a medir a propósito.
  const { areaRef, rowsFit } = useRowsThatFit({
    shape: "cards",
    remeasureKey: compact,
  });
  const paging = useTablePagination({
    total: ordered.length,
    rowsFit,
    // Cambiar lo que se mira devuelve a la primera página.
    resetKey: `${search}|${sort}|${kind}`,
  });
  const visible = ordered.slice(paging.from - 1, paging.to);
  const sections = groupByDate(visible, (entry) => entry.date);

  // Corte del archivado masivo y qué entraría con él (se calcula sobre la cola
  // viva que ya está cargada, sin preguntar al backend). La cuenta sale de la
  // regla compartida con el backend (`lib/archive`), que es la que aplica de
  // verdad tanto la limpieza a mano como la pasada automática de la noche.
  const cutoff = monthsAgo(Number(cutoffMonths));
  const pending = archivableBefore({
    incidents: activeIncidents,
    requests: activeRequests,
    before: cutoff,
  });
  const canArchiveSomething =
    (canArchiveIncidents && pending.incidents > 0) ||
    (canArchiveRequests && pending.requests > 0);

  const handleRestore = async (entry: ArchiveEntry) => {
    setBusyId(entry.id);
    try {
      if (entry.kind === "incident") {
        await unarchiveIncident({ incidentId: entry.id });
      } else {
        await unarchiveRequest({ requestId: entry.id });
      }
      toast.success(
        `${entry.reference} vuelve a la cola de ${entry.kind === "incident" ? "incidencias" : "peticiones"}`,
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  const handleBulkArchive = async () => {
    if (!bulkTarget) return;
    setBulkBusy(true);
    try {
      if (bulkTarget === "incidents") {
        const archived = await archiveIncidents({ before: cutoff });
        toast.success(
          archived === 0
            ? "No había incidencias cerradas anteriores a esa fecha"
            : `${archived} ${archived === 1 ? "incidencia archivada" : "incidencias archivadas"}`,
        );
      } else {
        const archived = await archiveRequests({ before: cutoff });
        toast.success(
          archived === 0
            ? "No había peticiones decididas anteriores a esa fecha"
            : `${archived} ${archived === 1 ? "petición archivada" : "peticiones archivadas"}`,
        );
      }
      setBulkTarget(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBulkBusy(false);
    }
  };

  const kindFilters: { id: ArchiveKind; label: string }[] = [
    { id: "all", label: "Todo" },
    { id: "incident", label: "Incidencias" },
    { id: "request", label: "Peticiones" },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Opción manual: la limpieza de fondo, cuando la persona quiere. El
          automático de cada noche se ajusta en «Ajustes del taller». */}
      {(canArchiveIncidents || canArchiveRequests) && (
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <CalendarClock className="size-4" />
              </span>
              <div>
                <p className="text-sm font-semibold tracking-tight">
                  Archivar lo antiguo a mano
                </p>
                <p className="mt-0.5 max-w-xl text-xs leading-5 text-muted-foreground">
                  Elige una antigüedad y mándalo al archivo ahora mismo; no
                  cambia el automático. Solo entra lo terminado, y una ficha
                  concreta se archiva desde su propio detalle.
                </p>
              </div>
            </div>
            <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto">
              <div className="grid gap-1.5">
                <Label
                  htmlFor="archivo-antiguedad"
                  className="text-xs text-muted-foreground"
                >
                  Antigüedad
                </Label>
                <Select
                  value={cutoffMonths}
                  onValueChange={(value) => setCutoffMonths(value)}
                >
                  <SelectTrigger id="archivo-antiguedad" className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CUTOFF_OPTIONS.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Corte: anterior al <strong>{formatDate(cutoff)}</strong>
            {canArchiveSomething
              ? ` · ${pending.incidents} ${pending.incidents === 1 ? "incidencia cerrada" : "incidencias cerradas"} y ${pending.requests} ${pending.requests === 1 ? "petición decidida" : "peticiones decididas"} pendientes de archivar`
              : " · no hay nada que archivar con este corte"}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {canArchiveIncidents && (
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={pending.incidents === 0}
                onClick={() => setBulkTarget("incidents")}
              >
                <Archive className="size-4" />
                Archivar {pending.incidents}{" "}
                {pending.incidents === 1 ? "incidencia" : "incidencias"}
              </Button>
            )}
            {canArchiveRequests && (
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={pending.requests === 0}
                onClick={() => setBulkTarget("requests")}
              >
                <Archive className="size-4" />
                Archivar {pending.requests}{" "}
                {pending.requests === 1 ? "petición" : "peticiones"}
              </Button>
            )}
            {onOpenSettings && (
              <Button
                type="button"
                variant="ghost"
                className="gap-2 text-muted-foreground"
                onClick={onOpenSettings}
                title="El archivado automático de cada noche se ajusta en Ajustes del taller"
              >
                <SlidersHorizontal className="size-4" />
                Ajustes del taller
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="inline-flex flex-wrap rounded-lg border border-border/70 bg-card p-1 shadow-sm">
        {kindFilters.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setKind(option.id)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              kind === option.id
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

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center shadow-sm">
          <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-signal/10 text-signal">
            {search !== "" ? (
              <SearchX className="size-5" />
            ) : (
              <Archive className="size-5" />
            )}
          </span>
          <p className="mt-4 text-base font-semibold tracking-tight">
            {search !== ""
              ? `Nada en el archivo coincide con «${search}»`
              : entries.length === 0
                ? "El archivo está vacío"
                : "No hay fichas de ese tipo en el archivo"}
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
            {search !== ""
              ? "Prueba con otra referencia, otro equipo o el nombre de quien la notificó, o limpia la búsqueda."
              : entries.length === 0
                ? "Aquí van las incidencias cerradas y las peticiones ya decididas cuando dejan de ser del día a día. Se archivan desde arriba o desde la ficha de cada una."
                : "Cambia el filtro para ver el resto del archivo."}
          </p>
          {search !== "" && (
            <Button
              type="button"
              variant="outline"
              className="mt-5"
              onClick={() => setSearch("")}
            >
              Limpiar la búsqueda
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* El alto de las fichas queda acotado a la pantalla, así que se
              recorren con la barra del propio listado y el rótulo del mes se
              queda pegado arriba. El pie con la paginación va fuera: sigue a la
              vista sin tener que bajar hasta el final. */}
          <ListArea
            ref={areaRef}
            resetKey={`${search}|${sort}|${kind}|${paging.page}`}
          >
            <div className="flex flex-col gap-5">
              {sections.map((section) => (
                <section key={section.key} className="flex flex-col gap-3">
                  <h2
                    data-row-header
                    className="flex items-center justify-between gap-2 rounded-md bg-background/85 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur-sm lg:sticky lg:top-0 lg:z-10"
                  >
                    {section.label}
                    <span className="tabular-nums opacity-70">
                      {section.items.length}
                    </span>
                  </h2>
                  <div className={compact ? "grid gap-2" : "grid gap-3"}>
                    {section.items.map((entry) => {
                      const kindMeta = KIND_META[entry.kind];
                      const canRestore =
                        entry.kind === "incident"
                          ? canArchiveIncidents
                          : canArchiveRequests;
                      return (
                        <article
                          key={`${entry.kind}-${entry.id}`}
                          data-row
                          className={cn(
                            "flex flex-wrap items-start gap-3 rounded-xl border border-border/70 bg-card shadow-sm transition-colors hover:border-signal/30",
                            compact ? "p-3" : "p-4",
                          )}
                        >
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                            <kindMeta.icon className="size-4" />
                          </span>

                          <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs font-semibold text-muted-foreground">
                                {entry.reference}
                              </span>
                              <Badge
                                variant="outline"
                                className={entry.statusClassName}
                              >
                                {entry.statusLabel}
                              </Badge>
                              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                {kindMeta.label}
                              </span>
                            </div>
                            <p className="text-sm font-medium leading-5">
                              {entry.title}
                            </p>
                            {!compact && entry.subtitle !== "" && (
                              <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                                {entry.subtitle}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              Archivada el {formatDateTime(entry.date)}
                              {entry.archivedBy
                                ? ` por ${entry.archivedBy}`
                                : ""}
                            </p>
                          </div>

                          {canRestore && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-2"
                              disabled={busyId === entry.id}
                              onClick={() => void handleRestore(entry)}
                            >
                              <ArchiveRestore className="size-4" />
                              Recuperar
                            </Button>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </ListArea>

          <TablePagination
            paging={paging}
            singular="ficha archivada"
            plural="fichas archivadas"
            className="rounded-xl border border-border/70 bg-card shadow-sm"
          />
        </div>
      )}

      {bulkTarget && (
        <Dialog open onOpenChange={(open) => !open && setBulkTarget(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Archivar lo antiguo</DialogTitle>
              <DialogDescription>
                {bulkTarget === "incidents"
                  ? `Se archivarán ${pending.incidents} ${pending.incidents === 1 ? "incidencia cerrada" : "incidencias cerradas"} anteriores al ${formatDate(cutoff)}.`
                  : `Se archivarán ${pending.requests} ${pending.requests === 1 ? "petición decidida" : "peticiones decididas"} anteriores al ${formatDate(cutoff)}.`}{" "}
                No se borra nada: seguirán consultables aquí y podrás
                recuperarlas.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setBulkTarget(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="gap-2"
                disabled={bulkBusy}
                onClick={() => void handleBulkArchive()}
              >
                <Archive className="size-4" />
                {bulkBusy ? "Archivando..." : "Archivar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
