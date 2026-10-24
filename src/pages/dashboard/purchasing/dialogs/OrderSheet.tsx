import { Sheet, SheetContent } from "@/components/ui/sheet";
import { JourneySummary } from "@/components/JourneySummary";
import type { PurchaseOrderDoc } from "@/lib/purchasing";
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
}

/** La orden entera: sus artículos, sus notas y lo que ha entrado. */
export function OrderSheet({
  order,
  receptions,
  canManage,
  onClose,
  onReceive,
  onCancel,
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

        <div className="grid gap-4 px-4 pb-6">
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
          />

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
