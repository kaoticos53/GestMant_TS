import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { DESTINATION_LABELS } from "@/lib/mailShare";
import { formatDate, getErrorMessage } from "@/lib/workshop";
import { useAction, useMutation, useQuery } from "convex/react";
import { Download, Loader2, MailX, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/** Bytes en la unidad que se lee de un vistazo, sin decimales de más. */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Papelera administrativa de copias huérfanas.
 *
 * Un equipo o un manual se borra en el acto y no tiene papelera de módulo: su
 * copia de correo queda aquí siete días, visible solo para el administrador,
 * antes de que el barrido nocturno la purgue. No hay «restaurar»: la ficha ya
 * no existe y la copia no se puede volver a enganchar. Se puede descargar lo
 * que quede o adelantar la purga; el plazo es fijo y no depende del de la
 * papelera del taller.
 */
export function OrphanMailSharesCard() {
  const rows = useQuery(api.mailShares.listOrphaned);
  const purge = useMutation(api.mailShares.purgeOrphaned);
  const download = useAction(api.mailShares.downloadOrphaned);
  const [purging, setPurging] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = async (
    shareId: Id<"mailShares">,
    file: { kind: "eml" | "attachment"; index: number | null; name: string },
  ) => {
    const key = `${shareId}:${file.kind}:${file.index ?? ""}`;
    setDownloading(key);
    try {
      const result = await download({
        shareId,
        file: file.kind,
        ...(file.index === null ? {} : { index: file.index }),
      });
      const link = document.createElement("a");
      link.href = result.url;
      link.download = result.name || file.name;
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
    setPurging(shareId);
    try {
      await purge({ shareId });
      toast.success("Copia huérfana purgada.");
    } catch (reason) {
      toast.error(getErrorMessage(reason));
    } finally {
      setPurging(null);
    }
  };

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <MailX className="size-4 text-signal" />
            Copias de correo huérfanas
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Correos compartidos con equipos o manuales que ya se borraron.
            Esperan siete días antes de purgarse solos; puedes adelantarlo.
          </p>
        </div>
      </div>

      {rows === undefined ? (
        <p className="mt-3 text-xs text-muted-foreground">Cargando…</p>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          No hay copias huérfanas.
        </p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {rows.map((row) => (
            <li
              key={row.shareId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {row.subject || "(sin asunto)"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {DESTINATION_LABELS[row.destinationType]} ·{" "}
                  {row.destinationReference || "sin referencia"} ·{" "}
                  {row.fromAddress || row.fromName} · borrado el{" "}
                  {formatDate(row.deletedAt)} · se purga el{" "}
                  {formatDate(row.purgeAt)} · {formatSize(row.size)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {row.files.map((file) => {
                  const key = `${row.shareId}:${file.kind}:${file.index ?? ""}`;
                  return (
                    <Button
                      key={key}
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="max-w-48 gap-1.5"
                      disabled={downloading === key}
                      onClick={() => void handleDownload(row.shareId, file)}
                    >
                      {downloading === key ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Download className="size-4" />
                      )}
                      <span className="truncate">{file.name}</span>
                    </Button>
                  );
                })}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={purging === row.shareId}
                  onClick={() => void handlePurge(row.shareId)}
                >
                  {purging === row.shareId ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                  Purgar ahora
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
