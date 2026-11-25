import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  EQUIPMENT_OPERATIONAL_META,
  resolveOperationalState,
} from "@/lib/movements";
import { equipmentLabel } from "@/lib/workshop";
import { DetailTitleButton } from "@/components/DetailTitleButton";
import {
  BookOpen,
  Copy,
  Eye,
  MoreHorizontal,
  Pencil,
  Printer,
  Trash2,
} from "lucide-react";
import type { EquipmentDoc } from "../types";

interface EquipmentTableRowProps {
  item: EquipmentDoc;
  canManage: boolean;
  reviewOverdue: boolean;
  manualsCount: { assigned: number; byModel: number; total: number };
  compatibleCount: number;
  onViewDetail: (item: EquipmentDoc) => void;
  onPrintLabel: (item: EquipmentDoc) => void;
  onDuplicate: (item: EquipmentDoc) => void;
  onEdit: (item: EquipmentDoc) => void;
  onDelete: (item: EquipmentDoc) => void;
  /** Índice en la página, para que el virtualizador sepa qué fila mide. */
  rowIndex?: number;
  /** Referencia de la fila, para medirla cuando la tabla se virtualiza. */
  rowRef?: (node: HTMLTableRowElement | null) => void;
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
  onPrintLabel,
  onDuplicate,
  onEdit,
  onDelete,
  rowIndex,
  rowRef,
}: EquipmentTableRowProps) {
  const opState = resolveOperationalState(item);
  const opMeta = EQUIPMENT_OPERATIONAL_META[opState];
  return (
    <TableRow className="hover:bg-muted/40" data-index={rowIndex} ref={rowRef}>
      <TableCell className="max-w-[18rem]">
        <span className="block font-mono text-xs text-muted-foreground">
          {item.code}
        </span>
        <DetailTitleButton onClick={() => onViewDetail(item)}>
          {equipmentLabel(item)}
        </DetailTitleButton>
        {opState !== "operational" && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge
              variant="outline"
              className={cn("text-[11px]", opMeta.badgeClassName)}
            >
              {opMeta.label}
            </Badge>
            {item.currentLoan && (
              <span className="truncate text-xs text-muted-foreground">
                a {item.currentLoan.borrowerName}
              </span>
            )}
          </div>
        )}
        {reviewOverdue && (
          <span className="block text-xs font-medium text-status-warning-foreground">
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
            className="size-9"
            onClick={() => onViewDetail(item)}
            aria-label={`Ver detalle de ${item.model}`}
          >
            <Eye className="size-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 text-muted-foreground hover:text-foreground"
                aria-label={`Más acciones para ${item.model}`}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onPrintLabel(item)}>
                <Printer className="mr-2 size-4" />
                Imprimir etiqueta
              </DropdownMenuItem>
              {canManage && (
                <>
                  <DropdownMenuItem onClick={() => onDuplicate(item)}>
                    <Copy className="mr-2 size-4" />
                    Duplicar unidad
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onEdit(item)}>
                    <Pencil className="mr-2 size-4" />
                    Editar equipo
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => onDelete(item)}
                  >
                    <Trash2 className="mr-2 size-4" />
                    Borrar equipo
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  );
});
