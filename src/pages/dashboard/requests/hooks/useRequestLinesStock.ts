import { useMemo } from "react";
import {
  lineDelivered,
  lineRemaining,
  requestDelivery,
  requestMaterialState,
} from "@/lib/requestFlow";
import type { PartDoc, RequestDoc } from "../types";

export interface EnrichedRequestLine {
  sparePartId: RequestDoc["lines"][number]["sparePartId"];
  name: string;
  code: string;
  partNumber?: string;
  quantity: number;
  deliveredQuantity: number;
  remainingQuantity: number;
  deliveredAt?: number;
  part?: PartDoc;
  hasShortage: boolean;
}

export function useRequestLinesStock(
  lines: RequestDoc["lines"],
  status: RequestDoc["status"],
  parts: PartDoc[],
) {
  // 1. Indexación O(1) memoizada del catálogo de piezas
  const partById = useMemo(() => {
    return new Map(parts.map((part) => [part._id, part]));
  }, [parts]);

  // 2. Estado agregado de entregas y material
  const delivery = useMemo(() => requestDelivery(lines, status), [lines, status]);
  const material = useMemo(
    () => requestMaterialState(status, delivery),
    [status, delivery],
  );

  // 3. Última fecha en la que se entregó material
  const lastDeliveredAt = useMemo(() => {
    return lines.reduce<number | null>(
      (latest, line) =>
        line.deliveredAt === undefined
          ? latest
          : Math.max(latest ?? 0, line.deliveredAt),
      null,
    );
  }, [lines]);

  const noReference = lines.length === 0;

  // 4. Líneas enriquecidas con cálculos individuales de entrega y rotura de stock
  const enrichedLines = useMemo<EnrichedRequestLine[]>(() => {
    return lines.map((line) => {
      const part = partById.get(line.sparePartId);
      const hasShortage = !part || part.stock < line.quantity;
      const delivered = lineDelivered(line, status);
      const remaining = lineRemaining(line, status);

      return {
        sparePartId: line.sparePartId,
        name: line.name,
        code: line.code,
        partNumber: part?.partNumber,
        quantity: line.quantity,
        deliveredQuantity: delivered,
        remainingQuantity: remaining,
        deliveredAt: line.deliveredAt,
        part,
        hasShortage,
      };
    });
  }, [lines, status, partById]);

  return {
    partById,
    delivery,
    material,
    lastDeliveredAt,
    noReference,
    enrichedLines,
  };
}
