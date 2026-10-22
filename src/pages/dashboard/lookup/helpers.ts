import type { PendingPart } from "@/lib/incidentTracking";

/**
 * Mensaje explicativo cuando el usuario escribe letras confusas (0/O, 1/I).
 */
export function confusableNote(chars: string): string {
  const quoted = [...chars].map((char) => `«${char}»`);
  const list =
    quoted.length === 1
      ? `la ${quoted[0]}`
      : `${quoted.slice(0, -1).join(", ")} o ${quoted[quoted.length - 1]}`;
  return quoted.length === 1
    ? `Un código no lleva la ${quoted[0]}: se confunde con el cero o el uno, y por eso se deja fuera. Comprueba lo que has copiado.`
    : `Un código no lleva ${list}: se confunden con el cero o el uno, y por eso se dejan fuera. Comprueba lo que has copiado.`;
}

/** Título formateado con el tipo de equipo y modelo. */
export function getTrackingEquipmentTitle(tracking: {
  equipmentKind?: string | null;
  model?: string | null;
}): string {
  return (
    [tracking.equipmentKind, tracking.model].filter(Boolean).join(" · ") ||
    "Equipo sin identificar"
  );
}

/** Obtiene la fecha desde la que el caso está en su estado actual (si no está cerrado y hay más de 1 paso). */
export function getTrackingCurrentSince(tracking: {
  closedAt: number | null;
  history: readonly { at: number }[];
}): number | null {
  return tracking.closedAt === null && tracking.history.length > 1
    ? tracking.history[tracking.history.length - 1].at
    : null;
}

/**
 * Extrae los repuestos pendientes del seguimiento.
 * Un caso cerrado ya no espera repuestos, por lo que retorna array vacío.
 */
export function getTrackingMissingParts(tracking: {
  closedAt: number | null;
  pendingParts?: PendingPart[] | null;
}): PendingPart[] {
  return tracking.closedAt === null ? tracking.pendingParts ?? [] : [];
}
