import { Ban, Check, CirclePause, PackageCheck, Undo2, X } from "lucide-react";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { QueueSortOption } from "../QueueToolbar";

/** Adjunto con su URL ya resuelta desde el almacenamiento de Convex. */
export type RequestAttachment = {
  storageId: Id<"_storage">;
  name: string;
  kind: "image" | "document";
  url: string | null;
};

export type RequestDoc = Omit<Doc<"partRequests">, "attachments"> & {
  attachments: RequestAttachment[];
};

export type PartDoc = Doc<"spareParts">;
export type EquipmentDoc = Doc<"equipment">;
export type RequestStatusId = RequestDoc["status"];

/** Filtro de la cola: todos o un estado concreto (lo usan el menú y las tarjetas del resumen). */
export type RequestFilterId = "all" | RequestStatusId;

export const STATUS_RANK: Record<RequestStatusId, number> = {
  pending: 0,
  onHold: 1,
  pendingSupplierQuote: 2,
  materialReceived: 3,
  approved: 4,
  issued: 5,
  returned: 6,
  rejected: 7,
  cancelled: 8,
};

export const PRIORITY_RANK: Record<RequestDoc["priority"], number> = {
  urgent: 0,
  normal: 1,
  low: 2,
};

/** Órdenes disponibles cuando la cola es larga. */
export const SORT_OPTIONS: QueueSortOption[] = [
  { id: "recent", label: "Fecha: más recientes primero" },
  { id: "oldest", label: "Fecha: más antiguas primero" },
  { id: "queue", label: "Orden de trabajo: pendientes primero" },
];

export const FILTERS: { id: RequestFilterId; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "pending", label: "Pendientes" },
  { id: "approved", label: "Aprobadas" },
  { id: "issued", label: "Entregadas" },
  { id: "onHold", label: "En espera" },
  { id: "returned", label: "Devueltas" },
  { id: "rejected", label: "Rechazadas" },
  { id: "cancelled", label: "Canceladas" },
  { id: "pendingSupplierQuote", label: "Presupuesto pendiente" },
  { id: "materialReceived", label: "Material recibido" },
];

export type DecisionMode =
  "approve" | "reject" | "issue" | "hold" | "return" | "cancel";

export const DECISION_META: Record<
  DecisionMode,
  {
    title: string;
    label: string;
    placeholder: string;
    confirm: string;
    description?: string;
    success: (request: RequestDoc) => string;
  }
> = {
  approve: {
    title: "Aprobar petición",
    label: "Nota (opcional)",
    placeholder: "p. ej. material apartado en el mostrador 1",
    confirm: "Aprobar y descontar stock",
    success: (request) =>
      `${request.reference} aprobada: stock descontado del catálogo`,
  },
  reject: {
    title: "Rechazar petición",
    label: "Motivo del rechazo (opcional)",
    placeholder: "p. ej. pendiente de presupuesto del proveedor",
    confirm: "Rechazar petición",
    description:
      "La petición queda rechazada y el técnico verá el motivo. No se descuenta stock.",
    success: (request) => `${request.reference} rechazada`,
  },
  issue: {
    title: "Entregar material",
    label: "Nota de la entrega (opcional)",
    placeholder: "p. ej. entregado en mano a Marcos Vega",
    confirm: "Entregar",
    description:
      "El material sale del taller hacia el técnico que lo pidió. Se puede entregar todo de una vez o por tandas: lo que quede en cero sigue en el almacén y la petición no se da por entregada hasta que haya salido todo.",
    success: (request) => `${request.reference}: entrega apuntada`,
  },
  hold: {
    title: "Poner en espera",
    label: "Motivo de la espera (opcional)",
    placeholder: "p. ej. esperando confirmación del proveedor",
    confirm: "Poner en espera",
    description:
      "La petición sale del trabajo del día a día hasta que se resuelva: el material sigue apartado y se reanuda desde la ficha.",
    success: (request) => `${request.reference} en espera`,
  },
  return: {
    title: "Devolver material",
    label: "Motivo de la devolución (opcional)",
    placeholder: "p. ej. el repuesto no vale para ese modelo",
    confirm: "Devolver material",
    description:
      "El material vuelve del técnico al taller, sin entrar otra vez en el almacén: es el paso que deja la petición devuelta y la que permite reintegrar el stock o volver a decidir sobre ella.",
    success: (request) => `${request.reference} devuelta`,
  },
  cancel: {
    title: "Cancelar petición",
    label: "Motivo de la cancelación (opcional)",
    placeholder: "p. ej. el técnico ya no necesita el repuesto",
    confirm: "Cancelar petición",
    description:
      "La petición queda cancelada y el técnico verá el motivo. Es el final de la petición, no una espera: para retomarla habría que crear otra.",
    success: (request) => `${request.reference} cancelada`,
  },
};

export const DECISION_ICON: Record<DecisionMode, typeof Check> = {
  approve: Check,
  reject: X,
  issue: PackageCheck,
  hold: CirclePause,
  return: Undo2,
  cancel: Ban,
};
