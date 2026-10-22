import { equipmentLabel } from "@/lib/workshop";
import type { EquipmentDoc } from "../../../types";

/**
 * Formatea el coste de una reparación externa según la convención monetaria española.
 * Retorna cadena vacía si el valor no está definido.
 */
export function formatExternalRepairCost(cost?: number): string {
  if (cost === undefined || cost === null) return "";
  return cost.toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
  });
}

/**
 * Determina el texto del distintivo para la reparación externa según el estado de la incidencia.
 */
export function getExternalRepairBadge(status: string): {
  label: string;
  isUnderRepair: boolean;
} {
  const isUnderRepair = status === "externalRepair";
  return {
    label: isUnderRepair ? "En curso en el SAT externo" : "Retornada al taller",
    isUnderRepair,
  };
}

/**
 * Resuelve y formatea los datos de contacto con el SAT externo.
 */
export function formatSatContact(
  contactName?: string | null,
  contactPhone?: string | null,
): { name?: string; phone?: string; fullText: string } | null {
  const name = contactName?.trim() || undefined;
  const phone = contactPhone?.trim() || undefined;

  if (!name && !phone) return null;

  let fullText = "";
  if (name && phone) {
    fullText = `${name} (${phone})`;
  } else {
    fullText = name ?? phone ?? "";
  }

  return { name, phone, fullText };
}

/**
 * Resuelve la etiqueta y número de serie del equipo vinculado o indica su falta de inventariado.
 */
export function getEquipmentInventoryInfo(linkedEquipment: EquipmentDoc | null): {
  isLinked: boolean;
  label: string;
  serialNumber?: string;
} {
  if (!linkedEquipment) {
    return {
      isLinked: false,
      label: "Equipo no inventariado",
    };
  }

  return {
    isLinked: true,
    label: equipmentLabel(linkedEquipment),
    serialNumber: linkedEquipment.serialNumber || undefined,
  };
}
