import { Button } from "@/components/ui/button";
import {
  MANUAL_FILE_FORMAT,
  manualFileName,
} from "@/lib/manuals";
import { formatDate, formatFileSize } from "@/lib/workshop";
import { Download } from "lucide-react";
import type { ManualFileCardProps } from "./types";

export function ManualFileCard({ manual }: ManualFileCardProps) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Archivo
      </p>
      {manual.kind === "file" && manual.url ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {manualFileName(manual) ?? "Manual"}
            </p>
            <p className="text-xs text-muted-foreground">
              {MANUAL_FILE_FORMAT}
              {manual.size ? ` · ${formatFileSize(manual.size)}` : ""} ·
              subido el {formatDate(manual.createdAt)}
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <a href={manual.url} target="_blank" rel="noreferrer">
              <Download className="size-4" />
              Abrir o descargar
            </a>
          </Button>
        </div>
      ) : manual.kind === "file" ? (
        <p className="mt-2 rounded-lg border border-dashed border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          El archivo de este manual ya no está en el almacén del taller. Vuelve a
          subirlo desde «Editar».
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          Es una nota del taller: su contenido es el texto de abajo.
        </p>
      )}
    </div>
  );
}
