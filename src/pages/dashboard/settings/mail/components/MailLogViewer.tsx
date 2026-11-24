import { useState } from "react";
import { useMutation } from "convex/react";
import { RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { MAIL_LOG_LIMIT, MAIL_ORIGIN_LABELS, type MailOrigin } from "@/lib/mail";
import {
  OUTBOX_STATUS_META,
  type MailOutboxStatus,
} from "@/lib/mailRetry";
import { cn } from "@/lib/utils";
import { formatDateTime, getErrorMessage } from "@/lib/workshop";

export interface MailLogEntry {
  _id: string;
  at: number;
  origin: string;
  what: string;
  ok: boolean;
  to: string[];
  bcc: string[];
  subject: string;
  error?: string;
}

export interface MailOutboxEntry {
  _id: Id<"mailOutbox">;
  origin: string;
  what: string;
  to: string[];
  subject: string;
  status: MailOutboxStatus;
  attempts: number;
  maxAttempts: number;
  nextRetryAt?: number;
  lastError?: string;
  lastAttemptAt: number;
  createdAt: number;
}

export interface MailLogViewerProps {
  history?: MailLogEntry[];
  outbox?: MailOutboxEntry[];
}

function MailOutboxQueue({ outbox }: { outbox: MailOutboxEntry[] }) {
  const retryOne = useMutation(api.mailOutbox.retryOne);
  const retryAllFailed = useMutation(api.mailOutbox.retryAllFailed);
  const discard = useMutation(api.mailOutbox.discard);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [retryingAll, setRetryingAll] = useState(false);

  const failedCount = outbox.filter((item) => item.status === "failed").length;

  async function handleRetryOne(outboxId: Id<"mailOutbox">) {
    setBusyId(outboxId);
    try {
      await retryOne({ outboxId });
      toast.success("Reintento programado.");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function handleRetryAll() {
    setRetryingAll(true);
    try {
      const res = await retryAllFailed({});
      toast.success(
        res.scheduled === 1
          ? "1 correo fallido encolado para reintento."
          : `${res.scheduled} correos fallidos encolados para reintento.`,
      );
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setRetryingAll(false);
    }
  }

  async function handleDiscard(outboxId: Id<"mailOutbox">) {
    setBusyId(outboxId);
    try {
      await discard({ outboxId });
      toast.success("Envío descartado de la cola.");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-amber-500/35 bg-amber-500/5 px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">
            Cola de reintentos y fallidos ({outbox.length})
          </p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            Los fallos temporales se reintentan automáticamente (1 min, 5 min y
            30 min). Si se agotan, puedes reenviarlos o descartarlos aquí.
          </p>
        </div>
        {failedCount > 1 && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void handleRetryAll()}
            disabled={retryingAll}
            className="gap-1.5"
          >
            <RotateCcw className="size-3.5" />
            {retryingAll ? "Reintentando..." : "Reintentar todos"}
          </Button>
        )}
      </div>

      <ul className="mt-2 max-h-64 divide-y divide-border/60 overflow-y-auto pr-1">
        {outbox.map((entry) => {
          const meta = OUTBOX_STATUS_META[entry.status];
          const busy = busyId === entry._id || retryingAll;
          return (
            <li key={entry._id} className="py-2 first:pt-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-medium">
                    {MAIL_ORIGIN_LABELS[entry.origin as MailOrigin] ??
                      entry.what}
                  </p>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                      meta.badgeClassName,
                    )}
                  >
                    {meta.label} · {entry.attempts}/{entry.maxAttempts}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void handleRetryOne(entry._id)}
                    disabled={busy}
                    className="h-7 gap-1 px-2 text-xs"
                  >
                    <RotateCcw className="size-3" />
                    Reintentar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => void handleDiscard(entry._id)}
                    disabled={busy}
                    className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3" />
                    Descartar
                  </Button>
                </div>
              </div>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                Para: {entry.to.join(", ")} · {entry.subject}
              </p>
              {entry.nextRetryAt !== undefined &&
                entry.status === "retrying" && (
                  <p className="text-[11px] text-muted-foreground">
                    Próximo intento: {formatDateTime(entry.nextRetryAt)}
                  </p>
                )}
              {entry.lastError && (
                <p className="mt-0.5 text-xs leading-5 text-destructive">
                  {entry.lastError}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function MailLogViewer({ history, outbox }: MailLogViewerProps) {
  return (
    <>
      {outbox && outbox.length > 0 && <MailOutboxQueue outbox={outbox} />}

      <div className="mt-4 rounded-lg border border-border/70 px-3 py-3">
        <p className="text-sm font-medium">Últimos envíos</p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
          Qué salió, a quién y qué contestó el servicio. Se conservan los
          últimos {MAIL_LOG_LIMIT}; el contenido de cada correo no se guarda
          aquí, solo el sobre.
        </p>
        {history === undefined ? (
          <Skeleton className="mt-2 h-16 rounded-lg" />
        ) : history.length === 0 ? (
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Todavía no ha salido ningún correo.
          </p>
        ) : (
          <ul className="mt-2 max-h-72 divide-y divide-border/60 overflow-y-auto pr-1">
            {history.map((entry) => (
              <li key={entry._id} className="py-2 first:pt-0">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <p className="text-xs font-medium">
                    {MAIL_ORIGIN_LABELS[entry.origin as MailOrigin] ??
                      entry.what}
                  </p>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                      entry.ok
                        ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                        : "border-destructive/40 text-destructive",
                    )}
                  >
                    {entry.ok ? "Salió" : "No salió"}
                  </span>
                </div>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                  {formatDateTime(entry.at)} · Para: {entry.to.join(", ")}
                  {entry.bcc.length > 0
                    ? ` · Copia oculta: ${entry.bcc.join(", ")}`
                    : ""}
                </p>
                <p className="text-xs leading-5 text-muted-foreground">
                  {entry.subject}
                </p>
                {!entry.ok && (
                  <p className="mt-0.5 text-xs leading-5 text-destructive">
                    {entry.error ?? "El servicio no dijo por qué."}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
