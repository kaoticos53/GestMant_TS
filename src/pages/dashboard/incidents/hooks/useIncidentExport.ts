import { useState } from "react";
import { toast } from "sonner";
import type { Doc } from "@/convex/_generated/dataModel";
import { downloadText } from "@/lib/export";
import { downloadPdf, loadPdfImage } from "@/lib/pdfBrowser";
import {
  REPORT_MIME,
  incidentReport,
  incidentReportFilename,
  incidentReportPackageFilename,
  incidentReportPdfFilename,
} from "@/lib/report";
import { reportPackage } from "@/lib/reportPackage";
import {
  downloadReportPackage,
  loadReportPhoto,
} from "@/lib/reportPackageBrowser";
import { reportToPdf } from "@/lib/reportPdf";
import { equipmentLabel, getErrorMessage } from "@/lib/workshop";
import type { EquipmentDoc, IncidentDoc } from "../types";

export interface UseIncidentExportProps {
  incident: IncidentDoc;
  linkedEquipment: EquipmentDoc | null;
  linkedRequests: Doc<"partRequests">[];
  trail: Doc<"incidentDocumentLog">[] | undefined;
  currentUserName: string;
}

export function useIncidentExport({
  incident,
  linkedEquipment,
  linkedRequests,
  trail,
  currentUserName,
}: UseIncidentExportProps) {
  const [preparingPdf, setPreparingPdf] = useState(false);
  const [preparingPackage, setPreparingPackage] = useState(false);

  const reportContent = () =>
    incidentReport({
      incident,
      equipmentName: linkedEquipment
        ? equipmentLabel(linkedEquipment)
        : undefined,
      trail: trail ?? undefined,
      requests: linkedRequests,
      exportedBy: currentUserName,
    });

  const handleDownloadReport = () => {
    try {
      downloadText(
        incidentReportFilename(incident.reference),
        reportContent(),
        REPORT_MIME,
      );
      toast.success(`Parte de ${incident.reference} descargado`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleDownloadReportPackage = async () => {
    setPreparingPackage(true);
    try {
      const pack = await reportPackage({
        markdown: reportContent(),
        markdownName: incidentReportFilename(incident.reference),
        loadPhoto: loadReportPhoto,
      });
      downloadReportPackage(
        incidentReportPackageFilename(incident.reference),
        pack.bytes,
      );
      const fotos =
        pack.photos.length === 0
          ? "sin fotos"
          : pack.photos.length === 1
            ? "con 1 foto"
            : `con ${pack.photos.length} fotos`;
      if (pack.missing.length === 0) {
        toast.success(`Paquete de ${incident.reference} descargado ${fotos}`);
      } else {
        toast.warning(
          `Paquete de ${incident.reference} descargado ${fotos} · faltó ${pack.missing.join(", ")}`,
        );
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setPreparingPackage(false);
    }
  };

  const handleDownloadReportPdf = async () => {
    setPreparingPdf(true);
    try {
      const bytes = await reportToPdf(reportContent(), {
        footer: `Parte de ${incident.reference} · Pulso Taller`,
        loadImage: loadPdfImage,
      });
      downloadPdf(incidentReportPdfFilename(incident.reference), bytes);
      toast.success(`Parte de ${incident.reference} en PDF descargado`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setPreparingPdf(false);
    }
  };

  return {
    preparingPdf,
    preparingPackage,
    reportContent,
    handleDownloadReport,
    handleDownloadReportPackage,
    handleDownloadReportPdf,
  };
}
