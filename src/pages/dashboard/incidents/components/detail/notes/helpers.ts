import {
  formatClockTime,
  formatDateTime,
  isNoteWithinEditWindow,
  noteEditDeadline,
  noteRestoration,
} from "@/lib/workshop";
import type { IncidentLifecycleNote } from "./types";

/**
 * Obtiene la fecha efectiva de escritura de una nota (createdAt o fallback at).
 */
export function getNoteWrittenAt(entry: {
  createdAt?: number;
  at: number;
}): number {
  return entry.createdAt ?? entry.at;
}

/**
 * Determina si el usuario autenticado tiene permiso temporal para editar una nota.
 */
export function canUserEditNote(
  entry: { createdAt?: number; at: number; authorId?: string | null },
  currentUserId: string | null,
): boolean {
  if (!currentUserId || !entry.authorId || entry.authorId !== currentUserId) {
    return false;
  }
  return isNoteWithinEditWindow(getNoteWrittenAt(entry));
}

/**
 * Formatea el sello temporal descriptivo de la nota (autor, fecha y corrección/restauración).
 */
export function formatNoteTimestamp(entry: IncidentLifecycleNote): string {
  const restoration = noteRestoration(entry);
  let extra = "";
  if (entry.editedAt) {
    if (restoration && restoration.at === entry.editedAt) {
      extra = ` · restaurada por ${restoration.by} el ${formatDateTime(
        restoration.at,
      )}`;
    } else {
      extra = ` · corregida ${formatDateTime(entry.editedAt)}`;
    }
  }
  return `${entry.author} · ${formatDateTime(entry.at)}${extra}`;
}

/**
 * Texto informativo con la hora límite para editar una nota.
 */
export function formatNoteEditDeadlineNotice(writtenAt: number): string {
  return `Se puede corregir hasta las ${formatClockTime(
    noteEditDeadline(writtenAt),
  )}`;
}

/**
 * Título del diálogo modal de creación o edición de nota.
 */
export function getNoteDialogTitle(isEditing: boolean): string {
  return isEditing ? "Corregir nota" : "Añadir nota";
}

/**
 * Descripción informativa para el diálogo modal de nota.
 */
export function getNoteDialogDescription(
  isEditing: boolean,
  reference: string,
): string {
  return isEditing
    ? `Corriges una nota de ${reference}. La fecha del hilo y el lugar que ocupa en el cuaderno no cambian.`
    : `Añade una nota a ${reference}. Queda registrada con tu nombre y la fecha actual.`;
}

/**
 * Texto del botón de confirmación en el formulario modal.
 */
export function getNoteSubmitLabel(
  saving: boolean,
  isEditing: boolean,
): string {
  if (saving) return "Guardando...";
  return isEditing ? "Guardar cambios" : "Añadir nota";
}
