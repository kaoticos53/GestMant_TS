import { useState } from "react";
import type { Doc } from "@/convex/_generated/dataModel";
import {
  equipmentRecord,
  equipmentRecordPdfFilename,
} from "@/lib/equipmentRecord";
import { downloadPdf, loadPdfImage } from "@/lib/pdfBrowser";
import { reportToPdf } from "@/lib/reportPdf";
import { equipmentLabel, getErrorMessage } from "@/lib/workshop";
import { toast } from "sonner";
import type { ManualDoc } from "../../ManualsView";
import type { EquipmentDoc, RecordDoc } from "../types";

interface UseEquipmentPdfExportOptions {
  item: EquipmentDoc;
  manuals?: { assigned: ManualDoc[]; byModel: ManualDoc[] };
  related: Doc<"partRequests">[];
  requests: Doc<"partRequests">[];
  maintenance?: RecordDoc[];
}

/**
 * Hook para componer y descargar en el navegador la ficha técnica del equipo en formato PDF.
 */
export function useEquipmentPdfExport({
  item,
  manuals = { assigned: [], byModel: [] },
  related,
  requests,
  maintenance = [],
}: UseEquipmentPdfExportOptions) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const bytes = await reportToPdf(
        equipmentRecord(item, {
          manuals,
          requests: related,
          interventions: maintenance.map((record) => ({
            kind: record.kind,
            title: record.title,
            description: record.description,
            performedAt: record.performedAt,
            technician: record.technician,
            requestReference: record.requestId
              ? requests.find((request) => request._id === record.requestId)
                  ?.reference
              : undefined,
          })),
        }),
        {
          footer: `Ficha del equipo «${equipmentLabel(item)}» · Pulso Taller`,
          loadImage: loadPdfImage,
        },
      );
      downloadPdf(equipmentRecordPdfFilename(equipmentLabel(item)), bytes);
      toast.success("Ficha del equipo descargada en PDF");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  return {
    exporting,
    handleExport,
  };
}
