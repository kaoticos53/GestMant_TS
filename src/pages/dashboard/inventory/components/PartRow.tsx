import {
  Minus,
  Pencil,
  Plus,
  Printer,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { RichText } from "@/components/RichText";
import { STOCK_META, formatCurrency, stockState } from "@/lib/workshop";
import { modelLabel } from "../helpers";
import type { EquipmentModelDoc, PartDoc } from "../types";

export interface PartRowProps {
  part: PartDoc;
  canManage: boolean;
  catalogModels: EquipmentModelDoc[];
  onQuickAdjust: (part: PartDoc, delta: number) => void;
  onEdit: (part: PartDoc) => void;
  onStockAdjust: (part: PartDoc) => void;
  onDelete: (part: PartDoc) => void;
  /** Abre la etiqueta imprimible del repuesto. */
  onPrintLabel: (part: PartDoc) => void;
  /** Índice en la página, para que el virtualizador sepa qué fila mide. */
  rowIndex?: number;
  /** Referencia de la fila, para medirla cuando la tabla se virtualiza. */
  rowRef?: (node: HTMLTableRowElement | null) => void;
}

export function PartRow({
  part,
  canManage,
  catalogModels,
  onQuickAdjust,
  onEdit,
  onStockAdjust,
  onDelete,
  onPrintLabel,
  rowIndex,
  rowRef,
}: PartRowProps) {
  const state = stockState(part.stock, part.minStock);
  const meta = STOCK_META[state];

  return (
    <TableRow className="hover:bg-muted/40" data-index={rowIndex} ref={rowRef}>
      <TableCell className="max-w-[16rem]">
        <span className="block font-mono text-xs text-muted-foreground">
          {part.code}
          {part.partNumber ? ` · ${part.partNumber}` : ""}
        </span>
        <span className="block truncate font-medium">{part.name}</span>
        {part.description && (
          <RichText
            value={part.description}
            className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground"
          />
        )}
        {part.compatibleModels && part.compatibleModels.length > 0 && (
          <span className="block truncate text-xs text-muted-foreground">
            {part.compatibleModels
              .map((id) => {
                const model = catalogModels.find((m) => m._id === id);
                return model ? modelLabel(model) : null;
              })
              .filter(Boolean)
              .join(", ")}
          </span>
        )}
        {part.location && (
          <span className="block text-xs text-muted-foreground lg:hidden">
            Ubicación {part.location}
          </span>
        )}
      </TableCell>
      <TableCell className="hidden md:table-cell text-muted-foreground">
        {part.category}
      </TableCell>
      <TableCell className="hidden lg:table-cell font-mono text-xs text-muted-foreground">
        {part.location || "—"}
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold tabular-nums">
            {part.stock}
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              {part.unit}
            </span>
          </span>
          <Badge variant="outline" className={meta.badgeClassName}>
            {meta.label}
          </Badge>
        </div>
      </TableCell>
      <TableCell className="hidden sm:table-cell text-right tabular-nums text-muted-foreground">
        {part.minStock}
      </TableCell>
      <TableCell className="hidden xl:table-cell text-right tabular-nums text-muted-foreground">
        {part.unitPrice && part.unitPrice > 0
          ? formatCurrency(part.unitPrice)
          : "—"}
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 text-muted-foreground hover:text-foreground"
            onClick={() => onPrintLabel(part)}
            aria-label={`Imprimir la etiqueta de ${part.code}`}
          >
            <Printer className="size-4" />
          </Button>
          {canManage && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-10"
                onClick={() => onQuickAdjust(part, -1)}
                disabled={part.stock <= 0}
                aria-label={`Quitar una unidad de ${part.code}`}
              >
                <Minus className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-10"
                onClick={() => onQuickAdjust(part, 1)}
                aria-label={`Añadir una unidad de ${part.code}`}
              >
                <Plus className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-10"
                onClick={() => onEdit(part)}
                aria-label={`Editar ${part.code}`}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-10 text-muted-foreground hover:text-destructive"
                onClick={() => onStockAdjust(part)}
                aria-label={`Ajustar stock de ${part.code}`}
              >
                <SlidersHorizontal className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-10 text-muted-foreground hover:text-destructive"
                onClick={() => onDelete(part)}
                aria-label={`Borrar ${part.code}`}
              >
                <Trash2 className="size-4" />
              </Button>
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
