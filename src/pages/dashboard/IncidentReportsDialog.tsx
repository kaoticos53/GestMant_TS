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
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { dayInputValue, describeAuditRange } from "@/lib/audit";
import { downloadText } from "@/lib/export";
import {
  REPORT_MIME,
  REPORT_PERIOD_BASES,
  REPORT_PERIODS,
  inReportPeriod,
  incidentsReport,
  incidentsReportFilename,
  reportPeriodOf,
  reportPeriodRange,
  reportPeriodTitle,
  reportRange,
  reportStatusCounts,
  type ReportPeriodBasis,
  type ReportTrailEntry,
} from "@/lib/report";
import { equipmentLabel, getErrorMessage } from "@/lib/workshop";
import { useQuery } from "convex/react";
import { CalendarDays, FileDown } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type IncidentDoc = Doc<"incidents">;
type EquipmentDoc = Doc<"equipment">;
type PartRequestDoc = Doc<"partRequests">;

/** Cuántas referencias se enseñan en el resumen antes de decir «y N más». */
const PREVIEW_LIMIT = 6;

/**
 * Lote de informes: descarga en un solo archivo el parte de todas las
 * incidencias de un periodo —el mismo informe que se saca de cada ficha— para
 * entregarlo fuera de la aplicación. El periodo se elige con atajos de mes o
 * con dos fechas, y las incidencias entran por su fecha de notificación o por
 * la de cierre, que son las dos formas de contar el trabajo de un mes.
 *
 * El archivo lleva el informe completo de cada incidencia, con su rastro de
 * documentos si quien exporta puede leer el expediente: el lote enseña
 * exactamente lo mismo que enseñaría cada ficha abierta por esa persona.
 *
 * Se consulta la lista completa —archivadas incluidas— solo al abrirse: el
 * módulo de incidencias trabaja con lo que está a la vista, pero un parte de un
 * mes no debe perder lo que ya se archivó.
 */
export function IncidentReportsDialog({
  open,
  onOpenChange,
  equipment = [],
  requests,
  canReadTrails = false,
  currentUserName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Equipos del inventario, para nombrar el equipo de cada informe. */
  equipment?: EquipmentDoc[];
  /** Peticiones de repuestos del taller (si quien llama ya las consultó). */
  requests?: PartRequestDoc[];
  /** Quien coordina el expediente puede exportar también su auditoría. */
  canReadTrails?: boolean;
  currentUserName: string;
}) {
  // El periodo nace en el mes en curso: es lo que se entrega casi siempre.
  const [from, setFrom] = useState(() =>
    dayInputValue(reportPeriodRange("thisMonth").from as number),
  );
  const [to, setTo] = useState(() =>
    dayInputValue(reportPeriodRange("thisMonth").to as number),
  );
  const [basis, setBasis] = useState<ReportPeriodBasis>("reported");

  const incidents = useQuery(api.incidents.list, { includeArchived: true });
  const liveRequests = useQuery(
    api.partRequests.list,
    requests === undefined ? { includeArchived: true } : "skip",
  );
  const allRequests = requests ?? liveRequests ?? [];

  const range = reportRange(from, to);
  const activePreset = reportPeriodOf(range);
  const selected = (incidents ?? []).filter((incident) =>
    inReportPeriod(incident, range, basis),
  );
  const selectedIds = selected.map((incident) => incident._id);

  // El rastro de todo el lote llega en una sola consulta, y solo si quien
  // exporta puede leer el expediente: al resto el backend se lo negaría.
  const trails = useQuery(
    api.incidents.documentTrails,
    canReadTrails && selectedIds.length > 0
      ? { incidentIds: selectedIds }
      : "skip",
  );
  const trailsPending =
    canReadTrails && selectedIds.length > 0 && trails === undefined;

  const applyPreset = (preset: (typeof REPORT_PERIODS)[number]["id"]) => {
    const next = reportPeriodRange(preset);
    setFrom(next.from === null ? "" : dayInputValue(next.from));
    setTo(next.to === null ? "" : dayInputValue(next.to));
  };

  /** El rastro de cada incidencia, tal y como lo pide el informe. */
  const trailsByIncident = new Map<string, ReportTrailEntry[]>();
  if (canReadTrails && trails !== undefined) {
    for (const incidentId of selectedIds) {
      trailsByIncident.set(
        incidentId,
        trails.filter((entry) => entry.incidentId === incidentId),
      );
    }
  }

  /** Peticiones de cada incidencia para desglosar sus repuestos. */
  const requestsByIncident = new Map<string, PartRequestDoc[]>();
  for (const req of allRequests) {
    if (req.incidentId) {
      const list = requestsByIncident.get(req.incidentId) ?? [];
      list.push(req);
      requestsByIncident.set(req.incidentId, list);
    }
  }

  const equipmentNameOf = (incident: IncidentDoc): string | undefined => {
    const linked = incident.equipmentId
      ? equipment.find((item) => item._id === incident.equipmentId)
      : undefined;
    return linked ? equipmentLabel(linked) : undefined;
  };

  const handleExport = () => {
    try {
      const content = incidentsReport({
        entries: selected.map((incident) => ({
          incident,
          equipmentName: equipmentNameOf(incident),
          trail: canReadTrails
            ? (trailsByIncident.get(incident._id) ?? [])
            : undefined,
          requests: requestsByIncident.get(incident._id) ?? [],
        })),
        range,
        basis,
        exportedBy: currentUserName,
      });
      downloadText(incidentsReportFilename(range), content, REPORT_MIME);
      toast.success(
        `Informes descargados: ${selected.length} ${
          selected.length === 1 ? "incidencia" : "incidencias"
        }`,
      );
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const breakdown = reportStatusCounts(selected);
  const loading = incidents === undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Informes de un periodo</DialogTitle>
          <DialogDescription>
            Un solo archivo con el informe completo de todas las incidencias del
            periodo —el mismo que se descarga de cada ficha—, listo para
            entregar fuera de la aplicación.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {REPORT_PERIODS.map((preset) => {
              const active = activePreset === preset.id;
              return (
                <Button
                  key={preset.id}
                  type="button"
                  size="sm"
                  variant={active ? "default" : "outline"}
                  aria-pressed={active}
                  onClick={() => applyPreset(preset.id)}
                >
                  {preset.label}
                </Button>
              );
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label
                htmlFor="lote-desde"
                className="text-xs text-muted-foreground"
              >
                Desde
              </Label>
              <Input
                id="lote-desde"
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label
                htmlFor="lote-hasta"
                className="text-xs text-muted-foreground"
              >
                Hasta
              </Label>
              <Input
                id="lote-hasta"
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label
                htmlFor="lote-base"
                className="text-xs text-muted-foreground"
              >
                Entran por
              </Label>
              <Select
                value={basis}
                onValueChange={(value) => setBasis(value as ReportPeriodBasis)}
              >
                <SelectTrigger
                  id="lote-base"
                  aria-label="Por qué fecha entra la incidencia"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_PERIOD_BASES.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {`Fecha de ${option.label.toLowerCase()}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
          {loading ? (
            <Skeleton className="h-16 rounded-lg" />
          ) : (
            <>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays
                  className="size-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span>{describeAuditRange(range)}</span>
              </p>
              <p className="mt-1.5 text-sm">
                <span className="font-medium text-foreground">
                  {selected.length === 1
                    ? "1 incidencia"
                    : `${selected.length} incidencias`}
                </span>
                {breakdown.length > 0 ? ` · ${breakdown.join(" · ")}` : ""}
              </p>
              {selected.length > 0 && (
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {selected
                    .slice(0, PREVIEW_LIMIT)
                    .map((incident) => incident.reference)
                    .join(" · ")}
                  {selected.length > PREVIEW_LIMIT
                    ? ` y ${selected.length - PREVIEW_LIMIT} más`
                    : ""}
                </p>
              )}
              <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                {`El archivo se titula «Informes de incidencias · ${reportPeriodTitle(
                  range,
                )}» y se llama `}
                <span className="font-mono">
                  {incidentsReportFilename(range)}
                </span>
                . Incluye las incidencias archivadas
                {canReadTrails
                  ? " y, con cada informe, el rastro de documentos de su expediente."
                  : ", sin el rastro de documentos del expediente, que lee quien coordina la incidencia."}
              </p>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="gap-2"
            disabled={loading || selected.length === 0 || trailsPending}
            title={
              trailsPending
                ? "Cargando el rastro de auditoría…"
                : "Descarga un archivo Markdown con el informe de cada incidencia"
            }
            onClick={handleExport}
          >
            <FileDown className="size-4" />
            {trailsPending
              ? "Cargando..."
              : `Descargar informes (${selected.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
