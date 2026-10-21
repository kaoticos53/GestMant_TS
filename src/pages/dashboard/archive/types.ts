import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { WithdrawnIncidentItem } from "@/convex/incidents";
import type { WithdrawnRequestItem } from "@/convex/partRequests";
import { AFTER_MONTHS_OPTIONS } from "@/lib/archive";
import type { QueueSortOption } from "../QueueToolbar";
import { Siren, ClipboardList } from "lucide-react";

import type { RequestDoc } from "../requests/types";

export type IncidentDoc = Doc<"incidents">;
export type { RequestDoc };

/** Qué se está mirando dentro del archivo. */
export type ArchiveKind = "all" | "incident" | "request";

/** Órdenes del archivo: la fecha de archivo es lo que lo ordena todo. */
export const SORT_OPTIONS: QueueSortOption[] = [
  { id: "recent", label: "Archivo: lo último archivado primero" },
  { id: "oldest", label: "Archivo: lo más antiguo primero" },
];

/** Antigüedades del selector de la limpieza a mano. */
export const CUTOFF_OPTIONS = AFTER_MONTHS_OPTIONS.map((option) => ({
  id: String(option.months),
  label: option.label,
}));

/**
 * Una fila del archivo: lo que se enseña y lo que se busca. Incidencias y
 * peticiones se unifican aquí para poder buscarlas de una vez («PET-0012» o
 * «cámara plató 2» da igual el módulo del que vengan).
 */
export interface ArchiveEntryBase {
  reference: string;
  title: string;
  subtitle: string;
  statusLabel: string;
  statusClassName: string;
  /** Cuándo se archivó (es lo que ordena y agrupa). */
  date: number;
  archivedBy?: string;
  fields: (string | number | undefined)[];
}

export type ArchiveEntry =
  | (ArchiveEntryBase & { kind: "incident"; id: Id<"incidents"> })
  | (ArchiveEntryBase & { kind: "request"; id: Id<"partRequests"> });

/**
 * La ficha abierta, solo por su tipo y su identificador: la fila entera ya
 * está cargada en el archivo, así que no hace falta guardarla. Así la misma
 * forma sirve para abrirla desde una fila y para abrirla desde fuera —el
 * buscador global—, que es lo que llega en `initialEntry`.
 */
export interface OpenArchivedDoc {
  kind: "incident" | "request";
  id: string;
}

export const KIND_META: Record<
  "incident" | "request",
  { label: string; icon: typeof Siren }
> = {
  incident: { label: "Incidencia", icon: Siren },
  request: { label: "Petición", icon: ClipboardList },
};

/**
 * Una ficha de la papelera. Incidencias y peticiones comparten la pantalla de
 * recuperación —y el plazo—, así que cada una lleva consigo de qué es, para
 * deshacerla o borrarla de verdad con la mutación que le toca.
 */
export type TrashRow =
  | { kind: "incident"; item: WithdrawnIncidentItem }
  | { kind: "request"; item: WithdrawnRequestItem };
