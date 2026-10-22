import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { isPurchaseRequestAwaitingDelivery } from "@/lib/purchaseFlow";
import { richDocIsEmpty } from "@/lib/richDoc";
import { getErrorMessage } from "@/lib/workshop";
import {
  DECISION_ICON,
  DECISION_META,
  type DecisionMode,
  type PartDoc,
  type RequestDoc,
} from "../../../types";
import {
  buildInitialDeliveryQuantities,
  buildIssueBatchLines,
  calculateShortages,
  calculateTotalDeliveryQuantity,
} from "../helpers";

export interface UseDecisionDialogStateParams {
  request: RequestDoc;
  mode: DecisionMode;
  parts: PartDoc[];
  canPurchase: boolean;
  onClose: () => void;
}

export function useDecisionDialogState({
  request,
  mode,
  parts,
  canPurchase,
  onClose,
}: UseDecisionDialogStateParams) {
  const approve = useMutation(api.partRequests.approve);
  const requestPurchase = useMutation(api.purchasing.requestPurchase);
  const reject = useMutation(api.partRequests.reject);
  const issueLines = useMutation(api.partRequests.issueLines);
  const onHold = useMutation(api.partRequests.onHold);
  const returnMaterial = useMutation(api.partRequests.returnMaterial);
  const cancel = useMutation(api.partRequests.cancel);

  const [note, setNote] = useState("");
  const [entrega, setEntrega] = useState<Record<string, number>>(() =>
    buildInitialDeliveryQuantities(request.lines, request.status),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meta = DECISION_META[mode];
  const DecisionIcon = DECISION_ICON[mode];

  const partById = new Map(parts.map((part) => [part._id, part]));
  const shortages = calculateShortages(request.lines, parts);

  const isApprove = mode === "approve";
  const isIssue = mode === "issue";
  const entregandoAhora = calculateTotalDeliveryQuantity(request.lines, entrega);
  const missingReference = isApprove && request.lines.length === 0;
  const blocked = isApprove && (missingReference || shortages.length > 0);

  const comprasQuery = useQuery(
    api.purchasing.byRequest,
    canPurchase ? { requestId: request._id } : ("skip" as const),
  );
  const compras = comprasQuery?.requests ?? [];
  const compradas = compras.filter(isPurchaseRequestAwaitingDelivery).length;

  const handleChangeDelivery = (sparePartId: string, quantity: number) => {
    setEntrega((current) => ({
      ...current,
      [sparePartId]: quantity,
    }));
  };

  const handlePurchase = async () => {
    setBusy(true);
    setError(null);
    try {
      const { references, repeated } = await requestPurchase({
        requestId: request._id,
      });
      toast.success(
        references.length === 1
          ? `${references[0]} apartada para comprar`
          : `${references.length} peticiones de compra apartadas`,
        {
          description:
            repeated > 0
              ? `${repeated} línea${repeated === 1 ? "" : "s"} ya estaba${repeated === 1 ? "" : "n"} en la cola de compras.`
              : "Están sin tratar, en el módulo de compras.",
        },
      );
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async () => {
    const tanda = buildIssueBatchLines(request.lines, entrega);
    if (isIssue && tanda.length === 0) {
      setError(
        "Indica al menos una unidad para entregar: lo que se quede en cero sigue en el almacén.",
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const reason = richDocIsEmpty(note) ? {} : { note };
      const payload = { requestId: request._id, ...reason };
      if (mode === "approve") await approve(payload);
      else if (mode === "reject") await reject(payload);
      else if (mode === "issue") await issueLines({ ...payload, lines: tanda });
      else if (mode === "hold") await onHold(payload);
      else if (mode === "return") await returnMaterial(payload);
      else await cancel(payload);
      toast.success(meta.success(request));
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return {
    note,
    setNote,
    entrega,
    handleChangeDelivery,
    busy,
    error,
    meta,
    DecisionIcon,
    partById,
    shortages,
    isApprove,
    isIssue,
    entregandoAhora,
    missingReference,
    blocked,
    compradas,
    handlePurchase,
    handleConfirm,
  };
}
