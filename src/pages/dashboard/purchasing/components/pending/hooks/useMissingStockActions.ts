import { api } from "@/convex/_generated/api";
import {
  requestsMissingStock,
  type PurchaseRequestDoc,
} from "@/lib/purchasing";
import { getErrorMessage } from "@/lib/workshop";
import type { PartDoc, PartRequestDoc } from "@/pages/dashboard/purchasing/types";
import { useMutation } from "convex/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export interface UseMissingStockActionsOptions {
  partRequests: readonly PartRequestDoc[];
  parts: readonly PartDoc[];
  purchaseRequests: readonly PurchaseRequestDoc[];
}

/**
 * Hook para gestionar las peticiones de repuesto sin existencias en almacén:
 * - Detección automática mediante `requestsMissingStock`.
 * - Selección masiva (`marcadas`).
 * - Mutación en lote `requestPurchases` y singular `requestPurchase`.
 */
export function useMissingStockActions({
  partRequests,
  parts,
  purchaseRequests,
}: UseMissingStockActionsOptions) {
  const requestPurchase = useMutation(api.purchasing.requestPurchase);
  const requestPurchases = useMutation(api.purchasing.requestPurchases);

  const [markedIds, setMarkedIds] = useState<Set<string>>(new Set());
  const [isReserving, setIsReserving] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const missingStockRequests = useMemo(
    () => requestsMissingStock(partRequests as PartRequestDoc[], parts as PartDoc[], purchaseRequests as PurchaseRequestDoc[]),
    [partRequests, parts, purchaseRequests],
  );

  const markedMissingStock = useMemo(
    () =>
      missingStockRequests.filter(({ request }) =>
        markedIds.has(request._id),
      ),
    [missingStockRequests, markedIds],
  );

  const areAllMarked =
    missingStockRequests.length > 0 &&
    markedMissingStock.length === missingStockRequests.length;

  const toggleMarked = (id: string) => {
    setMarkedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    setMarkedIds(
      areAllMarked
        ? new Set()
        : new Set(missingStockRequests.map(({ request }) => request._id)),
    );
  };

  const reserveMarked = async () => {
    const ids = markedMissingStock.map(({ request }) => request._id);
    if (ids.length === 0) return;

    setIsReserving(true);
    try {
      const { references, requests, repeated, skipped } =
        await requestPurchases({ requestIds: ids });
      const fuera = skipped
        .map((row) => `${row.reference}: ${row.reason}`)
        .join(" · ");

      if (references.length === 0) {
        toast.warning("No se apartó nada", { description: fuera });
      } else {
        toast.success(
          `${requests} ${requests === 1 ? "petición apartada" : "peticiones apartadas"} para comprar`,
          {
            description: [
              references.length === 1
                ? references[0]
                : `${references.length} líneas: ${references.join(", ")}`,
              repeated > 0
                ? `${repeated} ya estaba${repeated === 1 ? "" : "n"} en camino`
                : "",
              fuera ? `Sin apartar — ${fuera}` : "",
            ]
              .filter(Boolean)
              .join(" · "),
          },
        );
      }
      setMarkedIds(new Set());
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsReserving(false);
    }
  };

  const generateSingle = async (request: PartRequestDoc) => {
    setGeneratingId(request._id);
    try {
      const { references, repeated } = await requestPurchase({
        requestId: request._id,
      });
      toast.success(
        references.length === 1
          ? `${references[0]} apartada para comprar`
          : `${references.length} peticiones de compra apartadas (${references.join(", ")})`,
        {
          description:
            repeated > 0
              ? `${repeated} línea${repeated === 1 ? "" : "s"} ya estaba${repeated === 1 ? "" : "n"} en la cola de compras.`
              : "Están sin tratar, agrupadas por proveedor.",
        },
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setGeneratingId(null);
    }
  };

  return {
    missingStockRequests,
    markedMissingStock,
    markedIds,
    areAllMarked,
    isReserving,
    generatingId,
    toggleMarked,
    toggleAll,
    reserveMarked,
    generateSingle,
  };
}
