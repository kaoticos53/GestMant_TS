import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { Eye, EyeOff, Inbox, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import {
  MAIL_ORIGIN_LABELS,
  MAIL_SANDBOX_LIMIT,
  type MailOrigin,
} from "@/lib/mail";
import { cn } from "@/lib/utils";
import { formatDateTime, getErrorMessage } from "@/lib/workshop";

export interface MailSandboxEntry {
  _id: string;
  at: number;
  what: string;
  origin: string;
  from: string;
  to: string[];
  bcc: string[];
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
  relatedId?: string;
}

export interface MailSandboxViewerProps {
  inbox?: MailSandboxEntry[];
}

export function MailSandboxViewer({ inbox }: MailSandboxViewerProps) {
  const clearInbox = useMutation(api.mailSandbox.clear);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"html" | "text">("html");
  const [clearing, setClearing] = useState(false);

  const filtered = useMemo(() => {
    if (!inbox) return [];
    const q = search.trim().toLowerCase();
    if (!q) return inbox;
    return inbox.filter((entry) =>
      [
        entry.subject,
        entry.from,
        ...entry.to,
        ...entry.bcc,
        entry.what,
        MAIL_ORIGIN_LABELS[entry.origin as MailOrigin] ?? entry.origin,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [inbox, search]);

  async function handleClear() {
    setClearing(true);
    try {
      const res = await clearInbox({});
      setExpandedId(null);
      toast.success(
        res.deleted === 0
          ? "El buzón interno ya estaba vacío."
          : res.deleted === 1
            ? "1 correo eliminado del buzón interno."
            : `${res.deleted} correos eliminados del buzón interno.`,
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-sky-500/35 bg-sky-500/5 px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Inbox className="size-4" />
            Buzón interno de pruebas
            {inbox !== undefined && (
              <span className="text-xs font-normal text-muted-foreground">
                ({inbox.length})
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            Correos interceptados y guardados en base de datos para depuración
            (hasta los últimos {MAIL_SANDBOX_LIMIT}). Ninguno sale a la red.
          </p>
        </div>
        {inbox && inbox.length > 0 && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void handleClear()}
            disabled={clearing}
            className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
            {clearing ? "Vaciando..." : "Vaciar buzón"}
          </Button>
        )}
      </div>

      {inbox === undefined ? (
        <Skeleton className="mt-2 h-16 rounded-lg" />
      ) : inbox.length === 0 ? (
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Todavía no hay correos guardados en el buzón interno. Activa este
          servicio, guarda los ajustes y envía un correo de prueba o dispara una
          notificación.
        </p>
      ) : (
        <>
          <div className="mt-2">
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filtrar por asunto, destinatario u origen..."
              className="h-8 text-xs"
            />
          </div>

          {filtered.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Ningún correo coincide con «{search.trim()}».
            </p>
          ) : (
            <ul className="mt-2 max-h-96 divide-y divide-border/60 overflow-y-auto pr-1">
              {filtered.map((entry) => {
                const isOpen = expandedId === entry._id;
                return (
                  <li key={entry._id} className="py-2 first:pt-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">
                          {entry.subject}
                        </p>
                        <p className="text-[11px] leading-5 text-muted-foreground">
                          {formatDateTime(entry.at)} ·{" "}
                          {MAIL_ORIGIN_LABELS[entry.origin as MailOrigin] ??
                            entry.what}{" "}
                          · Para: {entry.to.join(", ")}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setExpandedId(isOpen ? null : entry._id)
                        }
                        className="h-7 gap-1 px-2 text-xs"
                      >
                        {isOpen ? (
                          <>
                            <EyeOff className="size-3.5" />
                            Ocultar contenido
                          </>
                        ) : (
                          <>
                            <Eye className="size-3.5" />
                            Ver contenido
                          </>
                        )}
                      </Button>
                    </div>

                    {isOpen && (
                      <div className="mt-2 space-y-2 rounded-md border border-border/70 bg-background/80 p-2.5">
                        <div className="space-y-0.5 text-[11px] text-muted-foreground">
                          <p>
                            <span className="font-medium text-foreground">
                              De:
                            </span>{" "}
                            {entry.from}
                          </p>
                          <p>
                            <span className="font-medium text-foreground">
                              Para:
                            </span>{" "}
                            {entry.to.join(", ")}
                          </p>
                          {entry.bcc.length > 0 && (
                            <p>
                              <span className="font-medium text-foreground">
                                Copia oculta:
                              </span>{" "}
                              {entry.bcc.join(", ")}
                            </p>
                          )}
                          {entry.replyTo && (
                            <p>
                              <span className="font-medium text-foreground">
                                Responder a:
                              </span>{" "}
                              {entry.replyTo}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant={viewMode === "html" ? "secondary" : "ghost"}
                            onClick={() => setViewMode("html")}
                            className="h-6 px-2 text-[11px]"
                          >
                            HTML
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={viewMode === "text" ? "secondary" : "ghost"}
                            onClick={() => setViewMode("text")}
                            className="h-6 px-2 text-[11px]"
                          >
                            Texto plano
                          </Button>
                        </div>

                        {viewMode === "html" ? (
                          <iframe
                            sandbox=""
                            title={`Contenido HTML: ${entry.subject}`}
                            srcDoc={entry.html}
                            className={cn(
                              "h-56 w-full rounded border border-border/60 bg-white",
                            )}
                          />
                        ) : (
                          <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded border border-border/60 bg-muted/40 p-2.5 font-mono text-[11px] leading-relaxed">
                            {entry.text}
                          </pre>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
