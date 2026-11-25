import type { RefObject } from "react";
import { Database, ExternalLink, Loader2, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  AiDebugTraceEntry,
  AiResultTable,
  WorkshopChatTurn,
} from "@/lib/ai";
import { dispatchAiOpenReference, dispatchAiShowTables } from "@/lib/aiBridge";
import { cn } from "@/lib/utils";
import { AiMarkdownMessage } from "./AiMarkdownMessage";

export interface AiChatEntry extends WorkshopChatTurn {
  id: string;
  citedReferences?: string[];
  usedTools?: string[];
  tables?: AiResultTable[];
  debugTrace?: AiDebugTraceEntry[];
}

export interface AiChatMessagesListProps {
  entries: AiChatEntry[];
  loading: boolean;
  suggestions: readonly string[];
  onSelectSuggestion: (text: string) => void;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  messagesEndRef: RefObject<HTMLDivElement | null>;
}

export function AiChatMessagesList({
  entries,
  loading,
  suggestions,
  onSelectSuggestion,
  scrollContainerRef,
  messagesEndRef,
}: AiChatMessagesListProps) {
  return (
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
            {suggestions.map((item) => (
              <Button
                key={item}
                type="button"
                variant="outline"
                size="sm"
                className="h-auto whitespace-normal py-1.5 text-xs font-normal"
                disabled={loading}
                onClick={() => onSelectSuggestion(item)}
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
            {entry.tables && entry.tables.length > 0 && (
              <div className="mt-2 border-t pt-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => dispatchAiShowTables(entry.tables!)}
                >
                  <Table2 className="size-3.5 text-primary" />
                  Ver tabla en ventana principal (
                  {entry.tables.reduce((acc, t) => acc + t.rows.length, 0)})
                </Button>
              </div>
            )}
            {entry.citedReferences && entry.citedReferences.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1 border-t pt-2">
                {entry.citedReferences.map((ref) => (
                  <button
                    key={ref}
                    type="button"
                    title="Abrir en la ventana principal"
                    onClick={() => dispatchAiOpenReference({ reference: ref })}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-2 py-0.5 font-mono text-[11px] font-medium text-secondary-foreground transition-colors hover:border-primary/50 hover:bg-primary/10"
                  >
                    {ref}
                    <ExternalLink className="size-2.5 opacity-70" />
                  </button>
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
                        {trace.responseStatus} · {trace.durationMs}ms · finish=
                        {trace.finishReason ?? "null"}
                      </div>
                      <div className="break-all text-muted-foreground">
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
                          <span className="font-semibold">Tool calls:</span>
                          <pre className="mt-0.5 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/50 p-1.5">
                            {JSON.stringify(trace.toolCalls, null, 2)}
                          </pre>
                        </div>
                      )}
                      <div>
                        <span className="font-semibold">Respuesta cruda:</span>
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
  );
}
