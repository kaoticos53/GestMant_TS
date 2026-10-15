import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RichText } from "@/components/RichText";
import {
  MANUAL_KIND_META,
  canDeleteManual,
  canEditManual,
  manualFileName,
} from "@/lib/manuals";
import { Download, Eye, Pencil, Trash2 } from "lucide-react";
import type { ManualRowProps } from "../types";

export function ManualRow({
  manual,
  assigned,
  rights,
  onView,
  onEdit,
  onDelete,
}: ManualRowProps) {
  const meta = MANUAL_KIND_META[manual.kind];
  return (
    <li className="py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className={meta.badgeClassName}>
              {meta.label}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {manual.type} · {assigned ? "de este equipo" : "del modelo"}
            </span>
          </div>
          <p className="mt-1 text-sm font-medium">{manual.title}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={`Abrir la ficha de ${manual.title}`}
            title="Ver la ficha del manual"
            onClick={() => onView(manual)}
          >
            <Eye className="size-4" />
          </Button>
          {manual.kind === "file" && manual.url && (
            <Button asChild variant="ghost" size="icon" className="size-8">
              <a
                href={manual.url}
                target="_blank"
                rel="noreferrer"
                aria-label={`Abrir ${manual.title}`}
                title={`Abrir o descargar ${manualFileName(manual) ?? "el archivo"}`}
              >
                <Download className="size-4" />
              </a>
            </Button>
          )}
          {canEditManual(manual, rights) && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={`Editar ${manual.title}`}
              title="Corregir el manual"
              onClick={() => onEdit(manual)}
            >
              <Pencil className="size-4" />
            </Button>
          )}
          {canDeleteManual(manual, rights) && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-destructive"
              aria-label={`Borrar ${manual.title}`}
              title="Retirar el manual"
              onClick={() => onDelete(manual)}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </div>
      {manual.notes && (
        <details className="mt-1.5">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
            Ver la nota del taller
          </summary>
          <RichText value={manual.notes} className="mt-1 text-xs leading-5" />
        </details>
      )}
    </li>
  );
}
