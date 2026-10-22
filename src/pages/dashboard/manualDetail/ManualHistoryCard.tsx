import { Button } from "@/components/ui/button";
import { manualChangeSummary, manualHistory } from "@/lib/manuals";
import { formatDate, formatFileSize } from "@/lib/workshop";
import { Download, History } from "lucide-react";
import type { ManualHistoryCardProps } from "./types";

export function ManualHistoryCard({ manual }: ManualHistoryCardProps) {
  if (manual.history.length === 0) return null;

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <History className="size-3.5" />
        Historial de cambios
      </p>
      <ol className="mt-3 grid gap-3">
        {manualHistory(manual).map((entry, index) => (
          <li key={index} className="flex gap-3">
            <span
              className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/40"
              aria-hidden
            />
            <div className="min-w-0">
              <p className="text-sm leading-5">
                {manualChangeSummary(entry, manual.kind)}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDate(entry.at)}
                {entry.by ? ` · ${entry.by}` : ""}
              </p>
              {entry.file && (
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {entry.url ? (
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                    >
                      <a href={entry.url} target="_blank" rel="noreferrer">
                        <Download className="size-3.5" />
                        Versión anterior: {entry.file.fileName}
                      </a>
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Versión anterior: {entry.file.fileName} (ya no está en el
                      almacén)
                    </span>
                  )}
                  {entry.file.size > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {formatFileSize(entry.file.size)}
                    </span>
                  )}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
