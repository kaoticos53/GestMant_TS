import type { Id } from "@/convex/_generated/dataModel";

/**
 * Límite máximo de caracteres de texto que valida el servidor al enviar un mensaje.
 * El marcado o formato enriquecido (párrafos, marcas) no se computa sobre este límite.
 */
export const MAX_MESSAGE_TEXT = 1500;

/** Contacto del directorio de usuarios activos (excluyendo al usuario actual). */
export interface Contact {
  _id: Id<"users">;
  name: string;
  position: string | null;
  role: string | null;
}

/** Resumen de una conversación activa para la lista de hilos. */
export interface ThreadSummary {
  userId: Id<"users">;
  name: string;
  preview: string;
  at: number;
  unread: number;
}

/** Representación mínima de un mensaje para agrupar hilos. */
export interface MessageSummaryItem {
  _id: string;
  senderId: string;
  recipientId: string;
  senderName: string;
  recipientName: string;
  text: string;
  read: boolean;
  createdAt: number;
}

/** Identificador y nombre del hilo en curso. */
export interface ActiveThread {
  id: Id<"users">;
  name: string;
}
