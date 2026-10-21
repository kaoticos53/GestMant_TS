import { MAIL_ORIGIN_LABELS, type MailOrigin } from "@/lib/mail";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/workshop";
import { Activity } from "lucide-react";

export interface MailPathStatusBannerProps {
  lastSend: {
    ok: boolean;
    at: number;
    origin?: string;
    what?: string;
    error?: string;
  } | null;
  lastSendFailed: boolean;
  pathFailed: boolean;
  pathCheckable: boolean;
  checkState: { ok: boolean; detail?: string; error?: string; at: number } | null;
  pathLine: string;
}

export function MailPathStatusBanner({
  lastSend,
  lastSendFailed,
  pathFailed,
  pathCheckable,
  checkState,
  pathLine,
}: MailPathStatusBannerProps) {
  return (
    <div
      aria-live="polite"
      className={cn(
        "mt-4 rounded-lg border px-3 py-2.5",
        lastSendFailed || pathFailed
          ? "border-destructive/50 bg-destructive/5"
          : "border-border/70",
      )}
    >
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <Activity className="size-4" /> Estado del camino de envío
      </p>
      <ul className="mt-1 grid gap-0.5 text-xs leading-5">
        <li
          className={cn(
            lastSendFailed
              ? "font-medium text-destructive"
              : "text-muted-foreground",
          )}
        >
          {lastSend === null
            ? "Último envío: todavía no ha salido ninguno."
            : lastSendFailed
              ? `Último envío: no salió el ${formatDateTime(lastSend.at)} (${
                  MAIL_ORIGIN_LABELS[lastSend.origin as MailOrigin] ??
                  lastSend.what
                }): ${lastSend.error ?? "el servicio no dijo por qué"}.`
              : `Último envío: salió el ${formatDateTime(lastSend.at)} (${
                  MAIL_ORIGIN_LABELS[lastSend.origin as MailOrigin] ??
                  lastSend.what
                }).`}
        </li>
        <li
          className={cn(
            pathFailed
              ? "font-medium text-destructive"
              : pathCheckable && checkState?.ok === true
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-muted-foreground",
          )}
        >
          {pathLine}
        </li>
      </ul>
      {lastSendFailed && (
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          El intento quedó apuntado en «Últimos envíos». La comprobación del
          camino se repite cada vez que se abre este panel; si ya está bien,
          manda una prueba para dejar constancia.
        </p>
      )}
    </div>
  );
}
