import { useState } from "react";
import { useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { dayInputValue } from "@/lib/audit";
import { downloadText } from "@/lib/export";
import {
  REPORT_MIME,
  type REPORT_PERIODS,
  type ReportPeriodBasis,
  inReportPeriod,
  incidentsReport,
  incidentsReportFilename,
  reportPeriodOf,
  reportPeriodRange,
  reportRange,
  reportStatusCounts,
} from "@/lib/report";
import { getErrorMessage } from "@/lib/workshop";
import {
  getLinkedEquipmentName,
  groupRequestsByIncident,
  groupTrailsByIncident,
} from "../helpers";
import type {
  EquipmentDoc,
  IncidentDoc,
  PartRequestDoc,
} from "../types";

export interface UseIncidentReportsStateParams {
  equipment?: EquipmentDoc[];
  requests?: PartRequestDoc[];
  canReadTrails?: boolean;
  currentUserName: string;
  onOpenChange: (open: boolean) => void;
}

export function useIncidentReportsState({
  equipment = [],
  requests,
  canReadTrails = false,
  currentUserName,
  onOpenChange,
}: UseIncidentReportsStateParams) {
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
  const selected = (incidents ?? []).filter((incident: IncidentDoc) =>
    inReportPeriod(incident, range, basis),
  );
  const selectedIds = selected.map((incident: IncidentDoc) => incident._id);

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

  const trailsByIncident = canReadTrails
    ? groupTrailsByIncident(trails, selectedIds)
    : new Map();

  const requestsByIncident = groupRequestsByIncident(allRequests);

  const handleExport = () => {
    try {
      const content = incidentsReport({
        entries: selected.map((incident: IncidentDoc) => ({
          incident,
          equipmentName: getLinkedEquipmentName(incident, equipment),
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
  const references = selected.map((incident: IncidentDoc) => incident.reference);
  const loading = incidents === undefined;

  return {
    from,
    setFrom,
    to,
    setTo,
    basis,
    setBasis,
    range,
    activePreset,
    applyPreset,
    count: selected.length,
    breakdown,
    references,
    loading,
    trailsPending,
    handleExport,
  };
}
