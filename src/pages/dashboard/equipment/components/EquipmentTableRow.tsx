import { memo } from "react";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { equipmentLabel } from "@/lib/workshop";
import { BookOpen, Copy, Eye, Pencil, Trash2 } from "lucide-react";
import type { EquipmentDoc } from "../types";

interface EquipmentTableRowProps {
  item: EquipmentDoc;
  canManage: boolean;
  reviewOverdue: boolean;
  manualsCount: { assigned: number; byModel: number; total: number };
  compatibleCount: number;
  onViewDetail: (item: EquipmentDoc) => void;
  onDuplicate: (item: EquipmentDoc) => void;
  onEdit: (item: EquipmentDoc) => void;
  onDelete: (item: EquipmentDoc) => void;
}

/**
 * Fila memoizada de la tabla de equipos con presentación técnica y botones de acción.
 */
export const EquipmentTableRow = memo(function EquipmentTableRow({
  item,
  canManage,
  reviewOverdue,
  manualsCount,
  compatibleCount,
  onViewDetail,
  onDuplicate,
  onEdit,
  onDelete,
}: EquipmentTableRowProps) {
  return (
    <TableRow className="hover:bg-muted/40">
      <TableCell className="max-w-[18rem]">
        <span className="block font-mono text-xs text-muted-foreground">
          {item.code}
        </span>
        <span className="block truncate font-medium">
          {equipmentLabel(item)}
        </span>
        {reviewOverdue && (
          <span className="block text-xs font-medium text-amber-700">
            Revisión preventiva vencida
          </span>
        )}
        {item.location && (
          <span className="block text-xs text-muted-foreground lg:hidden">
            {item.location}
          </span>
        )}
      </TableCell>
      <TableCell className="hidden md:table-cell text-muted-foreground">
        {item.brand ?? "—"}
      </TableCell>
      <TableCell className="hidden xl:table-cell font-mono text-xs text-muted-foreground">
        {item.serialNumber ?? "—"}
      </TableCell>
      <TableCell className="hidden lg:table-cell font-mono text-xs text-muted-foreground">
        {item.location ?? "—"}
      </TableCell>
      <TableCell className="text-right text-sm tabular-nums">
        <span
          className={cn(
            "inline-flex items-center gap-1",
            manualsCount.total === 0 && "text-muted-foreground",
          )}
          title={
            manualsCount.total === 0
              ? "Sin manuales: ni asignados ni de este modelo"
              : `${manualsCount.assigned} asignados y ${manualsCount.byModel} del modelo`
          }
        >
          <BookOpen className="size-3.5" />
          {manualsCount.total}
        </span>
      </TableCell>
      <TableCell className="text-right text-sm tabular-nums">
        {compatibleCount}
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => onViewDetail(item)}
            aria-label={`Ver detalle de ${item.model}`}
          >
            <Eye className="size-4" />
          </Button>
          {canManage && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-foreground"
                onClick={() => onDuplicate(item)}
                title={`Añadir otra unidad de ${item.model} (usar modelo como plantilla)`}
                aria-label={`Añadir otra unidad de ${item.model}`}
              >
                <Copy className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => onEdit(item)}
                aria-label={`Editar ${item.model}`}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-destructive"
                onClick={() => onDelete(item)}
                aria-label={`Borrar ${item.model}`}
              >
                <Trash2 className="size-4" />
              </Button>
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
});
