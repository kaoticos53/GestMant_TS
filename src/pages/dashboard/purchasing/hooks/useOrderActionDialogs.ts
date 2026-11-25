import { useState } from "react";
import type { PurchaseOrderDoc } from "@/lib/purchasing";

/**
 * Gestiona el estado compartido de recepción y anulación para una orden de compra
 * abierta desde cualquier vista del módulo de compras.
 */
export function useOrderActionDialogs() {
  const [recibiendo, setRecibiendo] = useState<PurchaseOrderDoc | null>(null);
  const [anulando, setAnulando] = useState<PurchaseOrderDoc | null>(null);
  const [motivo, setMotivo] = useState("");

  const startCancel = (order: PurchaseOrderDoc) => {
    setMotivo("");
    setAnulando(order);
  };

  const closeCancel = () => {
    setAnulando(null);
    setMotivo("");
  };

  return {
    recibiendo,
    setRecibiendo,
    anulando,
    startCancel,
    closeCancel,
    motivo,
    setMotivo,
  };
}
