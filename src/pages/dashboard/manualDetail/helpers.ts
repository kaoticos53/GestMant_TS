import { manualRecord, manualRecordPdfFilename } from "@/lib/manualRecord";
import { manualScopeLabel } from "@/lib/manuals";
import { downloadPdf, loadPdfImage } from "@/lib/pdfBrowser";
import { reportToPdf } from "@/lib/reportPdf";
import { equipmentLabel } from "@/lib/workshop";
import type { ManualDoc } from "../ManualsView";
import type { EquipmentDoc } from "./types";

/**
 * Busca el equipo vinculado en la lista por ID.
 */
export function findLinkedEquipment(
  equipment: EquipmentDoc[],
  equipmentId?: string
): EquipmentDoc | undefined {
  if (!equipmentId) return undefined;
  return equipment.find((item) => item._id === equipmentId);
}

/**
 * Genera el texto de ámbito/alcance para el subtítulo del manual.
 */
export function getManualScopeDescription(
  manual: ManualDoc,
  linked?: EquipmentDoc
): string {
  if (linked) {
    return `Asignado a ${equipmentLabel(linked)}`;
  }
  return manualScopeLabel(manual);
}

/**
 * Genera la descripción completa del subtítulo incluyendo el autor si existe.
 */
export function getManualSubtitle(
  manual: ManualDoc,
  linked?: EquipmentDoc
): string {
  const scope = getManualScopeDescription(manual, linked);
  return manual.author ? `${scope} · ${manual.author}` : scope;
}

/**
 * Compone y descarga en el navegador el PDF oficial de la ficha del manual.
 */
export async function exportManualPdf(
  manual: ManualDoc,
  linked?: EquipmentDoc
): Promise<void> {
  const bytes = await reportToPdf(
    manualRecord(manual, {
      equipmentName: linked ? equipmentLabel(linked) : undefined,
    }),
    {
      footer: `Ficha del manual «${manual.title}» · Pulso Taller`,
      loadImage: loadPdfImage,
    }
  );
  downloadPdf(manualRecordPdfFilename(manual.title), bytes);
}
