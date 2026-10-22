import type { FormEvent } from "react";
import type { api } from "@/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import type { PendingPart } from "@/lib/incidentTracking";
import type { IncidentStatus } from "@/lib/workshop";

/** Lo que devuelve el seguimiento: la ficha recortada del caso consultado. */
export type Tracking = NonNullable<
  FunctionReturnType<typeof api.incidents.byCode>
>;

/** Lo que dejó una consulta: el seguimiento —o su ausencia—, o el motivo del no. */
export type LookupOutcome =
  | { ok: true; tracking: Tracking | null }
  | { ok: false; error: string };

/** Props para el componente principal de consulta pública de incidencias. */
export interface IncidentLookupProps {
  className?: string;
  /** El código que trae la dirección, si viene. Se consulta al abrir. */
  initialCode?: string | null;
}

/** Props para el formulario de búsqueda de código. */
export interface LookupSearchFormProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

/** Props para los avisos y alertas de retroalimentación contextual. */
export interface LookupFeedbackAlertsProps {
  code: string | null;
  referenceTyped: boolean;
  confusables: string;
  tracking: Tracking | null | undefined;
  failure: string | null;
}

/** Props para la tarjeta de seguimiento del caso. */
export interface TrackingCardProps {
  tracking: Tracking;
  arrivedAt: number;
}

/** Props para la sección de repuestos pendientes. */
export interface TrackingPendingPartsProps {
  missingParts: PendingPart[];
  status: IncidentStatus;
  isClosed: boolean;
  arrivedAt: number;
  oldestPending: number | null;
}

/** Props para la lista de detalles y metadatos del caso. */
export interface TrackingDetailsListProps {
  tracking: Tracking;
}

/** Props para la línea temporal de estados históricos. */
export interface TrackingHistoryTimelineProps {
  history: Tracking["history"];
}
