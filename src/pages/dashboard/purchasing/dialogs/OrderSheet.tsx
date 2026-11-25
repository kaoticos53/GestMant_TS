import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { CatalogContactInfo } from "@/components/CatalogContactInfo";
import { JourneySummary } from "@/components/JourneySummary";
import { canAdvancePurchaseOrder } from "@/lib/purchaseFlow";
import type { PurchaseOrderDoc } from "@/lib/purchasing";
import { getErrorMessage } from "@/lib/workshop";
import type { ReceptionDoc } from "../types";
import { OrderLinesList } from "./orderSheet/components/OrderLinesList";
import { OrderReceptionsList } from "./orderSheet/components/OrderReceptionsList";
import { OrderSheetFooter } from "./orderSheet/components/OrderSheetFooter";
import { OrderSheetHeader } from "./orderSheet/components/OrderSheetHeader";
import { OrderSolicitudeCodeCard } from "./orderSheet/components/OrderSolicitudeCodeCard";
import { useOrderSheetState } from "./orderSheet/hooks/useOrderSheetState";

export interface OrderSheetProps {
  order: PurchaseOrderDoc;
  receptions: ReceptionDoc[];
  canManage: boolean;
  onClose: () => void;
  onReceive: () => void;
  onCancel: () => void;
  onOpenRequest?: (id: Id<"partRequests">) => void;
}

/** La orden entera: sus artículos, sus notas y lo que ha entrado. */
export function OrderSheet({
  order,
  receptions,
  canManage,
  onClose,
  onReceive,
  onCancel,
  onOpenRequest,
}: OrderSheetProps) {
  const {
    meta,
    total,
    stages,
    nextLabel,
    nextHint,
    blocked,
    editandoSolicitud,
    codigoSolicitud,
    setCodigoSolicitud,
    guardandoSolicitud,
    editando,
    nota,
    setNota,
    handleStartEditingNote,
    handleSaveNota,
    handleStartEditingSolicitud,
    handleCancelEditingSolicitud,
    handleSaveSolicitud,
  } = useOrderSheetState(order, canManage);

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <OrderSheetHeader order={order} meta={meta} total={total} />

        <div className="grid min-w-0 gap-4 px-4 pb-6 [&>*]:min-w-0">
          <JourneySummary
            label="Recorrido de la orden de compra"
            stages={stages}
            nowLabel={`${meta.label} · ${total.received}/${total.quantity} ud`}
            nextLabel={nextLabel}
            nextHint={nextHint}
            blocked={blocked}
          />

          <OrderSolicitudeCodeCard
            solicitudeCode={order.solicitudeCode}
            canManage={canManage}
            editandoSolicitud={editandoSolicitud}
            codigoSolicitud={codigoSolicitud}
            guardandoSolicitud={guardandoSolicitud}
            onStartEditing={handleStartEditingSolicitud}
            onCancelEditing={handleCancelEditingSolicitud}
            onChangeCode={setCodigoSolicitud}
            onSave={() => void handleSaveSolicitud()}
          />

          <CatalogContactInfo
            kind="supplier"
            name={order.supplier}
            catalogId={order.supplierId}
          />

          {order.notes && (
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
              {order.notes}
            </div>
          )}

          <OrderLinesList
            lines={order.lines}
            canManage={canManage}
            orderStatus={order.status}
            editando={editando}
            nota={nota}
            onStartEditingNote={handleStartEditingNote}
            onChangeNote={setNota}
            onSaveNote={(line) => void handleSaveNota(line)}
            onOpenRequest={
              onOpenRequest
                ? (id) => {
                    onClose();
                    onOpenRequest(id);
                  }
                : undefined
            }
          />

          <OrderLineRemovalControl order={order} canManage={canManage} />

          <OrderReceptionsList receptions={receptions} />
        </div>

        <OrderSheetFooter
          order={order}
          orderStatus={order.status}
          onClose={onClose}
          onCancel={onCancel}
          onReceive={onReceive}
        />
      </SheetContent>
    </Sheet>
  );
}

function OrderLineRemovalControl({
  order,
  canManage,
}: {
  order: PurchaseOrderDoc;
  canManage: boolean;
}) {
  const cancelOrderLine = useMutation(api.purchasing.cancelOrderLine);
  const pendingLines = order.lines.filter(
    (line) => line.receivedQuantity < line.quantity,
  );
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>(
    pendingLines[0]?.purchaseRequestId ?? "",
  );
  const [mode, setMode] = useState<"requeue" | "noSupply">("requeue");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (
    !canManage ||
    !canAdvancePurchaseOrder(order.status, "cancel") ||
    pendingLines.length === 0
  ) {
    return null;
  }

  const targetId =
    pendingLines.find((l) => l.purchaseRequestId === selectedId)
      ?.purchaseRequestId ?? pendingLines[0].purchaseRequestId;

  const handleConfirm = async () => {
    const trimmed = note.trim();
    if (!trimmed) {
      toast.error("Indica el motivo por el que retiras la línea.");
      return;
    }
    setSubmitting(true);
    try {
      await cancelOrderLine({
        orderId: order._id,
        purchaseRequestId: targetId as Id<"purchaseRequests">,
        mode,
        note: trimmed,
      });
      toast.success("Línea retirada de la orden.");
      setOpen(false);
      setNote("");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-destructive hover:underline"
        >
          Retirar una línea pendiente de esta orden
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Retirar línea de {order.reference}</DialogTitle>
            <DialogDescription>
              Útil si el proveedor no puede servir uno de los artículos sin
              anular el resto de la orden.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="remove-line-select">Artículo pendiente</Label>
              <select
                id="remove-line-select"
                value={targetId}
                onChange={(e) => setSelectedId(e.target.value)}
                disabled={submitting}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
              >
                {pendingLines.map((line) => (
                  <option
                    key={line.purchaseRequestId}
                    value={line.purchaseRequestId}
                  >
                    {line.code} · {line.name} (pendientes:{" "}
                    {line.quantity - line.receivedQuantity})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="remove-line-mode">Qué hacer con la línea</Label>
              <select
                id="remove-line-mode"
                value={mode}
                onChange={(e) =>
                  setMode(e.target.value as "requeue" | "noSupply")
                }
                disabled={submitting}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
              >
                <option value="requeue">
                  Devolver a Compras → Pendientes (cambiar proveedor)
                </option>
                <option value="noSupply">
                  Cancelar por falta de suministro / descatalogado
                </option>
              </select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="remove-line-note">Motivo (obligatorio)</Label>
              <Textarea
                id="remove-line-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ej. Proveedor sin stock hasta próximo trimestre…"
                rows={2}
                maxLength={200}
                disabled={submitting}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleConfirm()}
              disabled={submitting}
            >
              {submitting ? "Retirando..." : "Retirar línea"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
