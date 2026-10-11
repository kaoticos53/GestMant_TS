import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ListArea } from "@/components/ListArea";
import { TablePagination } from "@/components/TablePagination";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  AUDIT_ACTIONS,
  AUDIT_PRESETS,
  EMPTY_AUDIT_FILTERS,
  applyAuditPreset,
  auditActionCount,
  auditCsvTable,
  auditFilterCount,
  auditPresetOf,
  auditQueryArgs,
  auditRange,
  describeAuditRange,
  summarizeAudit,
  type AuditFilters,
} from "@/lib/audit";
import {
  groupByDate,
  matchesQuery,
  sortByDate,
  type DateSortId,
} from "@/lib/browse";
import {
  INCIDENT_STATUS_META,
  documentTrailLabel,
  formatClockTime,
  formatDateTime,
} from "@/lib/workshop";
import { csvFilename, downloadCsv, toCsv } from "@/lib/export";
import { useRowsThatFit } from "@/hooks/use-rows-that-fit";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { CalendarDays, FileClock, FileDown, RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  QueueToolbar,
  type QueueSortId,
  type QueueSortOption,
} from "./QueueToolbar";

/** Órdenes del rastro: la fecha del movimiento es lo que lo ordena todo. */
const SORT_OPTIONS: QueueSortOption[] = [
  { id: "recent", label: "Movimiento: lo último primero" },
  { id: "oldest", label: "Movimiento: lo más antiguo primero" },
];

/** Valor del desplegable de persona cuando no se filtra por ninguna. */
const EVERYONE = "all";

/** Valor del desplegable de tipo cuando no se filtra por ninguno. */
const EVERY_KIND = "all";

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
export function AuditView({
  onOpenIncident,
}: {
  /** Abre la ficha de una incidencia en la cola (solo si no está archivada). */
  onOpenIncident: (id: Id<"incidents">) => void;
}) {
  const [filters, setFilters] = useState<AuditFilters>(EMPTY_AUDIT_FILTERS);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<QueueSortId>("recent");
  // Vista compacta: las mismas filas con menos aire, para barrer más de golpe.
  const [compact, setCompact] = useState(false);

  const audit = useQuery(api.incidents.documentAudit, auditQueryArgs(filters));

  const rango = auditRange(filters);
  const activePreset = auditPresetOf(rango);
  const filterCount = auditFilterCount(filters);
  const entries = audit?.entries ?? [];

  /** Cambiar cualquier filtro devuelve la lista a su primera página. */
  const applyFilters = (
    next: AuditFilters | ((current: AuditFilters) => AuditFilters),
  ) => {
    setFilters(next);
  };

  const resetFilters = () => {
    setFilters(EMPTY_AUDIT_FILTERS);
    setSearch("");
  };

  /**
   * Descarga en CSV el tramo filtrado —persona, fechas y tipo, más la búsqueda
   * y el orden que se estén viendo—: no solo la tanda cargada, todo lo que
   * pasa los filtros, que es lo que se leerá en la hoja de cálculo.
   */
  const handleExport = () => {
    const { header, rows } = auditCsvTable(sorted);
    downloadCsv(csvFilename("auditoria"), toCsv(header, rows));
    toast.success(`Auditoría exportada: ${rows.length} movimientos`);
  };

  // La búsqueda es de texto sobre lo que ya filtró el servidor (referencia,
  // persona, documento o equipo): afina sin volver a consultar.
  const searched = entries.filter((entry) =>
    matchesQuery(
      [
        entry.reference,
        entry.title,
        entry.by,
        entry.name,
        entry.previousName,
        // La frase del rastro entra en la búsqueda: «quitó», «renombró»...
        documentTrailLabel(entry),
      ],
      search,
    ),
  );
  const direction: DateSortId = sort === "oldest" ? "oldest" : "recent";
  const sorted = sortByDate(searched, (entry) => entry.at, direction);
  // La misma medida que en las colas: cuántos movimientos caben en el alto del
  // área —contados por el navegador— y la lista partida en páginas con esos. La
  // vista compacta encoge cada fila, así que vuelve a medir a propósito.
  const { areaRef, rowsFit } = useRowsThatFit({
    shape: "cards",
    remeasureKey: compact,
  });
  // La firma de lo que se está mirando —búsqueda, orden y filtros—: cuando
  // cambia, la lista vuelve a su primera página, que lo que se busca no está al
  // final de otra lista.
  const listKey = `${search}|${sort}|${filters.userId ?? ""}|${filters.from}|${filters.to}|${filters.action}`;
  const paging = useTablePagination({
    total: sorted.length,
    rowsFit,
    resetKey: listKey,
  });
  const visible = sorted.slice(paging.from - 1, paging.to);
  const groups = groupByDate(visible, (entry) => entry.at);
  const summary = summarizeAudit(searched);
  const breakdown = AUDIT_ACTIONS.filter(
    (action) => summary.byAction[action.id] > 0,
  ).map((action) => auditActionCount(action.id, summary.byAction[action.id]));

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-signal/10 text-signal">
            <FileClock className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-tight">
              Auditoría de documentos
            </h2>
            <p className="mt-0.5 max-w-3xl text-xs leading-5 text-muted-foreground">
              Cada alta, edición, reemplazo de archivo y retirada de un
              documento del expediente, de todas las incidencias y con quién lo
              firmó. Lo retirado ya no está en la ficha —y de un archivo
              reemplazado tampoco queda el anterior—: su movimiento es la única
              constancia que queda.
            </p>
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
              <span>
                {describeAuditRange(rango)}
                {audit === undefined
                  ? ""
                  : ` · ${audit.summary.total} de ${audit.unfilteredTotal} movimientos del historial`}
              </span>
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-1.5">
            <Label
              htmlFor="auditoria-persona"
              className="text-xs text-muted-foreground"
            >
              Persona
            </Label>
            <Select
              value={filters.userId ?? EVERYONE}
              onValueChange={(value) =>
                applyFilters((current) => ({
                  ...current,
                  userId: value === EVERYONE ? null : (value as Id<"users">),
                }))
              }
            >
              <SelectTrigger
                id="auditoria-persona"
                aria-label="Persona que hizo el movimiento"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EVERYONE}>Todas las personas</SelectItem>
                {(audit?.authors ?? []).map((author) => (
                  <SelectItem key={author.id} value={author.id}>
                    {`${author.name} · ${author.movements} ${
                      author.movements === 1 ? "movimiento" : "movimientos"
                    }`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label
              htmlFor="auditoria-tipo"
              className="text-xs text-muted-foreground"
            >
              Tipo de movimiento
            </Label>
            <Select
              value={filters.action === "" ? EVERY_KIND : filters.action}
              onValueChange={(value) =>
                applyFilters((current) => ({
                  ...current,
                  action:
                    value === EVERY_KIND
                      ? ""
                      : (value as typeof current.action),
                }))
              }
            >
              <SelectTrigger
                id="auditoria-tipo"
                aria-label="Tipo de movimiento"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EVERY_KIND}>
                  Todos los movimientos
                </SelectItem>
                {AUDIT_ACTIONS.map((action) => (
                  <SelectItem key={action.id} value={action.id}>
                    {action.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label
              htmlFor="auditoria-desde"
              className="text-xs text-muted-foreground"
            >
              Desde
            </Label>
            <Input
              id="auditoria-desde"
              type="date"
              value={filters.from}
              onChange={(event) =>
                applyFilters((current) => ({
                  ...current,
                  from: event.target.value,
                }))
              }
            />
          </div>

          <div className="grid gap-1.5">
            <Label
              htmlFor="auditoria-hasta"
              className="text-xs text-muted-foreground"
            >
              Hasta
            </Label>
            <Input
              id="auditoria-hasta"
              type="date"
              value={filters.to}
              onChange={(event) =>
                applyFilters((current) => ({
                  ...current,
                  to: event.target.value,
                }))
              }
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {AUDIT_PRESETS.map((preset) => {
            const active = activePreset === preset.id;
            return (
              <Button
                key={preset.id}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                aria-pressed={active}
                onClick={() =>
                  applyFilters((current) =>
                    applyAuditPreset(current, preset.id),
                  )
                }
              >
                {preset.label}
              </Button>
            );
          })}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="gap-2"
            disabled={filterCount === 0 && search.trim() === ""}
            onClick={resetFilters}
          >
            <RotateCcw className="size-3.5" />
            Reiniciar filtros
          </Button>
          {/* Lo que se descarga es el tramo filtrado entero, no solo lo que ya
              está a la vista: la hoja se lleva todo lo que pasa el filtro. */}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="ml-auto gap-2"
            onClick={handleExport}
            disabled={sorted.length === 0}
            title="Descarga en CSV los movimientos del tramo filtrado (persona, fechas y tipo) en el orden que se ve"
          >
            <FileDown className="size-4" />
            Exportar CSV ({sorted.length})
          </Button>
        </div>

        <p className="mt-3 border-t border-border/60 pt-3 text-xs leading-5 text-muted-foreground">
          {summary.total === 0 ? (
            "Ningún movimiento con estos filtros."
          ) : (
            <>
              <span className="font-medium text-foreground">
                {`${summary.total} ${
                  summary.total === 1 ? "movimiento" : "movimientos"
                }`}
              </span>
              {` · ${summary.people} ${
                summary.people === 1 ? "persona" : "personas"
              } · ${summary.incidents} ${
                summary.incidents === 1 ? "incidencia" : "incidencias"
              }`}
              {breakdown.length > 0 ? ` · ${breakdown.join(" · ")}` : ""}
            </>
          )}
        </p>
      </section>

      {audit === undefined ? (
        <div className="grid gap-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      ) : audit.unfilteredTotal === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center shadow-sm">
          <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-signal/10 text-signal">
            <FileClock className="size-5" />
          </span>
          <h2 className="mt-4 text-lg font-semibold tracking-tight">
            Todavía no hay movimientos de documentos
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
            Aquí aparecerá cada documento que se adjunte, se edite o se retire
            del expediente de una incidencia, con quién lo hizo y cuándo.
          </p>
        </div>
      ) : (
        <>
          <QueueToolbar
            search={search}
            onSearchChange={setSearch}
            placeholder="Buscar por referencia, persona o documento"
            sort={sort}
            onSortChange={setSort}
            sortOptions={SORT_OPTIONS}
            compact={compact}
            onCompactChange={setCompact}
            noun="movimientos"
          />

          {sorted.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center shadow-sm">
              <h2 className="text-base font-semibold tracking-tight">
                Ningún movimiento con estos filtros
              </h2>
              <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                {`Hay ${audit.unfilteredTotal} movimientos en el historial: prueba con otra persona, otro tipo de movimiento o unas fechas más amplias.`}
              </p>
              <Button
                type="button"
                className="mt-5 gap-2"
                onClick={resetFilters}
              >
                <RotateCcw className="size-4" />
                Ver todo el historial
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* El alto del listado queda acotado a la pantalla, así que se
                  recorre con la barra del propio listado y el rótulo del día se
                  queda pegado arriba. El pie con la paginación va fuera: sigue a
                  la vista sin tener que bajar hasta el final. */}
              <ListArea ref={areaRef} resetKey={`${listKey}|${paging.page}`}>
                <div className="flex flex-col gap-4">
                  {groups.map((group) => (
                    <section
                      key={group.key}
                      className="rounded-xl border border-border/70 bg-card shadow-sm"
                    >
                      <h3
                        data-row-header
                        className={cn(
                          // El rótulo del día se queda pegado arriba mientras se
                          // recorre el listado, para no perder de vista en qué
                          // día se está; el fondo translúcido lleva desenfoque
                          // para que no se lea lo que pasa por debajo.
                          "rounded-t-[11px] border-b border-border/60 bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur-sm lg:sticky lg:top-0 lg:z-10",
                          compact ? "px-3 py-1.5" : "px-4 py-2",
                        )}
                      >
                        {group.label}
                      </h3>
                      <ul className="divide-y divide-border/60">
                        {group.items.map((entry) => {
                          const meta = entry.status
                            ? INCIDENT_STATUS_META[entry.status]
                            : undefined;
                          return (
                            <li
                              key={entry._id}
                              data-row
                              className={cn(
                                "flex flex-wrap items-start justify-between gap-3",
                                compact ? "px-3 py-1.5" : "px-4 py-3",
                              )}
                            >
                              <div className="min-w-0 flex-1">
                                <p
                                  className={cn(
                                    compact
                                      ? "text-xs leading-5"
                                      : "text-sm leading-6",
                                  )}
                                >
                                  {documentTrailLabel(entry)}
                                </p>
                                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                  <span className="font-medium text-foreground">
                                    {entry.by}
                                  </span>
                                  {entry.archived ? (
                                    <span className="font-mono">
                                      {entry.reference}
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onOpenIncident(entry.incidentId)
                                      }
                                      title={`Abrir la ficha de ${entry.reference}`}
                                      className="cursor-pointer rounded font-mono font-medium text-signal underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                      {entry.reference}
                                    </button>
                                  )}
                                  {entry.title !== "" && (
                                    <span>{entry.title}</span>
                                  )}
                                </p>
                              </div>
                              <div className="flex shrink-0 flex-wrap items-center gap-2">
                                {meta && (
                                  <Badge
                                    variant="outline"
                                    className={meta.badgeClassName}
                                  >
                                    {meta.label}
                                  </Badge>
                                )}
                                {entry.archived && (
                                  <Badge
                                    variant="outline"
                                    className="font-normal"
                                  >
                                    Archivada
                                  </Badge>
                                )}
                                <span
                                  className="text-xs text-muted-foreground"
                                  title={formatDateTime(entry.at)}
                                >
                                  {formatClockTime(entry.at)}
                                </span>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
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
