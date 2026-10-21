import { Skeleton } from "@/components/ui/skeleton";
import { MAIL_LOG_LIMIT, MAIL_ORIGIN_LABELS, type MailOrigin } from "@/lib/mail";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/workshop";

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

export interface MailLogViewerProps {
  history?: MailLogEntry[];
}

export function MailLogViewer({ history }: MailLogViewerProps) {
  return (
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
                  {MAIL_ORIGIN_LABELS[entry.origin as MailOrigin] ?? entry.what}
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
  );
}
