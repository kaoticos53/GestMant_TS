import {
  MANUAL_FILE_FORMAT,
  isPdfFile,
} from "@/lib/manuals";
import { richDocToStore } from "@/lib/richDoc";
import {
  MAX_MANUAL_FILE_SIZE_LABEL,
  exceedsManualLimit,
  looksLikePdf,
} from "@/lib/upload";
import type { EquipmentDoc, EquipmentModelDoc } from "./types";

/**
 * Deduplica y ordena alfabéticamente en español los modelos existentes
 * tanto en el catálogo de modelos como en los equipos inventariados.
 */
export function getUniqueModels(
  catalogModels: EquipmentModelDoc[],
  equipment: EquipmentDoc[],
): string[] {
  const set = new Set<string>();
  for (const cm of catalogModels) {
    const trimmed = cm.model?.trim();
    if (trimmed) set.add(trimmed);
  }
  for (const eq of equipment) {
    const trimmed = eq.model?.trim();
    if (trimmed) set.add(trimmed);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
}

/**
 * Si se introduce un modelo existente en el catálogo y no se ha especificado
 * marca previa, busca y sugiere la marca asociada en el catálogo.
 */
export function suggestBrandForModel(
  modelValue: string,
  catalogModels: EquipmentModelDoc[],
): string | undefined {
  const clean = modelValue.trim().toLowerCase();
  if (!clean) return undefined;
  const found = catalogModels.find(
    (m) => m.model.toLowerCase() === clean,
  );
  return found?.brand?.trim() || undefined;
}

/**
 * Comprueba las precondiciones síncronas antes de iniciar el guardado
 * de un manual (título, presencia de archivo en alta, o notas no vacías).
 */
export function validateManualSubmission({
  title,
  isFile,
  isEdit,
  file,
  notes,
}: {
  title: string;
  isFile: boolean;
  isEdit: boolean;
  file: File | null;
  notes: string;
}): string | null {
  if (!title.trim() && !(isFile && (file || isEdit))) {
    return "Ponle un título al manual.";
  }
  if (isFile && !isEdit && !file) {
    return "Elige el archivo del manual.";
  }
  if (!isFile && !richDocToStore(notes)) {
    return "Escribe la nota del manual: es su contenido.";
  }
  return null;
}

/**
 * Valida un archivo candidato: extensión/MIME PDF, límite de tamaño
 * y cabecera de bytes de PDF (%PDF-).
 */
export async function validateManualFile(
  chosen: File | null,
): Promise<{ valid: boolean; error?: string }> {
  if (!chosen) {
    return { valid: false };
  }

  if (!isPdfFile({ name: chosen.name, contentType: chosen.type })) {
    return {
      valid: false,
      error: `El manual se sube en ${MANUAL_FILE_FORMAT}.`,
    };
  }

  if (exceedsManualLimit(chosen)) {
    return {
      valid: false,
      error: `El manual puede pesar como mucho ${MAX_MANUAL_FILE_SIZE_LABEL}.`,
    };
  }

  try {
    const head = new Uint8Array(await chosen.slice(0, 4).arrayBuffer());
    if (!looksLikePdf(head)) {
      return {
        valid: false,
        error: `El manual se sube en ${MANUAL_FILE_FORMAT}. El archivo seleccionado no contiene una cabecera PDF válida (%PDF-).`,
      };
    }
  } catch {
    // Si la lectura directa de cabecera no está disponible en el entorno cliente, valida el backend
  }

  return { valid: true };
}
