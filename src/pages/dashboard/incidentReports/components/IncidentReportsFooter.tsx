import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import type { IncidentReportsFooterProps } from "../types";

export function IncidentReportsFooter({
  loading,
  count,
  trailsPending,
  onCancel,
  onExport,
}: IncidentReportsFooterProps) {
  return (
    <DialogFooter>
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
      >
        Cancelar
      </Button>
      <Button
        type="button"
        className="gap-2"
        disabled={loading || count === 0 || trailsPending}
        title={
          trailsPending
            ? "Cargando el rastro de auditoría…"
            : "Descarga un archivo Markdown con el informe de cada incidencia"
        }
        onClick={onExport}
      >
        <FileDown className="size-4" />
        {trailsPending
          ? "Cargando..."
          : `Descargar informes (${count})`}
      </Button>
    </DialogFooter>
  );
}
