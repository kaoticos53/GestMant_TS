import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import {
  NEXT_ORDER_STEP_LABELS,
  blockedJourneySteps,
  nextPurchaseOrderAction,
  orderJourney,
} from "@/lib/orderJourney";
import {
  PURCHASE_ORDER_STATUS_META,
  orderTotals,
  type PurchaseOrderDoc,
  type PurchaseOrderLine,
} from "@/lib/purchasing";
import { getErrorMessage } from "@/lib/workshop";
import { getOrderSheetNextHint } from "../helpers";

export function useOrderSheetState(
  order: PurchaseOrderDoc,
  canManage: boolean,
) {
  const setLineNote = useMutation(api.purchasing.setLineNote);
  const setSolicitudeCode = useMutation(api.purchasing.setSolicitudeCode);

  const [editandoSolicitud, setEditandoSolicitud] = useState(false);
  const [codigoSolicitud, setCodigoSolicitud] = useState(
    order.solicitudeCode ?? "",
  );
  const [guardandoSolicitud, setGuardandoSolicitud] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [nota, setNota] = useState("");

  const meta = PURCHASE_ORDER_STATUS_META[order.status];
  const total = orderTotals(order);

  const stages = orderJourney(order.status, { received: total.received > 0 });
  const nextAction = nextPurchaseOrderAction(order.status, { canManage });
  const nextLabel = nextAction
    ? (NEXT_ORDER_STEP_LABELS[nextAction] ?? nextAction)
    : null;
  const nextHint = getOrderSheetNextHint(canManage, order.status);
  const blocked = canManage ? blockedJourneySteps(order.status) : [];

  const handleStartEditingNote = (
    purchaseRequestId: string,
    initialNote: string,
  ) => {
    setNota(initialNote);
    setEditando(purchaseRequestId);
  };

  const handleSaveNota = async (line: PurchaseOrderLine) => {
    try {
      await setLineNote({
        orderId: order._id,
        purchaseRequestId: line.purchaseRequestId,
        note: nota,
      });
      toast.success(`${line.code}: nota guardada en la orden`);
      setEditando(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleStartEditingSolicitud = () => {
    setCodigoSolicitud(order.solicitudeCode ?? "");
    setEditandoSolicitud(true);
  };

  const handleCancelEditingSolicitud = () => {
    setEditandoSolicitud(false);
  };

  const handleSaveSolicitud = async () => {
    setGuardandoSolicitud(true);
    try {
      await setSolicitudeCode({
        orderId: order._id,
        solicitudeCode: codigoSolicitud.trim() || undefined,
      });
      toast.success("Código de solicitud actualizado");
      setEditandoSolicitud(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setGuardandoSolicitud(false);
    }
  };

  return {
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
  };
}
