import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileDown } from "lucide-react";

interface IncidentExportDropdownProps {
  reference: string;
  trailPending: boolean;
  preparingPdf: boolean;
  preparingPackage: boolean;
  onDownloadReport: () => void;
  onDownloadReportPdf: () => void;
  onDownloadReportPackage: () => void;
}

export function IncidentExportDropdown({
  reference,
  trailPending,
  preparingPdf,
  preparingPackage,
  onDownloadReport,
  onDownloadReportPdf,
  onDownloadReportPackage,
}: IncidentExportDropdownProps) {
  const isPreparing = preparingPdf || preparingPackage;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          disabled={trailPending}
          title={
            trailPending
              ? "Cargando el rastro de auditoría…"
              : "Descargar el parte de la incidencia"
          }
        >
          <FileDown className="size-4" />
          Descargar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
          Parte de {reference}
        </DropdownMenuLabel>
        <DropdownMenuItem onSelect={onDownloadReport}>
          Markdown, para leerlo o editarlo
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isPreparing}
          onSelect={onDownloadReportPdf}
        >
          {preparingPdf ? "Preparando PDF…" : "PDF, listo para entregar"}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isPreparing}
          onSelect={onDownloadReportPackage}
        >
          {preparingPackage
            ? "Preparando paquete…"
            : "ZIP con las fotos dentro"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
