/**
 * Dominio puro para ordenación y agrupación por conversaciones de cabeceras de correo.
 */

export type MailSortField = "date" | "sender" | "subject" | "attachments";
export type MailSortDirection = "asc" | "desc";

export const MAIL_SORT_LABELS: Record<MailSortField, string> = {
  date: "Fecha",
  sender: "Remitente",
  subject: "Asunto",
  attachments: "Con adjuntos",
};

export interface MailHeaderSortable {
  messageId: string;
  conversationId?: string | null;
  subject: string;
  fromName: string;
  fromAddress: string;
  date: number;
  flags: string;
  hasAttachments: boolean;
  tags?: string[];
}

function normalizedSortText(value: string): string {
  return value.trim().toLowerCase();
}

function senderKey(item: MailHeaderSortable): string {
  return normalizedSortText(item.fromName || item.fromAddress);
}

/**
 * Ordena una lista de cabeceras por fecha, remitente, asunto o presencia de adjuntos.
 */
export function sortMailHeaders<T extends MailHeaderSortable>(
  items: readonly T[],
  sortBy: MailSortField,
  sortDir: MailSortDirection,
): T[] {
  const factor = sortDir === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    let cmp = 0;
    if (sortBy === "date") {
      cmp = a.date - b.date;
    } else if (sortBy === "sender") {
      cmp = senderKey(a).localeCompare(senderKey(b), "es", {
        sensitivity: "base",
      });
    } else if (sortBy === "subject") {
      cmp = normalizedSortText(a.subject).localeCompare(
        normalizedSortText(b.subject),
        "es",
        { sensitivity: "base" },
      );
    } else if (sortBy === "attachments") {
      cmp = Number(a.hasAttachments) - Number(b.hasAttachments);
    }

    if (cmp !== 0) return cmp * factor;
    // Desempate determinista por fecha más reciente y messageId
    return b.date - a.date || a.messageId.localeCompare(b.messageId);
  });
}

export type GroupedMailHeader<T extends MailHeaderSortable> = T & {
  threadCount: number;
};

/**
 * Agrupa cabeceras que comparten `conversationId`, conservando el mensaje más
 * reciente como representante y agregando adjuntos, estado no leído y etiquetas.
 */
export function groupMailHeadersByConversation<T extends MailHeaderSortable>(
  items: readonly T[],
): Array<GroupedMailHeader<T>> {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const conv = item.conversationId?.trim();
    const key = conv && conv !== "" ? `conv:${conv}` : `msg:${item.messageId}`;
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(item);
    } else {
      groups.set(key, [item]);
    }
  }

  const result: Array<GroupedMailHeader<T>> = [];
  for (const bucket of groups.values()) {
    bucket.sort(
      (a, b) => b.date - a.date || a.messageId.localeCompare(b.messageId),
    );
    const newest = bucket[0]!;
    if (bucket.length === 1) {
      result.push({ ...newest, threadCount: 1 });
      continue;
    }

    const anyUnread = bucket.some((m) => m.flags.includes("u"));
    const anyAttachments = bucket.some((m) => m.hasAttachments);
    const mergedTags: string[] = [];
    for (const msg of bucket) {
      for (const tag of msg.tags ?? []) {
        if (!mergedTags.includes(tag)) {
          mergedTags.push(tag);
        }
      }
    }

    const flags =
      anyUnread && !newest.flags.includes("u")
        ? `${newest.flags}u`
        : newest.flags;

    result.push({
      ...newest,
      flags,
      hasAttachments: anyAttachments,
      tags: mergedTags.length > 0 ? mergedTags : newest.tags,
      threadCount: bucket.length,
    });
  }

  return result;
}

/**
 * Indica si el listado puede leerse en una sola pasada directa sobre el índice
 * ordenado por fecha (`by_user_folder_date`) sin clonar ni reordenar en RAM.
 */
export function canUseFastDateWindow(params: {
  search?: string;
  tag?: string;
  groupByConversation?: boolean;
  sortBy?: MailSortField;
  unreadOnly?: boolean;
  withAttachments?: boolean;
}): boolean {
  if ((params.search ?? "").trim() !== "") return false;
  if (params.tag) return false;
  if (params.groupByConversation) return false;
  if (params.unreadOnly || params.withAttachments) return false;
  return (params.sortBy ?? "date") === "date";
}
