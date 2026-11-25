import { useMemo, useState } from "react";
import { ExternalLink, Search, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { AiResultTable } from "@/lib/ai/types";
import { dispatchAiOpenReference } from "@/lib/aiBridge";
import { cn } from "@/lib/utils";

interface AiResultsDialogProps {
  tables: AiResultTable[] | null;
  onClose: () => void;
}

/**
 * Visor amplio en la ventana principal para mostrar los listados estructurados
 * devueltos por el asistente IA sin comprimirlos dentro del chat lateral.
 */
export function AiResultsDialog({ tables, onClose }: AiResultsDialogProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [search, setSearch] = useState("");

  const safeTables = tables ?? [];
  const current = safeTables[activeIndex] ?? safeTables[0] ?? null;

  const filteredRows = useMemo(() => {
    if (!current) return [];
    const q = search.trim().toLowerCase();
    if (!q) return current.rows;
    return current.rows.filter((row) =>
      Object.values(row.cells).some((v) => v.toLowerCase().includes(q)),
    );
  }, [current, search]);

  if (!current) return null;

  const handleOpenRow = (row: AiResultTable["rows"][number]) => {
    const ref = row.ref ?? Object.values(row.cells)[0];
    if (!ref || ref === "—") return;
    dispatchAiOpenReference({
      reference: ref,
      kind: current.kind,
      id: row.id,
    });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[85dvh] flex-col overflow-hidden sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Table2 className="size-4 text-primary" />
            Resultados del asistente IA
          </DialogTitle>
          <DialogDescription>
            Pulsa sobre cualquier fila para abrir su ficha o módulo en la ventana
            principal.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-2">
          {safeTables.length > 1 ? (
            <div className="flex flex-wrap gap-1">
              {safeTables.map((t, idx) => (
                <Button
                  key={`${t.kind}-${idx}`}
                  type="button"
                  size="sm"
                  variant={idx === activeIndex ? "default" : "outline"}
                  onClick={() => {
                    setActiveIndex(idx);
                    setSearch("");
                  }}
                >
                  {t.title}
                </Button>
              ))}
            </div>
          ) : (
            <span className="text-sm font-medium">{current.title}</span>
          )}

          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrar resultados..."
              className="pl-8"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border/70">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-muted/90 backdrop-blur-sm">
              <tr>
                {current.columns.map((col) => (
                  <th
                    key={col.key}
                    className="border-b px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {col.label}
                  </th>
                ))}
                <th className="border-b px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Acción
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={current.columns.length + 1}
                    className="px-3 py-6 text-center text-xs text-muted-foreground"
                  >
                    Sin coincidencias para «{search}».
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, rIdx) => {
                  const canOpen = Boolean(row.ref && row.ref !== "—");
                  return (
                    <tr
                      key={`${row.ref ?? "row"}-${rIdx}`}
                      onClick={() => canOpen && handleOpenRow(row)}
                      className={cn(
                        "transition-colors",
                        canOpen
                          ? "cursor-pointer hover:bg-muted/50"
                          : "hover:bg-muted/20",
                      )}
                    >
                      {current.columns.map((col, cIdx) => (
                        <td
                          key={col.key}
                          className={cn(
                            "px-3 py-2 align-top text-xs",
                            cIdx === 0 && "font-mono font-medium",
                          )}
                        >
                          {row.cells[col.key] ?? "—"}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right">
                        {canOpen && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 gap-1 px-2 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenRow(row);
                            }}
                          >
                            Abrir
                            <ExternalLink className="size-3" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
