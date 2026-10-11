/**
 * Aviso de trabajo sin constancia: qué se da por visto y cuándo vuelve a salir.
 *
 * El aviso del panel señala lo que lleva días en curso sin que su técnico anote
 * nada. Cerrarlo no debe silenciar el trabajo parado para siempre: lo que cada
 * persona cierra se recuerda aquí —las incidencias avisadas y con qué margen—,
 * de forma que el aviso solo vuelve a salir cuando aparece trabajo parado que
 * esa persona todavía no había visto, o cuando cambia el margen y lo avisado ya
 * no significa lo mismo. La regla vive fuera del componente para poder probarla
 * sin navegador.
 */

/** Dónde se recuerda lo cerrado (mismo prefijo que el resto de la interfaz). */
export const WORK_ALERT_STORAGE_KEY = "pulso:work-alert-dismissed";

/** Tipo mínimo de almacenamiento: sirve `localStorage` y un doble en los tests. */
export interface AlertStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Lo que alguien dio por visto: el margen vigente y las incidencias avisadas. */
export interface WorkAlertDismissal {
  marginDays: number;
  references: string[];
}

/** Referencias limpias: sin repetidos, sin espacios de más y ordenadas. */
function cleanReferences(references: readonly string[]): string[] {
  const clean = references
    .map((reference) => reference.trim())
    .filter((reference) => reference !== "");
  return [...new Set(clean)].sort((a, b) => a.localeCompare(b, "es"));
}

/** Lo que se guarda al cerrar el aviso, tal y como estaba en ese momento. */
export function dismissalOf(
  references: readonly string[],
  marginDays: number,
): WorkAlertDismissal {
  return { marginDays, references: cleanReferences(references) };
}

/**
 * Lo que esa persona cerró, o null si no hay nada guardado o lo guardado no se
 * entiende (un valor raro no debe esconder el aviso).
 */
export function readDismissal(
  storage: AlertStorage | null,
): WorkAlertDismissal | null {
  const raw = storage?.getItem(WORK_ALERT_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const { marginDays, references } = parsed as {
      marginDays?: unknown;
      references?: unknown;
    };
    if (typeof marginDays !== "number" || !Number.isFinite(marginDays)) {
      return null;
    }
    if (
      !Array.isArray(references) ||
      !references.every((item) => typeof item === "string")
    ) {
      return null;
    }
    return { marginDays, references: cleanReferences(references) };
  } catch {
    return null;
  }
}

/** Recuerda lo cerrado; con null, lo olvida (el aviso vuelve a salir tal cual). */
export function writeDismissal(
  storage: AlertStorage | null,
  dismissal: WorkAlertDismissal | null,
): void {
  storage?.setItem(
    WORK_ALERT_STORAGE_KEY,
    dismissal === null ? "" : JSON.stringify(dismissal),
  );
}

/**
 * ¿Está el aviso cerrado para esta persona? Solo calla si lo avisado ahora ya
 * estaba avisado —y con el mismo margen—: en cuanto entra una incidencia parada
 * que no había visto, o cambia el margen, el aviso vuelve.
 */
export function isDismissed(
  dismissal: WorkAlertDismissal | null,
  references: readonly string[],
  marginDays: number,
): boolean {
  if (dismissal === null) return false;
  if (dismissal.marginDays !== marginDays) return false;
  const seen = new Set(dismissal.references);
  return cleanReferences(references).every((reference) => seen.has(reference));
}
