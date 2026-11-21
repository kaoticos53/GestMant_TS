import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  formatDateTime,
  formatFileSize,
  getErrorMessage,
} from "@/lib/workshop";
import type { MailShareDestinationType } from "@/lib/mailShare";
import { HtmlFrame } from "@/pages/dashboard/mailbox/HtmlFrame";
import { useAction, useMutation, useQuery } from "convex/react";
import { Download, Loader2, Mail, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Las copias de correo compartidas con una ficha del expediente.
 *
 * No es la caché del buzón: se listan desde el destino, se abren con el mismo
 * visor saneado de 0017 y solo el administrador puede purgarlas. Si la ficha no
 * tiene copias, la sección no se pinta.
 */
export function SharedMailSection({
  destinationType,
  destinationId,
}: {
  destinationType: MailShareDestinationType;
  destinationId: string;
}) {
  const rows = useQuery(api.mailShares.listForDestination, {
    destinationType,
    destinationId,
  });
  const permissions = useQuery(api.permissions.myPermissions);
  const [selected, setSelected] = useState<Id<"mailShares"> | null>(null);
  const detail = useQuery(
    api.mailShares.get,
    selected === null ? "skip" : { shareId: selected },
  );
  const download = useAction(api.mailShares.downloadAttachment);
  const purge = useMutation(api.mailShares.purge);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [purging, setPurging] = useState(false);

  if (rows === undefined || rows.length === 0) return null;

  const isAdmin = permissions?.role === "admin";
  // Una sola lectura del estado del detalle: cargando, sin acceso, lápida o
  // copia viva. Antes se repetía la misma cadena de ternarios en título,
  // descripción y cuerpo.
  const state =
    detail === undefined
      ? "loading"
      : detail === null
        ? "missing"
        : detail.purgedAt !== null
          ? "purged"
          : "ready";
  const shown = state === "ready" ? detail : null;
  const shownMeta = shown
    ? `${shown.fromName || shown.fromAddress} · ${formatDateTime(shown.sentAt)} · ${shown.mode === "original" ? "original" : "resumen"} · compartido por ${shown.sharedByName}`
    : "";

  const handleDownload = async (
    shareId: Id<"mailShares">,
    index: number,
    name: string,
  ) => {
    setDownloading(index);
    try {
      const result = await download({ shareId, index });
      const link = document.createElement("a");
      link.href = result.url;
      link.download = result.name || name;
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

  const handlePurge = async (shareId: Id<"mailShares">) => {
    setPurging(true);
    try {
      await purge({ shareId });
      toast.success("Contenido de la copia retirado.");
    } catch (reason) {
      toast.error(getErrorMessage(reason));
    } finally {
      setPurging(false);
    }
  };

  return (
    <section className="space-y-2 rounded-lg border border-border/70 p-3">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold">
        <Mail className="size-4 text-muted-foreground" />
        Correos compartidos
        <span className="text-xs font-normal text-muted-foreground">
          ({rows.length})
        </span>
      </h3>
      <ul className="divide-y divide-border/60">
        {rows.map((row) => (
          <li key={row.id}>
            <button
              type="button"
              className="flex w-full items-start gap-2 py-2 text-left text-xs hover:bg-muted/40"
              onClick={() => setSelected(row.id)}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {row.purgedAt !== null
                    ? "Correo compartido retirado"
                    : row.subject || "(Sin asunto)"}
                </span>
                <span className="block truncate text-muted-foreground">
                  {row.purgedAt !== null
                    ? `Retirado el ${formatDateTime(row.purgedAt)}`
                    : `${row.fromName || row.fromAddress} · ${formatDateTime(row.sentAt)}`}
                </span>
              </span>
              <span className="shrink-0 text-muted-foreground">
                {row.mode === "original" ? "Original" : "Resumen"} ·{" "}
                {formatDateTime(row.sharedAt)}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <Dialog
        open={selected !== null}
        onOpenChange={(value) => {
          if (!value) setSelected(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {state === "loading"
                ? "Correo compartido"
                : state === "missing"
                  ? "Copia no disponible"
                  : state === "purged"
                    ? "Correo compartido retirado"
                    : shown?.subject || "(Sin asunto)"}
            </DialogTitle>
            <DialogDescription>
              {state === "loading"
                ? "Cargando la copia…"
                : state === "missing"
                  ? "Esta copia ya no existe o no tienes acceso a su ficha."
                  : state === "purged"
                    ? "Se conserva la constancia, no el contenido."
                    : shownMeta}
            </DialogDescription>
          </DialogHeader>

          {state === "loading" ? (
            <div
              className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-6 text-xs text-muted-foreground"
              role="status"
            >
              <Loader2 className="size-4 animate-spin" /> Cargando la copia…
            </div>
          ) : state === "missing" ? (
            <p className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              Esta copia ya no existe o tu rol ya no puede ver su ficha.
            </p>
          ) : state === "purged" || !detail ? (
            <p className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              El administrador retiró el contenido de esta copia. La ficha
              conserva la fecha y el motivo, pero no el asunto, el remitente ni
              el cuerpo.
            </p>
          ) : (
            <div className="space-y-3">
              {detail.mode === "summary" ? (
                <p className="rounded-lg border border-border/60 bg-muted/15 p-3 text-sm leading-6">
                  {detail.summary || "Sin extracto."}
                </p>
              ) : detail.bodyHtml !== null ? (
                <div className="h-[min(55dvh,32rem)]">
                  <HtmlFrame html={detail.bodyHtml} attachments={[]} />
                </div>
              ) : detail.bodyText ? (
                <pre className="max-h-[55dvh] overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-border/60 bg-muted/15 p-3 font-sans text-sm leading-6">
                  {detail.bodyText}
                </pre>
              ) : (
                <p className="text-xs text-muted-foreground">
                  La copia no guardó cuerpo legible.
                </p>
              )}

              {detail.bodyTruncated && (
                <p className="text-xs text-muted-foreground">
                  El cuerpo se recortó al guardar la copia.
                </p>
              )}

              {detail.attachments.length > 0 && (
                <div className="rounded-lg border border-border/60">
                  <p className="border-b border-border/60 px-3 py-2 text-xs font-medium">
                    Adjuntos
                  </p>
                  <ul className="divide-y divide-border/60">
                    {detail.attachments.map((attachment) => (
                      <li
                        key={attachment.index}
                        className="flex items-center gap-2 px-3 py-2 text-xs"
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {attachment.name}
                        </span>
                        <span className="shrink-0 text-muted-foreground">
                          {formatFileSize(attachment.size)}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="size-7 shrink-0 p-0"
                          disabled={downloading === attachment.index}
                          aria-label={`Descargar ${attachment.name}`}
                          onClick={() =>
                            void handleDownload(
                              detail.id,
                              attachment.index,
                              attachment.name,
                            )
                          }
                        >
                          {downloading === attachment.index ? (
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
          )}

          {isAdmin && detail && detail.purgedAt === null && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="justify-self-start gap-1.5"
              disabled={purging}
              onClick={() => void handlePurge(detail.id)}
            >
              {purging ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
              Retirar el contenido
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
