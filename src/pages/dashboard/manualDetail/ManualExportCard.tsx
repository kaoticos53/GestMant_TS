import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import type { ManualExportCardProps } from "./types";

export function ManualExportCard({ exporting, onExport }: ManualExportCardProps) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <FileDown className="size-3.5" />
        Documento
      </p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        La ficha con su clasificación, sus versiones anteriores y su historial de
        cambios, en un PDF para adjuntar o imprimir.
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-3 gap-1.5"
        disabled={exporting}
        onClick={onExport}
      >
        <FileDown className="size-4" />
        {exporting ? "Preparando..." : "Exportar ficha en PDF"}
      </Button>
    </div>
  );
}
