import { useState } from "react";
import { useMutation } from "convex/react";
import { FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { DestructiveConfirmDialog } from "@/components/ui/destructive-confirm-dialog";
import { formatDateTime, getErrorMessage } from "@/lib/workshop";
import type { ReceptionDoc } from "../../../types";
import { formatReceptionLinesSummary } from "../helpers";
import type { OrderReceptionsListProps } from "../types";

export function OrderReceptionsList({
  receptions,
  canManage = false,
}: OrderReceptionsListProps) {
  const removeDeliveryNote = useMutation(
    api.purchasing.removeReceptionDeliveryNote,
  );
  const [removing, setRemoving] = useState<ReceptionDoc | null>(null);

  const handleConfirmRemove = async () => {
    if (!removing) return;
    try {
      await removeDeliveryNote({ receptionId: removing._id });
      toast.success("Albarán eliminado de la recepción.");
      setRemoving(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <>
      <div className="grid gap-2">
        <p className="text-sm font-medium">Recepciones</p>
        {receptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no ha entrado nada de esta orden.
          </p>
        ) : (
          receptions.map((row) => (
            <div
              key={row._id}
              className="grid gap-1 rounded-lg border border-border px-3 py-2 text-sm"
            >
              <span>
                {formatDateTime(row.receivedAt)} · {row.receivedBy}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatReceptionLinesSummary(row.lines)}
              </span>
              {row.deliveryNote ? (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                  {row.deliveryNoteUrl ? (
                    <a
                      href={row.deliveryNoteUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-w-0 items-center gap-1 text-xs text-signal underline"
                    >
                      <FileText className="size-3 shrink-0" />
                      <span className="truncate">{row.deliveryNote.name}</span>
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {row.deliveryNote.name} (ya no está disponible)
                    </span>
                  )}
                  {canManage && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => setRemoving(row)}
                      aria-label={`Eliminar albarán ${row.deliveryNote.name}`}
                    >
                      <Trash2 className="size-3.5" />
                      Eliminar adjunto
                    </Button>
                  )}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Sin albarán adjunto
                </span>
              )}
            </div>
          ))
        )}
      </div>

      {removing?.deliveryNote && (
        <DestructiveConfirmDialog
          onClose={() => setRemoving(null)}
          title={`¿Eliminar el albarán «${removing.deliveryNote.name}»?`}
          description={`Se quitará el archivo adjunto de esta recepción de ${removing.orderReference}. La recepción y el stock registrado se mantienen intactos.`}
          confirmLabel="Eliminar adjunto"
          busyLabel="Eliminando..."
          confirmIcon={<Trash2 className="size-4" />}
          onConfirm={handleConfirmRemove}
        />
      )}
    </>
  );
}
