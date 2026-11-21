import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import {
  formatDateTime,
  formatFileSize,
  getErrorMessage,
} from "@/lib/workshop";
import { useAction } from "convex/react";
import {
  AlertTriangle,
  ChevronLeft,
  Download,
  FileText,
  Loader2,
  MailOpen,
  Paperclip,
  RefreshCw,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { HtmlFrame } from "./HtmlFrame";
import { senderLabel } from "./helpers";
import type { MailboxHeader } from "./types";

type OpenedMessage = (typeof api.mailBody.open)["_returnType"];
type OpenedAttachment = OpenedMessage["attachments"][number];

type ViewMode = "html" | "text";

function attachmentName(attachment: OpenedAttachment): string {
  return attachment.filename?.trim() || "Adjunto sin nombre";
}

/**
 * El visor de un mensaje. No escribe nada en el buzón: abrir descarga y cachea,
 * pero no cambia leído, carpeta ni flags. El HTML va aislado en un iframe.
 */
export function MessageViewer({
  header,
  folderName,
  onClose,
  onOpenSettings,
}: {
  header: MailboxHeader;
  folderName: string;
  onClose: () => void;
  onOpenSettings: () => void;
}) {
  const openMessage = useAction(api.mailBody.open);
  const downloadAttachment = useAction(api.mailAttachments.download);
  const [opened, setOpened] = useState<OpenedMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [mode, setMode] = useState<ViewMode>("html");
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void openMessage({ messageId: header.messageId })
      .then((result) => {
        if (cancelled) return;
        setOpened(result);
        setMode(result.html === null ? "text" : "html");
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(getErrorMessage(reason));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [header.messageId, openMessage, attempt]);

  const handleRetry = () => {
    setOpened(null);
    setError(null);
    setLoading(true);
    setAttempt((value) => value + 1);
  };

  const handleDownload = async (attachment: OpenedAttachment) => {
    setDownloading(attachment.id);
    try {
      const result = await downloadAttachment({ attachmentId: attachment.id });
      const link = document.createElement("a");
      link.href = result.url;
      link.download = result.filename ?? attachmentName(attachment);
      link.rel = "noopener noreferrer";
      document.body.append(link);
      link.click();
      link.remove();
    } catch (reason) {
      toast.error(getErrorMessage(reason));
    } finally {
      setDownloading(null);
    }
  };

  const downloadable =
    opened?.attachments.filter((attachment) => attachment.filename !== null) ??
    [];

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-card">
      <header className="flex items-start gap-2 border-b border-border/70 px-3 py-2.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-0.5 size-8 shrink-0 p-0 lg:hidden"
          onClick={onClose}
          aria-label="Volver a la lista"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold" title={header.subject}>
            {header.subject || "(Sin asunto)"}
          </h2>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {senderLabel(header.fromName, header.fromAddress)} ·{" "}
            {formatDateTime(header.date)} · {folderName}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="size-8 shrink-0 p-0"
          onClick={onClose}
          aria-label="Cerrar mensaje"
        >
          <X className="size-4" />
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {loading ? (
          <ViewerSkeleton />
        ) : error ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center">
            <span className="flex size-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <AlertTriangle className="size-5" />
            </span>
            <h3 className="mt-4 text-sm font-semibold">
              No se pudo abrir el mensaje
            </h3>
            <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
              {error}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button
                type="button"
                size="sm"
                className="gap-2"
                onClick={handleRetry}
              >
                <RefreshCw className="size-4" /> Reintentar
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onOpenSettings}
              >
                Revisar cuenta
              </Button>
            </div>
          </div>
        ) : opened ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                {downloadable.length === 0
                  ? "Sin adjuntos"
                  : `${downloadable.length} ${
                      downloadable.length === 1 ? "adjunto" : "adjuntos"
                    }`}{" "}
                · {formatFileSize(header.size)}
              </span>
              {opened.html !== null && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() =>
                    setMode((value) => (value === "html" ? "text" : "html"))
                  }
                >
                  <FileText className="size-3.5" />
                  {mode === "html" ? "Ver texto" : "Ver HTML"}
                </Button>
              )}
            </div>

            {opened.htmlTruncated && mode === "html" && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                El HTML es muy grande y se recortó. Puedes leer la versión de
                texto.
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7"
                  onClick={() => setMode("text")}
                >
                  Ver texto
                </Button>
              </div>
            )}
            {opened.textTruncated && mode === "text" && (
              <p className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                El texto es muy grande y se recortó para guardarlo.
              </p>
            )}

            {mode === "html" && opened.html !== null ? (
              <div className="h-[min(60dvh,36rem)] min-h-[20rem]">
                <HtmlFrame
                  html={opened.html}
                  attachments={opened.attachments}
                />
              </div>
            ) : opened.text.trim() !== "" ? (
              <pre className="whitespace-pre-wrap break-words rounded-lg border border-border/60 bg-muted/15 p-3 font-sans text-sm leading-6 text-foreground">
                {opened.text}
              </pre>
            ) : (
              <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed border-border/70 px-4 text-center">
                <MailOpen className="size-5 text-muted-foreground" />
                <p className="mt-2 text-xs text-muted-foreground">
                  Este mensaje no trae cuerpo legible.
                </p>
              </div>
            )}

            {downloadable.length > 0 && (
              <div className="rounded-lg border border-border/60">
                <p className="flex items-center gap-1.5 border-b border-border/60 px-3 py-2 text-xs font-medium">
                  <Paperclip className="size-3.5" /> Adjuntos
                </p>
                <ul className="divide-y divide-border/60">
                  {downloadable.map((attachment) => (
                    <li
                      key={attachment.id}
                      className="flex items-center gap-2 px-3 py-2 text-xs"
                    >
                      <span
                        className="min-w-0 flex-1 truncate"
                        title={attachmentName(attachment)}
                      >
                        {attachmentName(attachment)}
                      </span>
                      <span className="shrink-0 text-muted-foreground">
                        {formatFileSize(attachment.size)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="size-7 shrink-0 p-0"
                        disabled={downloading === attachment.id}
                        onClick={() => void handleDownload(attachment)}
                        aria-label={`Descargar ${attachmentName(attachment)}`}
                      >
                        {downloading === attachment.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Download className="size-3.5" />
                        )}
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function MessageViewerPlaceholder() {
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center bg-card px-6 text-center">
      <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <MailOpen className="size-5" />
      </span>
      <h2 className="mt-4 text-sm font-semibold">Selecciona un mensaje</h2>
      <p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">
        El contenido se abrirá aquí sin marcar el mensaje como leído en el
        webmail.
      </p>
    </section>
  );
}

function ViewerSkeleton() {
  return (
    <div
      className={cn("space-y-3")}
      role="status"
      aria-label="Abriendo mensaje"
    >
      <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
      <div className="h-4 w-1/3 animate-pulse rounded bg-muted/70" />
      <div className="mt-6 h-64 animate-pulse rounded-lg bg-muted/60" />
    </div>
  );
}
