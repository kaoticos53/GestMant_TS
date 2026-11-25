import { ListArea } from "@/components/ListArea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useVirtualRows } from "@/hooks/use-virtual-rows";
import { MAIL_TAG_META, type MailTagId } from "@/lib/mailClient/tagging";
import { cn } from "@/lib/utils";
import {
  Loader2,
  MailOpen,
  MessagesSquare,
  Paperclip,
  RefreshCw,
  SearchX,
} from "lucide-react";
import { useCallback, useState } from "react";
import { formatMailDate, isUnread, senderLabel } from "./helpers";
import type { MailboxHeader } from "./types";

interface MessageListProps {
  headers: MailboxHeader[];
  folderName: string;
  folderRemoteId: string;
  page: number;
  search: string;
  syncing: boolean;
  selectedMessageId: string | null;
  onSelectMessage: (header: MailboxHeader) => void;
  onSync: () => void;
  onClearSearch: () => void;
}

/**
 * La lista de cabeceras de una carpeta. No pide ni pinta cuerpos: solo asunto,
 * remitente, fecha y fragmento; abrir el mensaje es cosa del visor.
 */
export function MessageList({
  headers,
  folderName,
  folderRemoteId,
  page,
  search,
  syncing,
  selectedMessageId,
  onSelectMessage,
  onSync,
  onClearSearch,
}: MessageListProps) {
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(
    null,
  );
  const attachArea = useCallback((node: HTMLDivElement | null) => {
    setScrollElement(node);
  }, []);
  const virtual = useVirtualRows({
    count: headers.length,
    scrollElement,
  });
  const searching = search.trim() !== "";

  if (headers.length === 0) {
    return (
      <ListArea
        resetKey={`${folderRemoteId}|${search}|${page}`}
        ref={attachArea}
        maxHeightClass="min-h-0 flex-1 max-h-none"
      >
        <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
          <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            {searching ? (
              <SearchX className="size-5" />
            ) : (
              <MailOpen className="size-5" />
            )}
          </span>
          <h3 className="mt-4 text-sm font-semibold">
            {searching
              ? "No hay mensajes que coincidan"
              : "Esta carpeta está vacía"}
          </h3>
          <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
            {searching
              ? `No encontramos «${search.trim()}» en el asunto ni en el remitente de ${folderName}.`
              : `Todavía no hay cabeceras guardadas en ${folderName}. Sincroniza el buzón para traerlas.`}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {searching && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClearSearch}
              >
                Limpiar búsqueda
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              className="gap-2"
              disabled={syncing}
              onClick={onSync}
            >
              {syncing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              {syncing ? "Sincronizando..." : "Sincronizar ahora"}
            </Button>
          </div>
        </div>
      </ListArea>
    );
  }

  return (
    <ListArea
      resetKey={`${folderRemoteId}|${search}|${page}`}
      ref={attachArea}
      maxHeightClass="min-h-0 flex-1 max-h-none"
    >
      <ul className="divide-y divide-border/60">
        {virtual.active && virtual.paddingTop > 0 && (
          <li aria-hidden style={{ height: virtual.paddingTop }} />
        )}
        {virtual.indices.map((index) => {
          const header = headers[index];
          if (!header) return null;
          const unread = isUnread(header.flags);
          const selected = header.messageId === selectedMessageId;
          return (
            <li
              key={header.messageId}
              data-index={index}
              ref={virtual.active ? virtual.measureElement : undefined}
              role="button"
              tabIndex={0}
              aria-current={selected ? "true" : undefined}
              aria-label={`Abrir ${header.subject || "mensaje sin asunto"}`}
              onClick={() => onSelectMessage(header)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectMessage(header);
                }
              }}
              className={cn(
                "group flex cursor-pointer gap-3 px-4 py-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal/60",
                unread && "bg-signal/[0.035]",
                selected && "bg-signal/10 hover:bg-signal/10",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "mt-2 size-2 shrink-0 rounded-full",
                  unread ? "bg-signal" : "bg-transparent",
                )}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p
                    className={cn(
                      "truncate text-sm text-foreground",
                      unread && "font-semibold",
                    )}
                    title={senderLabel(header.fromName, header.fromAddress)}
                  >
                    {senderLabel(header.fromName, header.fromAddress)}
                  </p>
                  <time
                    dateTime={new Date(header.date).toISOString()}
                    className="shrink-0 text-xs tabular-nums text-muted-foreground"
                    title={new Date(header.date).toLocaleString("es-ES")}
                  >
                    {formatMailDate(header.date)}
                  </time>
                </div>
                <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                  <p
                    className={cn(
                      "truncate text-sm",
                      unread
                        ? "font-medium text-foreground"
                        : "text-foreground/85",
                    )}
                    title={header.subject || "(Sin asunto)"}
                  >
                    {header.subject || "(Sin asunto)"}
                  </p>
                  {header.threadCount > 1 && (
                    <Badge
                      variant="secondary"
                      className="h-4 shrink-0 gap-1 px-1.5 text-[10px] tabular-nums"
                      title={`Conversación con ${header.threadCount} mensajes`}
                    >
                      <MessagesSquare className="size-2.5" />
                      {header.threadCount}
                    </Badge>
                  )}
                  {header.hasAttachments && (
                    <Paperclip
                      className="size-3.5 shrink-0 text-muted-foreground"
                      aria-label="Con adjuntos"
                    />
                  )}
                </div>
                {header.snippet.trim() !== "" && (
                  <p className="mt-0.5 line-clamp-1 text-xs leading-5 text-muted-foreground">
                    {header.snippet}
                  </p>
                )}
                {header.tags && header.tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {header.tags.map((tagId) => {
                      const meta = MAIL_TAG_META[tagId as MailTagId];
                      if (!meta) return null;
                      return (
                        <Badge
                          key={tagId}
                          variant="outline"
                          title={header.tagReason ?? meta.description}
                          className={cn("h-4 px-1.5 text-[10px]", meta.badgeClassName)}
                        >
                          {meta.label}
                        </Badge>
                      );
                    })}
                  </div>
                )}
                {unread && <span className="sr-only">Sin leer</span>}
              </div>
            </li>
          );
        })}
        {virtual.active && virtual.paddingBottom > 0 && (
          <li aria-hidden style={{ height: virtual.paddingBottom }} />
        )}
      </ul>
    </ListArea>
  );
}

/** Esqueleto de la lista mientras la consulta de cabeceras aún no ha llegado. */
export function MessageListSkeleton() {
  return (
    <div
      className="min-h-64 space-y-0 divide-y divide-border/60"
      role="status"
      aria-label="Cargando mensajes"
    >
      {[0, 1, 2, 3, 4, 5].map((row) => (
        <div key={row} className="flex gap-3 px-4 py-3">
          <span className="mt-2 size-2 shrink-0 rounded-full bg-muted" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex justify-between gap-3">
              <span className="h-3 w-1/3 animate-pulse rounded bg-muted" />
              <span className="h-3 w-12 animate-pulse rounded bg-muted/70" />
            </div>
            <span className="block h-3 w-2/3 animate-pulse rounded bg-muted/70" />
            <span className="block h-3 w-1/2 animate-pulse rounded bg-muted/50" />
          </div>
        </div>
      ))}
    </div>
  );
}
