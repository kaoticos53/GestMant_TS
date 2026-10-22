import { ArchiveRestore, Eye, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TrashButtonsProps } from "../types";

export function TrashButtons({
  row,
  busyId,
  onOpen,
  onRestore,
  onDelete,
}: TrashButtonsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        disabled={busyId === row.item.id}
        onClick={() => onOpen(row)}
      >
        <Eye className="size-4" />
        Ver ficha
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        disabled={busyId === row.item.id}
        onClick={() => void onRestore(row)}
      >
        <ArchiveRestore className="size-4" />
        Recuperar
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="gap-2 text-destructive hover:text-destructive"
        disabled={busyId === row.item.id}
        onClick={() => onDelete(row)}
      >
        <Trash2 className="size-4" />
        Borrar ya
      </Button>
    </div>
  );
}
