import { useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Archive, FileDown, MapPin, SearchX, Siren, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListArea } from "@/components/ListArea";
import { TablePagination } from "@/components/TablePagination";
import { RichText } from "@/components/RichText";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { isClosedIncident, isIncidentInWorkshop } from "@/lib/incidentFlow";
import { cn } from "@/lib/utils";
import {
  INCIDENT_FILTERS,
  INCIDENT_STATUS_META,
  formatDateTime,
  getErrorMessage,
  incidentStatusLabel,
  type IncidentStatus,
} from "@/lib/workshop";

import { IncidentReportsDialog } from "./IncidentReportsDialog";
import { QueueToolbar } from "./QueueToolbar";
import { SORT_OPTIONS, type IncidentDoc } from "./incidents/types";
import { useIncidentFilters } from "./incidents/hooks/useIncidentFilters";
import { IncidentDetailSheet } from "./incidents/components/IncidentDetailSheet";

export function IncidentsView({
  currentUserId,
  currentUserName = "Técnico",
  canAssign = false,
  initialDetailId = null,
  canOpenRequests = false,
  onOpenRequest,
}: {
  /** Identidad actual (para autoasignación y permisos de atención). */
  currentUserId?: Id<"users"> | null;
  currentUserName?: string;
  /** Coordinador (responsable/admin): asigna a otros técnicos. */
  canAssign?: boolean;
  /** Incidencia abierta al montar (la elige el aviso del panel). */
  initialDetailId?: Id<"incidents"> | null;
  /** Puede ver el módulo de peticiones, así que puede saltar a una. */
  canOpenRequests?: boolean;
  /** Abrir una petición concreta en su módulo. */
  onOpenRequest?: (id: Id<"partRequests">) => void;
}) {
  const incidents = useQuery(api.incidents.list, {}) ?? [];
  const equipment = useQuery(api.equipment.list, {}) ?? [];
  const requests =
    useQuery(api.partRequests.list, { includeArchived: true }) ?? [];

  const [reportsOpen, setReportsOpen] = useState(false);
  const archiveIncident = useMutation(api.incidents.archive);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const {
    filter,
    setFilter,
    setDetailId,
    search,
    setSearch,
    sort,
    setSort,
    compact,
    setCompact,
    counts,
    ordered,
    paging,
    areaRef,
    sections,
    detail,
  } = useIncidentFilters({
    incidents,
    initialDetailId,
  });

  const handleArchive = async (incident: IncidentDoc) => {
    setArchivingId(incident._id);
    try {
      await archiveIncident({ incidentId: incident._id });
      toast.success(
        `${incident.reference} al archivo · puedes recuperarla desde Archivo`,
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setArchivingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Los filtros en una sola línea: antes, con ocho estados, se partían en
            dos filas y empujaban la lista. En pantallas estrechas se recorren en
            horizontal, y cada uno dice si está puesto (`aria-pressed`). */}
        <div
          role="group"
          aria-label="Filtrar incidencias por estado"
          className="flex min-w-0 flex-1 flex-wrap items-center gap-0.5 rounded-lg border border-border/70 bg-card p-1 shadow-sm max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:[scrollbar-width:none] max-sm:[&::-webkit-scrollbar]:hidden"
        >
          {INCIDENT_FILTERS.map((option) => (
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

        <div className="flex flex-wrap items-center gap-2">
          {/* Entregar el trabajo de un mes: un archivo con todos los partes. */}
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => setReportsOpen(true)}
            title="Descarga en un solo archivo el informe de las incidencias de un periodo"
          >
            <FileDown className="size-4" />
            Informes del periodo
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/reportar" target="_blank">
              <Siren className="size-4" />
              Notificar incidencia
            </Link>
          </Button>
        </div>
      </div>

      {reportsOpen && (
        <IncidentReportsDialog
          open={reportsOpen}
          onOpenChange={setReportsOpen}
          equipment={equipment}
          requests={requests}
          canReadTrails={canAssign}
          currentUserName={currentUserName}
        />
      )}

      <QueueToolbar
        search={search}
        onSearchChange={setSearch}
        placeholder="Buscar por referencia, equipo, nº de serie, descripción, técnico…"
        sort={sort}
        onSortChange={setSort}
        sortOptions={SORT_OPTIONS}
        compact={compact}
        onCompactChange={setCompact}
        noun="incidencias"
      />

      {ordered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center shadow-sm">
          <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-signal/10 text-signal">
            {search !== "" ? (
              <SearchX className="size-5" />
            ) : (
              <Siren className="size-5" />
            )}
          </span>
          <p className="mt-4 text-base font-semibold tracking-tight">
            {search !== ""
              ? `Ninguna incidencia coincide con «${search}»`
              : filter === "all"
                ? "No hay incidencias notificadas"
                : `No hay incidencias «${INCIDENT_STATUS_META[filter as IncidentStatus].label}»`}
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
            {search !== ""
              ? "Prueba con otra referencia, otro equipo o el nombre del técnico, o limpia la búsqueda."
              : "Cualquier persona del taller puede notificar una incidencia desde el formulario público; aparecerá aquí para asignarla."}
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
            <Button asChild variant="outline" className="mt-5 gap-2">
              <Link to="/reportar" target="_blank">
                <Siren className="size-4" />
                Abrir formulario
              </Link>
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
                    {section.items.map((incident) => {
                      const status = INCIDENT_STATUS_META[incident.status];
                      const isClosed = isClosedIncident(incident.status);
                      // El estado de la espera y el de la reparación se enseñan con
                      // el sitio: «En espera de repuestos · taller».
                      const statusLabel = incidentStatusLabel(
                        incident.status,
                        isIncidentInWorkshop(incident),
                      );
                      return (
                        <div key={incident._id} data-row className="relative">
                          <button
                            type="button"
                            onClick={() => setDetailId(incident._id)}
                            className={cn(
                              "w-full rounded-xl border border-border/70 bg-card text-left shadow-sm transition-colors hover:border-signal/40",
                              compact ? "px-3 py-2" : "p-4",
                              canAssign && isClosed && "pb-12",
                            )}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-xs font-semibold text-muted-foreground">
                                  {incident.reference}
                                </span>
                                <Badge
                                  variant="outline"
                                  className={status.badgeClassName}
                                >
                                  {statusLabel}
                                </Badge>
                                {incident.location && (
                                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <MapPin className="size-3" />
                                    {incident.location}
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {formatDateTime(incident.reportedAt)}
                              </span>
                            </div>
                            <p
                              className={cn(
                                "truncate text-sm font-semibold tracking-tight",
                                compact ? "mt-1" : "mt-2",
                              )}
                            >
                              {incident.equipmentKind} · {incident.model}
                              {incident.serialNumber && (
                                <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">
                                  {incident.serialNumber}
                                </span>
                              )}
                            </p>
                            <RichText
                              value={incident.description}
                              className={cn(
                                "mt-1 text-sm leading-6 text-muted-foreground",
                                compact ? "line-clamp-1" : "line-clamp-2",
                                "[&_img]:max-h-36 [&_img]:w-auto [&_img]:rounded-md [&_img]:object-contain",
                                compact && "[&_img]:hidden",
                              )}
                            />
                            <div
                              className={cn(
                                "flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground",
                                compact ? "mt-1.5" : "mt-2.5",
                              )}
                            >
                              <span>Por {incident.reporterName}</span>
                              {incident.reporterRole && (
                                <span>· {incident.reporterRole}</span>
                              )}
                              {incident.assigneeName && (
                                <span className="font-medium text-foreground">
                                  · Técnico: {incident.assigneeName}
                                </span>
                              )}
                              {incident.workshopAssigneeName && (
                                <span className="font-medium text-amber-700">
                                  · Taller: {incident.workshopAssigneeName}
                                </span>
                              )}
                            </div>
                          </button>

                          {canAssign && isClosed && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              title={`Mandar ${incident.reference} al archivo`}
                              aria-label={`Archivar ${incident.reference}`}
                              disabled={archivingId === incident._id}
                              onClick={() => void handleArchive(incident)}
                              className="absolute bottom-3 right-3 z-10 gap-1.5 bg-card"
                            >
                              <Archive className="size-3.5" />
                              Archivar
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </ListArea>

          <TablePagination
            paging={paging}
            singular="incidencia"
            plural="incidencias"
            className="rounded-xl border border-border/70 bg-card shadow-sm"
          />
        </div>
      )}

      {detail && (
        <IncidentDetailSheet
          key={detail._id}
          incident={detail}
          equipment={equipment}
          requests={requests}
          currentUserId={currentUserId ?? null}
          currentUserName={currentUserName}
          canAssign={canAssign}
          canOpenRequests={canOpenRequests}
          onOpenRequest={onOpenRequest}
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  );
}
