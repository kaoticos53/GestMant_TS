import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IncidentReportsDateRangeFields } from "./incidentReports/components/IncidentReportsDateRangeFields";
import { IncidentReportsFooter } from "./incidentReports/components/IncidentReportsFooter";
import { IncidentReportsPeriodPresets } from "./incidentReports/components/IncidentReportsPeriodPresets";
import { IncidentReportsSummaryCard } from "./incidentReports/components/IncidentReportsSummaryCard";
import { useIncidentReportsState } from "./incidentReports/hooks/useIncidentReportsState";
import type { IncidentReportsDialogProps } from "./incidentReports/types";

/**
 * Lote de informes: descarga en un solo archivo el parte de todas las
 * incidencias de un periodo —el mismo informe que se saca de cada ficha— para
 * entregarlo fuera de la aplicación.
 */
export function IncidentReportsDialog({
  open,
  onOpenChange,
  equipment = [],
  requests,
  canReadTrails = false,
  currentUserName,
}: IncidentReportsDialogProps) {
  const {
    from,
    setFrom,
    to,
    setTo,
    basis,
    setBasis,
    range,
    activePreset,
    applyPreset,
    count,
    breakdown,
    references,
    loading,
    trailsPending,
    handleExport,
  } = useIncidentReportsState({
    equipment,
    requests,
    canReadTrails,
    currentUserName,
    onOpenChange,
  });

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
          <IncidentReportsPeriodPresets
            activePreset={activePreset}
            onSelectPreset={applyPreset}
          />

          <IncidentReportsDateRangeFields
            from={from}
            to={to}
            basis={basis}
            onChangeFrom={setFrom}
            onChangeTo={setTo}
            onChangeBasis={setBasis}
          />
        </div>

        <IncidentReportsSummaryCard
          loading={loading}
          range={range}
          count={count}
          breakdown={breakdown}
          references={references}
          canReadTrails={canReadTrails}
        />

        <IncidentReportsFooter
          loading={loading}
          count={count}
          trailsPending={trailsPending}
          onCancel={() => onOpenChange(false)}
          onExport={handleExport}
        />
      </DialogContent>
    </Dialog>
  );
}
