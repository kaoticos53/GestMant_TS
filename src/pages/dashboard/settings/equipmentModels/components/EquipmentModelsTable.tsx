import {
  BookOpen,
  Cpu,
  Package,
  Pencil,
  Trash2,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListArea } from "@/components/ListArea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { EquipmentModelDoc, UsageStats } from "../types";

export interface EquipmentModelsTableProps {
  visibleModels: EquipmentModelDoc[];
  usageStats: UsageStats;
  areaRef: (element: HTMLDivElement | null) => void;
  page: number;
  onOpenEdit: (model: EquipmentModelDoc) => void;
  onOpenDelete: (model: EquipmentModelDoc) => void;
}

export function EquipmentModelsTable({
  visibleModels,
  usageStats,
  areaRef,
  page,
  onOpenEdit,
  onOpenDelete,
}: EquipmentModelsTableProps) {
  return (
    <ListArea
      ref={areaRef}
      resetKey={page}
      maxHeightClass="max-h-[calc(100dvh_-_48rem)]"
    >
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-card">
          <TableRow>
            <TableHead>Marca</TableHead>
            <TableHead>Modelo</TableHead>
            <TableHead className="hidden md:table-cell">Categoría</TableHead>
            <TableHead className="hidden lg:table-cell">Preventivo</TableHead>
            <TableHead>Uso</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleModels.map((item) => {
            const eqCount = usageStats.equipCount.get(item._id) ?? 0;
            const spCount = usageStats.partsCount.get(item._id) ?? 0;
            const manCount = usageStats.manualsCount.get(item._id) ?? 0;

            return (
              <TableRow key={item._id} className="hover:bg-muted/40">
                <TableCell className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {item.brand || "—"}
                </TableCell>
                <TableCell className="max-w-[20rem]">
                  <span className="block truncate font-semibold text-foreground">
                    {item.model}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.name}
                  </span>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {item.category ? (
                    <Badge
                      variant="secondary"
                      className="text-[10px] font-normal"
                    >
                      {item.category}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                  {item.defaultMaintenanceIntervalDays !== undefined ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Wrench className="size-3 text-signal" />
                      <span>cada {item.defaultMaintenanceIntervalDays} días</span>
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge
                      variant="outline"
                      title={`${eqCount} equipo(s) físico(s) en taller`}
                      className={`text-[10px] px-1.5 py-0.5 gap-1 font-mono ${
                        eqCount > 0
                          ? "border-primary/40 text-primary"
                          : "text-muted-foreground"
                      }`}
                    >
                      <Cpu className="size-3" />
                      <span>{eqCount}</span>
                    </Badge>

                    <Badge
                      variant="outline"
                      title={`${spCount} repuesto(s) compatible(s)`}
                      className={`text-[10px] px-1.5 py-0.5 gap-1 font-mono ${
                        spCount > 0
                          ? "border-amber-500/40 text-amber-600 dark:text-amber-400"
                          : "text-muted-foreground"
                      }`}
                    >
                      <Package className="size-3" />
                      <span>{spCount}</span>
                    </Badge>

                    <Badge
                      variant="outline"
                      title={`${manCount} manual(es) vinculado(s)`}
                      className={`text-[10px] px-1.5 py-0.5 gap-1 font-mono ${
                        manCount > 0
                          ? "border-blue-500/40 text-blue-600 dark:text-blue-400"
                          : "text-muted-foreground"
                      }`}
                    >
                      <BookOpen className="size-3" />
                      <span>{manCount}</span>
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-foreground"
                      onClick={() => onOpenEdit(item)}
                      aria-label={`Editar modelo ${item.model}`}
                      title={`Editar modelo ${item.model}`}
                    >
                      <Pencil className="size-4" />
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => onOpenDelete(item)}
                      aria-label={`Eliminar modelo ${item.model}`}
                      title={`Eliminar modelo ${item.model}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </ListArea>
  );
}
