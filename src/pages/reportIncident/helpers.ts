import { looksLikeEmail } from "@/lib/incidentMail";
import { richDocToPlainText, richDocToStore } from "@/lib/richDoc";
import type {
  ReportIncidentFormValues,
  ReportIncidentValidationResult,
} from "./types";

/** Timestamp → valor de <input type="date"> (AAAA-MM-DD en hora local). */
export function toDateInputValue(timestamp: number): string {
  const d = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Valor de <input type="date"> → timestamp (medianoche local). */
export function fromDateInputValue(value: string): number | undefined {
  return value ? new Date(`${value}T00:00:00`).getTime() : undefined;
}

/** Fecha de hoy como valor por defecto (AAAA-MM-DD). */
export function getTodayInputDate(): string {
  return toDateInputValue(Date.now());
}

/**
 * Valida los datos del formulario de reporte de incidencia y construye
 * el payload normalizado para la mutación pública si todo es válido.
 */
export function validateReportIncidentForm(
  values: ReportIncidentFormValues,
): ReportIncidentValidationResult {
  const timestamp = fromDateInputValue(values.reportedAt);

  if (!values.name.trim()) {
    return {
      isValid: false,
      error: "Indica tu nombre y apellidos.",
    };
  }

  // El correo es opcional, pero si se escribe tiene que servir para
  // responderle: más vale decirlo aquí, cuando se puede corregir, que
  // descubrirlo cuando el aviso ya no llega a nadie.
  const reporterEmail = values.email.trim().toLowerCase();
  if (reporterEmail && !looksLikeEmail(reporterEmail)) {
    return {
      isValid: false,
      error: "Ese correo no parece una dirección válida. Revísalo o déjalo en blanco.",
    };
  }

  // El texto que se lee, no las marcas del documento: con formato, un
  // párrafo vacío contaría como escrito.
  if (richDocToPlainText(values.description).trim().length < 10) {
    return {
      isValid: false,
      error: "Describe la incidencia con un poco más de detalle.",
    };
  }

  if (timestamp === undefined) {
    return {
      isValid: false,
      error: "Indica la fecha de notificación.",
    };
  }

  return {
    isValid: true,
    error: null,
    payload: {
      reporterName: values.name.trim(),
      reporterEmail: reporterEmail || undefined,
      reporterRole: values.role.trim() || undefined,
      location: values.location.trim() || undefined,
      equipmentKind: values.equipmentKind.trim() || undefined,
      model: values.model.trim() || undefined,
      serialNumber: values.serialNumber.trim() || undefined,
      description: richDocToStore(values.description) ?? "",
      reportedAt: timestamp,
    },
  };
}
