import { Download, Eye, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  MANUAL_KIND_META,
  canDeleteManual,
  canEditManual,
  manualFileName,
  type ManualRights,
} from "@/lib/manuals";
import { equipmentLabel, formatDate, formatFileSize } from "@/lib/workshop";
import type { EquipmentDoc, ManualDoc } from "../types";

export interface ManualsTableRowProps {
  manual: ManualDoc;
  linkedEquipment: EquipmentDoc | undefined;
  rights: ManualRights;
  onOpenDetail: (manual: ManualDoc) => void;
  onEdit: (manual: ManualDoc) => void;
  onDelete: (manual: ManualDoc) => void;
}

/**
 * Fila individual del catálogo de manuales con badges de tipo/forma,
 * columnas responsivas y botones de acción según permisos RBAC.
 */
export function ManualsTableRow({
  manual,
  linkedEquipment,
  rights,
  onOpenDetail,
  onEdit,
  onDelete,
}: ManualsTableRowProps) {
  const meta = MANUAL_KIND_META[manual.kind];

  return (
    <TableRow className="hover:bg-muted/40">
      <TableCell className="max-w-[20rem]">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge
            variant="outline"
            className={meta.badgeClassName}
          >
            {meta.label}
          </Badge>
          <span className="block truncate font-medium">
            {manual.title}
          </span>
        </div>
        <span className="block truncate text-xs text-muted-foreground">
          {manual.kind === "file"
            ? `${manualFileName(manual) ?? "Archivo"} · ${
                manual.size ? formatFileSize(manual.size) : "—"
              }`
            : manual.author
              ? `Nota de ${manual.author}`
              : "Nota del taller"}
        </span>
        <span className="block text-xs text-muted-foreground lg:hidden">
          {manual.type}
        </span>
      </TableCell>
      <TableCell className="hidden lg:table-cell text-muted-foreground">
        {manual.type}
      </TableCell>
      <TableCell className="hidden md:table-cell text-muted-foreground">
        {[manual.brand, manual.model].filter(Boolean).join(" · ") || "—"}
      </TableCell>
      <TableCell className="hidden xl:table-cell text-muted-foreground">
        {linkedEquipment ? equipmentLabel(linkedEquipment) : "—"}
      </TableCell>
      <TableCell className="hidden xl:table-cell text-muted-foreground">
        {formatDate(manual.updatedAt)}
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={`Abrir ${manual.title}`}
            onClick={() => onOpenDetail(manual)}
          >
            <Eye className="size-4" />
          </Button>

          {manual.kind === "file" && manual.url && (
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="size-8"
            >
              <a
                href={manual.url}
                target="_blank"
                rel="noreferrer"
                aria-label={`Descargar ${manual.title}`}
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
              onClick={() => onDelete(manual)}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
