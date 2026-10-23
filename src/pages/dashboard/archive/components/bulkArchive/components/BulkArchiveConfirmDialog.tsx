import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Archive } from "lucide-react";
import { formatConfirmDialogDescription } from "../helpers";
import type { BulkArchiveConfirmDialogProps } from "../types";

export function BulkArchiveConfirmDialog({
  target,
  pending,
  cutoff,
  busy,
  onClose,
  onConfirm,
}: BulkArchiveConfirmDialogProps) {
  if (!target) return null;

  const count = target === "incidents" ? pending.incidents : pending.requests;
  const descriptionText = formatConfirmDialogDescription(target, count, cutoff);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Archivar lo antiguo</DialogTitle>
          <DialogDescription>{descriptionText}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="gap-2"
            disabled={busy}
            onClick={onConfirm}
          >
            <Archive className="size-4" />
            {busy ? "Archivando..." : "Archivar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
