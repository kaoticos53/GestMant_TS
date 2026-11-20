import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import {
  AI_VARIABLE_CATALOG,
  type AiDebugTraceEntry,
  type WorkshopChatTurn,
} from "@/lib/ai";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/workshop";
import { useAction, useQuery } from "convex/react";
import {
  Bug,
  Database,
  Loader2,
  PanelRightClose,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { AiMarkdownMessage } from "./AiMarkdownMessage";

interface ChatEntry extends WorkshopChatTurn {
  id: string;
  citedReferences?: string[];
  usedTools?: string[];
  debugTrace?: AiDebugTraceEntry[];
}

const MIN_PANEL_WIDTH = 320;
const DEFAULT_PANEL_WIDTH = 420;
const MAX_PANEL_WIDTH = 760;

function clampPanelWidth(width: number): number {
  const viewportCap =
    typeof window !== "undefined"
      ? Math.max(MIN_PANEL_WIDTH, window.innerWidth - 32)
      : MAX_PANEL_WIDTH;
  const max = Math.min(MAX_PANEL_WIDTH, viewportCap);
  return Math.min(max, Math.max(MIN_PANEL_WIDTH, Math.round(width)));
}

const CHAT_VARIABLES = AI_VARIABLE_CATALOG.filter(
  (v) => v.scope === "chat" || v.scope === "ambos",
);

const SUGGESTIONS = [
  "¿Qué repuestos están bajo mínimo ahora mismo?",
  "Resume las incidencias abiertas y los equipos afectados",
  "¿Qué peticiones de repuesto u órdenes de compra están pendientes?",
  "¿Qué equipos tienen más incidencias registradas?",
];

export function WorkshopAiChatButton() {
  const availability = useQuery(api.ai.availability, {});
  const askWorkshop = useAction(api.ai.askWorkshop);

  const [open, setOpen] = useState(false);
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const [debugMode, setDebugMode] = useState(false);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const nextIdRef = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop =
        scrollContainerRef.current.scrollHeight;
    }
    if (typeof messagesEndRef.current?.scrollIntoView === "function") {
      messagesEndRef.current.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }
  }, [entries, loading, open]);

  const startResize = (startEvent: React.MouseEvent<HTMLDivElement>) => {
    startEvent.preventDefault();
    const onMove = (moveEvent: MouseEvent) => {
      const next = clampPanelWidth(window.innerWidth - moveEvent.clientX);
      setPanelWidth(next);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const chatEnabled =
    Boolean(availability?.available) &&
    (availability?.tasks?.workshopChat ?? true);

  if (!chatEnabled) {
    return null;
  }

  const insertChatVariable = (key: string) => {
    const token = `{{${key}}}`;
    setQuestion((prev) =>
      prev === "" || prev.endsWith(" ") || prev.endsWith("\n")
        ? `${prev}${token}`
        : `${prev} ${token}`,
    );
  };

  const sendQuestion = async (rawText?: string) => {
    const trimmed = (rawText ?? question).trim();
    if (!trimmed || loading) return;

    const history: WorkshopChatTurn[] = entries.map((e) => ({
      role: e.role,
      content: e.content,
    }));
    nextIdRef.current += 1;
    const userEntry: ChatEntry = {
      id: `u-${nextIdRef.current}`,
      role: "user",
      content: trimmed,
    };

    setEntries((prev) => [...prev, userEntry]);
    if (rawText === undefined) {
      setQuestion("");
    }
    setLoading(true);

    try {
      const result = await askWorkshop({
        question: trimmed,
        history,
        ...(debugMode ? { debug: true } : {}),
      });
      nextIdRef.current += 1;
      const assistantEntry: ChatEntry = {
        id: `a-${nextIdRef.current}`,
        role: "assistant",
        content: result.answer,
        citedReferences: result.citedReferences,
        usedTools: result.usedTools,
        debugTrace: result.debugTrace,
      };
      setEntries((prev) => [...prev, assistantEntry]);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant={open ? "secondary" : "ghost"}
        size="icon"
        aria-label="Asistente IA del taller"
        aria-expanded={open}
        title={open ? "Plegar asistente IA" : "Abrir asistente IA del taller"}
        className={cn(
          "size-8 shrink-0",
          open ? "text-primary" : "text-muted-foreground hover:text-primary",
        )}
        onClick={() => setOpen((prev) => !prev)}
      >
        <Sparkles className="size-4" />
      </Button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <aside
            aria-label="Asistente IA del taller"
            style={{ width: `${panelWidth}px` }}
            className="fixed inset-y-0 right-0 z-50 flex max-w-full flex-col border-l border-border bg-background shadow-2xl"
          >
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Redimensionar panel de IA"
              tabIndex={0}
              onMouseDown={startResize}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  setPanelWidth((prev) => clampPanelWidth(prev + 24));
                } else if (e.key === "ArrowRight") {
                  e.preventDefault();
                  setPanelWidth((prev) => clampPanelWidth(prev - 24));
                }
              }}
              className="absolute inset-y-0 left-0 z-10 w-1.5 cursor-col-resize transition-colors hover:bg-primary/40 focus:bg-primary/50 focus:outline-none"
            />
          <div className="flex items-start justify-between gap-2 border-b border-border/70 px-4 py-3.5">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="size-4 shrink-0 text-primary" />
                <span>Asistente IA del taller</span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Equipos, incidencias, repuestos, peticiones y compras.
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant={debugMode ? "secondary" : "ghost"}
                size="sm"
                aria-label="Modo depuración"
                aria-pressed={debugMode}
                title="Activar/desactivar traza de depuración"
                className={cn(
                  "h-8 px-2 text-xs",
                  debugMode ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
                )}
                onClick={() => setDebugMode((prev) => !prev)}
              >
                <Bug className="mr-1 size-3.5" />
                Debug
              </Button>
              {entries.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs text-muted-foreground"
                  onClick={() => setEntries([])}
                >
                  <Trash2 className="mr-1 size-3.5" />
                  Limpiar
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Plegar panel de IA"
                title="Plegar panel"
                className="size-8 text-muted-foreground"
                onClick={() => setOpen(false)}
              >
                <PanelRightClose className="size-4" />
              </Button>
            </div>
          </div>

          <div
            ref={scrollContainerRef}
            className="flex-1 space-y-3 overflow-y-auto bg-muted/15 p-4"
          >
            {entries.length === 0 ? (
              <div className="space-y-3 py-6 text-center">
                <p className="text-xs text-muted-foreground">
                  Escribe una pregunta o elige una consulta rápida:
                </p>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {SUGGESTIONS.map((item) => (
                    <Button
                      key={item}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-auto py-1.5 text-xs font-normal whitespace-normal"
                      disabled={loading}
                      onClick={() => void sendQuestion(item)}
                    >
                      {item}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              entries.map((entry) => (
                <div
                  key={entry.id}
                  className={cn(
                    "max-w-[90%] rounded-lg px-3.5 py-2.5 text-sm",
                    entry.role === "user"
                      ? "ml-auto bg-primary text-primary-foreground"
                      : "mr-auto border bg-background text-foreground",
                  )}
                >
                  {entry.role === "assistant" ? (
                    <AiMarkdownMessage content={entry.content} />
                  ) : (
                    <p className="whitespace-pre-wrap leading-relaxed">
                      {entry.content}
                    </p>
                  )}
                  {entry.usedTools && entry.usedTools.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1 border-t pt-2 text-[11px] text-muted-foreground">
                      <Database className="size-3 shrink-0" />
                      <span>Consultado:</span>
                      {entry.usedTools.map((tool) => (
                        <code
                          key={tool}
                          className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]"
                        >
                          {tool}
                        </code>
                      ))}
                    </div>
                  )}
                  {entry.citedReferences && entry.citedReferences.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1 border-t pt-2">
                      {entry.citedReferences.map((ref) => (
                        <Badge
                          key={ref}
                          variant="secondary"
                          className="font-mono text-[11px]"
                        >
                          {ref}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {entry.debugTrace && entry.debugTrace.length > 0 && (
                    <details className="mt-2 rounded border bg-muted/40 p-2 text-[11px]">
                      <summary className="cursor-pointer font-medium text-amber-700 dark:text-amber-300">
                        Traza de depuración ({entry.debugTrace.length}{" "}
                        {entry.debugTrace.length === 1 ? "ronda" : "rondas"})
                      </summary>
                      <div className="mt-2 space-y-2">
                        {entry.debugTrace.map((trace) => (
                          <div
                            key={trace.round}
                            className="space-y-1 rounded border bg-background p-2 font-mono text-[10px]"
                          >
                            <div className="font-semibold">
                              Ronda {trace.round} · {trace.model} · HTTP{" "}
                              {trace.responseStatus} · {trace.durationMs}ms ·{" "}
                              finish={trace.finishReason ?? "null"}
                            </div>
                            <div className="text-muted-foreground break-all">
                              Endpoint: {trace.endpoint} | Tools:{" "}
                              {trace.toolNames.join(", ") || "(ninguna)"}
                            </div>
                            <div>
                              <span className="font-semibold">Enviado:</span>
                              <pre className="mt-0.5 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/50 p-1.5">
                                {JSON.stringify(trace.messages, null, 2)}
                              </pre>
                            </div>
                            {trace.toolCalls && trace.toolCalls.length > 0 && (
                              <div>
                                <span className="font-semibold">
                                  Tool calls:
                                </span>
                                <pre className="mt-0.5 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/50 p-1.5">
                                  {JSON.stringify(trace.toolCalls, null, 2)}
                                </pre>
                              </div>
                            )}
                            <div>
                              <span className="font-semibold">
                                Respuesta cruda:
                              </span>
                              <pre className="mt-0.5 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/50 p-1.5">
                                {trace.rawContent || "(vacía)"}
                              </pre>
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              ))
            )}
            {loading && (
              <div className="mr-auto flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Consultando datos del taller...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-border/70 bg-background p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[11px] text-muted-foreground">
                Variables:
              </span>
              {CHAT_VARIABLES.map((item) => (
                <Button
                  key={item.key}
                  type="button"
                  size="sm"
                  variant="outline"
                  title={item.description}
                  className="h-5 px-1.5 font-mono text-[10px]"
                  onClick={() => insertChatVariable(item.key)}
                >
                  {`{{${item.key}}}`}
                </Button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void sendQuestion();
              }}
              className="flex items-end gap-2"
            >
            <Textarea
              id="workshop-ai-input"
              rows={2}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendQuestion();
                }
              }}
              placeholder="Pregunta sobre equipos, stock, incidencias, peticiones u órdenes..."
              disabled={loading}
              className="min-h-[56px] resize-none"
            />
            <Button
              type="submit"
              size="icon"
              aria-label="Enviar consulta"
              disabled={loading || !question.trim()}
              className="size-10 shrink-0"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </Button>
          </form>
          </div>
        </aside>,
          document.body,
        )}
    </>
  );
}
