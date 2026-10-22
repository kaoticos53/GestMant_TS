import type { Id } from "@/convex/_generated/dataModel";
import { richDocToPlainText } from "@/lib/richDoc";
import { useMemo } from "react";
import type { MessageSummaryItem, ThreadSummary } from "../types";

/**
 * Calcula el total de mensajes no leídos dirigidos al usuario actual.
 */
export function calculateUnreadTotal(
  items: readonly MessageSummaryItem[],
  currentUserId: string | undefined,
): number {
  if (!currentUserId) return 0;
  return items.filter(
    (message) => message.recipientId === currentUserId && !message.read,
  ).length;
}

/**
 * Agrupa los mensajes en una lista de hilos resumidos ordenados cronológicamente
 * según la primera aparición (asumiendo que los mensajes vienen ordenados descendentemente).
 */
export function calculateMessageThreads(
  items: readonly MessageSummaryItem[],
  currentUserId: string | undefined,
): ThreadSummary[] {
  if (!currentUserId) return [];
  const map = new Map<string, ThreadSummary>();

  for (const message of items) {
    const isMine = message.senderId === currentUserId;
    const otherId = isMine ? message.recipientId : message.senderId;
    const existing = map.get(otherId);

    if (existing) {
      if (!isMine && !message.read) {
        existing.unread += 1;
      }
      continue;
    }

    map.set(otherId, {
      userId: otherId as Id<"users">,
      name: isMine ? message.recipientName : message.senderName,
      preview: richDocToPlainText(message.text),
      at: message.createdAt,
      unread: !isMine && !message.read ? 1 : 0,
    });
  }

  return [...map.values()];
}

/**
 * Hook para procesar mensajes planos de Convex en resúmenes de hilos y contador global de no leídos.
 */
export function useMessageThreads(
  messages: readonly MessageSummaryItem[] | undefined,
  currentUserId: string | undefined,
) {
  const items = useMemo(() => messages ?? [], [messages]);

  const unreadTotal = useMemo(
    () => calculateUnreadTotal(items, currentUserId),
    [items, currentUserId],
  );

  const threads = useMemo(
    () => calculateMessageThreads(items, currentUserId),
    [items, currentUserId],
  );

  return {
    items,
    unreadTotal,
    threads,
  };
}
