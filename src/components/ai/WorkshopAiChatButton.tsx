import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import {
  AI_VARIABLE_CATALOG,
  type WorkshopChatTurn,
} from "@/lib/ai";
import { dispatchAiShowTables } from "@/lib/aiBridge";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/workshop";
import { useAction, useQuery } from "convex/react";
import {
  Bug,
  Loader2,
  PanelRightClose,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { AiChatMessagesList, type AiChatEntry } from "./AiChatMessagesList";

type ChatEntry = AiChatEntry;

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
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

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
        tables: result.tables,
        debugTrace: result.debugTrace,
      };
      setEntries((prev) => [...prev, assistantEntry]);
      if (result.tables && result.tables.length > 0) {
        dispatchAiShowTables(result.tables);
      }
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
              className="absolute inset-y-0 left-0 z-10 w-1.5 cursor-col-resize transition-colors hover:bg-primary/40 focus-visible:bg-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                Traza
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

          <AiChatMessagesList
            entries={entries}
            loading={loading}
            suggestions={SUGGESTIONS}
            onSelectSuggestion={(text) => void sendQuestion(text)}
            scrollContainerRef={scrollContainerRef}
            messagesEndRef={messagesEndRef}
          />

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
              aria-label="Consulta para el asistente de IA"
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
