import { History, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { describeBlockCounts } from "@/lib/richDocDiff";
import { describeDiff } from "@/lib/textDiff";
import {
  formatDateTime,
  noteRestoration,
  noteVersionChanges,
} from "@/lib/workshop";

export function NoteHistory({
  entry,
  onRestore,
  restoringVersion,
  canRestore = false,
}: {
  entry: {
    note: string;
    versions?: { note: string; at: number }[];
    restoredAt?: number;
    restoredBy?: string;
    restoredVersion?: number;
  };
  /** Devuelve la nota a esa versión del historial (por su posición). */
  onRestore?: (versionIndex: number) => void;
  /** Posición de la versión que se está restaurando ahora mismo, si hay alguna. */
  restoringVersion?: number | null;
  /** Solo su autor dentro del plazo puede restaurar: el backend lo comprueba igual. */
  canRestore?: boolean;
}) {
  const changes = noteVersionChanges(entry);
  const restoration = noteRestoration(entry);
  if (changes.length === 0) return null;
  return (
    <Collapsible className="mt-2">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <History className="size-3.5" />
          Historial de cambios ({changes.length})
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
          Comparado con lo que la sustituyó: en verde lo que se añadió, tachado
          lo que se quitó.
        </p>
        {restoration && (
          <p className="mt-1 rounded-md bg-muted/50 px-2 py-1 text-[11px] leading-5 text-muted-foreground">
            {`Restaurada por ${restoration.by} el ${formatDateTime(restoration.at)}`}
            {restoration.from !== null
              ? `: la nota volvió a la versión que se sustituyó el ${formatDateTime(
                  restoration.from,
                )}.`
              : "."}
          </p>
        )}
        <ul className="mt-2 space-y-2 border-l border-border/70 pl-3">
          {changes.map((change, index) => {
            const blocks = describeBlockCounts(change);
            return (
              <li key={`${change.at}-${index}`} className="text-xs">
                <p className="whitespace-pre-wrap leading-5 text-muted-foreground">
                  {change.parts.map((part, position) => {
                    const key = `${change.at}-${position}`;
                    if (part.kind === "added") {
                      return (
                        <ins
                          key={key}
                          className="rounded bg-emerald-600/15 px-0.5 text-emerald-700 no-underline"
                        >
                          {part.text}
                        </ins>
                      );
                    }
                    if (part.kind === "removed") {
                      return (
                        <del
                          key={key}
                          className="rounded bg-destructive/10 px-0.5 text-destructive line-through"
                        >
                          {part.text}
                        </del>
                      );
                    }
                    return <span key={key}>{part.text}</span>;
                  })}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Sustituida el {formatDateTime(change.at)} ·{" "}
                  {describeDiff({
                    added: change.added,
                    removed: change.removed,
                  })}
                  {blocks !== null ? ` · ${blocks}` : ""}
                  {restoration !== null && change.index === restoration.version
                    ? " · versión restaurada"
                    : ""}
                </p>
                {canRestore && onRestore && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-1 h-7 gap-1.5 px-2"
                    disabled={restoringVersion === change.index}
                    onClick={() => onRestore(change.index)}
                  >
                    <Undo2 className="size-3.5" />
                    {restoringVersion === change.index
                      ? "Restaurando…"
                      : "Volver a esta versión"}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
