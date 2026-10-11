import type { Doc } from "../convex/_generated/dataModel";

/**
 * Compras: la copia que lee la pantalla y las cuentas que hace.
 *
 * Los estados del backend viven en el esquema; aquí están sus etiquetas y los
 * dos cálculos que la pantalla necesita una y otra vez —cómo se agrupa lo que
 * espera por proveedor y cuánto de una orden ha llegado—, fuera de los
 * componentes para poder probarlos sin navegador (mismo criterio que
 * `browse.ts`, `chatPanel.ts` o `sidebar.ts`).
 */

export type PurchaseRequestStatus =
  "pending" | "ordered" | "received" | "cancelled";

export type PurchaseOrderStatus =
  "pending" | "partial" | "completed" | "cancelled";

export type PurchaseRequestDoc = Doc<"purchaseRequests">;
export type PurchaseOrderDoc = Doc<"purchaseOrders">;
export type PurchaseOrderLine = PurchaseOrderDoc["lines"][number];

export const PURCHASE_REQUEST_STATUS_META: Record<
  PurchaseRequestStatus,
  { label: string; badgeClassName: string }
> = {
  pending: {
    label: "Sin tratar",
    badgeClassName: "border-amber-500/25 bg-amber-500/10 text-amber-700",
  },
  ordered: {
    label: "Pedido al proveedor",
    badgeClassName: "border-sky-600/25 bg-sky-600/10 text-sky-700",
  },
  received: {
    label: "Recibido",
    badgeClassName: "border-emerald-600/25 bg-emerald-600/10 text-emerald-700",
  },
  cancelled: {
    label: "Retirada",
    badgeClassName: "border-border bg-muted text-muted-foreground",
  },
};

export const PURCHASE_ORDER_STATUS_META: Record<
  PurchaseOrderStatus,
  { label: string; description: string; badgeClassName: string }
> = {
  pending: {
    label: "Pendiente",
    description: "Enviada al proveedor; todavía no ha llegado nada",
    badgeClassName: "border-sky-600/25 bg-sky-600/10 text-sky-700",
  },
  partial: {
    label: "Parcial",
    description: "Ha llegado parte del material",
    badgeClassName: "border-amber-500/25 bg-amber-500/10 text-amber-700",
  },
  completed: {
    label: "Completada",
    description: "Ha llegado todo lo que se pidió",
    badgeClassName: "border-emerald-600/25 bg-emerald-600/10 text-emerald-700",
  },
  cancelled: {
    label: "Anulada",
    description: "Sus peticiones de compra han vuelto a la cola",
    badgeClassName: "border-border bg-muted text-muted-foreground",
  },
};

/** Por qué se compra: es lo que se lee en la ficha de la compra. */
export const PURCHASE_REASON_META: Record<
  PurchaseRequestDoc["reason"],
  string
> = {
  noStock: "No hay existencias suficientes",
  newPart: "Repuesto nuevo: no estaba en el almacén",
  other: "Otro motivo",
};

/** Lo que le falta a un artículo de una orden por llegar. */
export function pendingQuantity(line: PurchaseOrderLine): number {
  return Math.max(0, line.quantity - line.receivedQuantity);
}

/** Cuánto lleva recibido una orden, sumando sus artículos. */
export function orderTotals(order: PurchaseOrderDoc) {
  const quantity = order.lines.reduce((sum, line) => sum + line.quantity, 0);
  const received = order.lines.reduce(
    (sum, line) => sum + Math.min(line.receivedQuantity, line.quantity),
    0,
  );
  const pending = Math.max(0, quantity - received);
  return {
    quantity,
    received,
    pending,
    /** 0..1, para la barra de progreso. Sin artículos no se pinta nada. */
    ratio: quantity === 0 ? 0 : Math.min(1, received / quantity),
  };
}

export interface SupplierGroup {
  supplier: string;
  items: PurchaseRequestDoc[];
  /** Cuántas unidades se compran en total dentro del grupo. */
  quantity: number;
  /** Cuántas peticiones de repuesto distintas esperan detrás del grupo. */
  requests: number;
}

/**
 * Lo que espera a que alguien monte la orden, agrupado por proveedor. Solo
 * entran las peticiones de compra **sin tratar**: lo que ya está en una orden o
 * ha llegado no se compra otra vez. Dentro de cada grupo, lo más antiguo
 * primero: es lo que lleva más tiempo parado.
 */
export function groupBySupplier(
  requests: PurchaseRequestDoc[],
): SupplierGroup[] {
  const groups = new Map<string, SupplierGroup>();
  for (const row of requests) {
    if (row.status !== "pending") continue;
    const group = groups.get(row.supplier) ?? {
      supplier: row.supplier,
      items: [],
      quantity: 0,
      requests: 0,
    };
    group.items.push(row);
    group.quantity += row.quantity;
    groups.set(row.supplier, group);
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) => a.createdAt - b.createdAt),
      requests: new Set(group.items.map((row) => row.requestReference)).size,
    }))
    .sort((a, b) => a.supplier.localeCompare(b.supplier, "es"));
}

/**
 * Las peticiones de repuesto que siguen sin material: las que tienen alguna
 * línea que el almacén no cubre. Es la lista desde la que el responsable genera
 * las peticiones de compra, así que se mira el catálogo que hay ahora mismo.
 */
export function requestsMissingStock(
  requests: Doc<"partRequests">[],
  parts: Pick<Doc<"spareParts">, "_id" | "stock">[],
  purchaseRequests: PurchaseRequestDoc[],
) {
  const stock = new Map(parts.map((part) => [part._id, part.stock]));
  const covered = new Set(
    purchaseRequests
      .filter(
        (row) => row.status !== "cancelled" && row.receivedAt === undefined,
      )
      .map((row) => `${row.requestId}:${row.sparePartId}`),
  );
  return requests
    .filter(
      (request) =>
        request.archivedAt === undefined &&
        (request.status === "pending" ||
          request.status === "onHold" ||
          request.status === "pendingSupplierQuote"),
    )
    .map((request) => {
      const missing = request.lines.filter((line) => {
        const hay = stock.get(line.sparePartId) ?? 0;
        return (
          line.quantity > hay &&
          !covered.has(`${request._id}:${line.sparePartId}`)
        );
      });
      return { request, missing };
    })
    .filter((row) => row.missing.length > 0)
    .sort((a, b) => a.request.createdAt - b.request.createdAt);
}

/** «2 peticiones · 3 artículos · 5 ud»: el resumen de un grupo de proveedor. */
export function groupSummary(group: SupplierGroup): string {
  const peticiones =
    group.requests === 1 ? "1 petición" : `${group.requests} peticiones`;
  const articulos =
    group.items.length === 1 ? "1 artículo" : `${group.items.length} artículos`;
  return `${peticiones} · ${articulos} · ${group.quantity} ud`;
}
