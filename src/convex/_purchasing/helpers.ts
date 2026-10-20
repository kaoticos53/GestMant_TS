import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { hasAnyCapability, hasCapability } from "../permissions";
import {
  canAdvancePurchaseOrder,
  isPurchaseRequestAwaitingDelivery,
  purchaseOrderStatusAfterReceiving,
  purchaseRequestReceivedStatus,
} from "../../lib/purchaseFlow";
import { nextRequestStatus } from "../../lib/requestFlow";
import { PURCHASE_ORDER_STATUSES, type DeliveryNote } from "../schema";

/** Toda la gestión de compras requiere sesión iniciada. */
export async function requireUser(ctx: QueryCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new ConvexError("Debes iniciar sesión para gestionar las compras.");
  }
  const user = await ctx.db.get(userId);
  if (!user || user.active === false || user.isAnonymous === true) {
    throw new ConvexError(
      user?.active === false
        ? "Esta cuenta ha sido dada de baja o no está activa."
        : "Debes iniciar sesión con una cuenta registrada para gestionar las compras.",
    );
  }
  return userId;
}

/** Comprar y recepcionar: capacidad «managePurchasing» (el admin siempre). */
export async function requirePurchasing(
  ctx: QueryCtx,
  action: string,
): Promise<Id<"users">> {
  const userId = await requireUser(ctx);
  const user = await ctx.db.get(userId);
  if (!user || !(await hasCapability(ctx, user, "managePurchasing"))) {
    throw new ConvexError(
      `No tienes permisos para ${action}. Revisa la configuración de tu rol con el administrador.`,
    );
  }
  return userId;
}

/** Leer las compras: «viewPurchasing» o «managePurchasing» bastan. */
export async function requireReading(ctx: QueryCtx): Promise<Id<"users">> {
  const userId = await requireUser(ctx);
  const user = await ctx.db.get(userId);
  if (
    !user ||
    !(await hasAnyCapability(ctx, user, ["viewPurchasing", "managePurchasing"]))
  ) {
    throw new ConvexError(
      "No tienes permisos para ver las compras. Revisa la configuración de tu rol con el administrador.",
    );
  }
  return userId;
}

/** Nombre visible de quien firma una decisión de compra. */
export async function actorName(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<string> {
  const user = await ctx.db.get(userId);
  return user?.name || user?.email || "Responsable de repuestos";
}

/**
 * Lo que hace una recepción, escrito una sola vez: el albarán, el stock que
 * entra, el estado de la orden —completada si ha llegado todo, parcial si falta
 * algo— y las peticiones que ya se pueden entregar.
 *
 * Lo comparten el botón «Recepcionar» de la ficha (`purchasing.receive`) y la
 * muestra de compras (`seedPurchasing`), que necesita dejar una orden a medias
 * con las mismas consecuencias que una recepción de verdad: sin esto, los datos
 * de ejemplo podrían contar una historia que el taller nunca produce.
 *
 * `at` es cuándo pasó: la recepción de verdad, ahora; la de la muestra, el día
 * que le toque.
 */
export async function applyReception(
  ctx: MutationCtx,
  args: {
    orderId: Id<"purchaseOrders">;
    /** Lo que ha llegado, por petición de compra de la orden. */
    items: { purchaseRequestId: Id<"purchaseRequests">; quantity: number }[];
    deliveryNote: DeliveryNote;
    note?: string;
    receivedBy: string;
    at: number;
  },
): Promise<{
  status: Doc<"purchaseOrders">["status"];
  received: {
    sparePartId: Id<"spareParts">;
    code: string;
    name: string;
    quantity: number;
  }[];
  materialReceived: string[];
  /** Quiénes pidieron lo que ya se puede entregar, para avisarles. */
  requesterIds: Id<"users">[];
}> {
  const order = await ctx.db.get(args.orderId);
  if (!order) throw new ConvexError("La orden ya no existe.");
  if (!canAdvancePurchaseOrder(order.status, "receive")) {
    throw new ConvexError(
      order.status === PURCHASE_ORDER_STATUSES.CANCELLED
        ? `La orden ${order.reference} está anulada: no se recepciona nada de ella.`
        : `La orden ${order.reference} ya está completada: no queda nada por recibir.`,
    );
  }

  const note = args.deliveryNote.name.trim();
  if (!note) {
    throw new ConvexError("El albarán necesita un nombre para poder abrirlo.");
  }
  if ((await ctx.storage.getUrl(args.deliveryNote.storageId)) === null) {
    throw new ConvexError(
      "El albarán adjunto ya no está disponible: vuelve a adjuntarlo.",
    );
  }

  // Se comprueba **todo** antes de tocar nada: media recepción no deja ni la
  // orden ni el almacén a medias.
  const wanted = new Map<string, number>();
  for (const item of args.items) {
    const cantidad = Math.trunc(item.quantity);
    if (cantidad <= 0) continue;
    const line = order.lines.find(
      (row) => row.purchaseRequestId === item.purchaseRequestId,
    );
    if (!line) {
      throw new ConvexError(
        `Ese artículo no está en la orden ${order.reference}.`,
      );
    }
    const pendiente = line.quantity - line.receivedQuantity;
    if (cantidad > pendiente) {
      throw new ConvexError(
        `${line.code}: solo faltan ${pendiente} ${line.unit} por recibir de esta orden.`,
      );
    }
    wanted.set(
      item.purchaseRequestId,
      (wanted.get(item.purchaseRequestId) ?? 0) + cantidad,
    );
  }
  if (wanted.size === 0) {
    throw new ConvexError("No has dicho qué ha llegado.");
  }

  const now = args.at;
  const received: {
    sparePartId: Id<"spareParts">;
    code: string;
    name: string;
    quantity: number;
  }[] = [];
  const lines = [];
  for (const line of order.lines) {
    const cantidad = wanted.get(line.purchaseRequestId) ?? 0;
    if (cantidad > 0) {
      // El material entra en el almacén: es un movimiento de entrada, no un
      // ajuste de stock a mano.
      const part = await ctx.db.get(line.sparePartId);
      if (!part) {
        throw new ConvexError(
          `El repuesto ${line.code} ya no está en el catálogo: no se puede dar entrada.`,
        );
      }
      await ctx.db.patch(part._id, {
        stock: part.stock + cantidad,
        updatedAt: now,
      });
      received.push({
        sparePartId: part._id,
        code: line.code,
        name: line.name,
        quantity: cantidad,
      });
    }
    lines.push({
      ...line,
      receivedQuantity: line.receivedQuantity + cantidad,
    });
  }

  await ctx.db.insert("receptions", {
    orderId: order._id,
    orderReference: order.reference,
    supplier: order.supplier,
    lines: received,
    deliveryNote: {
      storageId: args.deliveryNote.storageId,
      name: note,
      kind: args.deliveryNote.kind,
    },
    ...(args.note?.trim() ? { note: args.note.trim() } : {}),
    receivedBy: args.receivedBy,
    receivedAt: now,
  });

  // Completada o parcial según lo que haya llegado de cada artículo: es la
  // regla de la orden (`lib/purchaseFlow`), la misma que consultan los botones
  // de la ficha para ofrecer «Recepcionar».
  const status = purchaseOrderStatusAfterReceiving(lines);
  await ctx.db.patch(order._id, {
    lines,
    status,
    ...(status === PURCHASE_ORDER_STATUSES.COMPLETED
      ? { completedAt: now }
      : {}),
    updatedAt: now,
  });

  // Las peticiones de compra que ya han llegado enteras se cierran solas.
  const closed: Id<"partRequests">[] = [];
  for (const line of lines) {
    const recibido = line.receivedQuantity >= line.quantity;
    const row = await ctx.db.get(line.purchaseRequestId);
    if (!row) continue;
    // Ha llegado todo lo que pedía: se cierra sola (la regla, en
    // `lib/purchaseFlow`; una ya cerrada no se vuelve a cerrar).
    const settled = recibido ? purchaseRequestReceivedStatus(row.status) : null;
    if (settled !== null) {
      await ctx.db.patch(row._id, { status: settled, receivedAt: now });
      if (!closed.includes(row.requestId)) closed.push(row.requestId);
    }
  }

  // Y las peticiones de repuesto que ya tienen todo lo comprado pasan a
  // «material recibido». Mientras quede algo pendiente o en camino, no: la
  // petición sigue esperando.
  const materialReceived: string[] = [];
  const requesterIds: Id<"users">[] = [];
  for (const requestId of closed) {
    const delPedido = await ctx.db
      .query("purchaseRequests")
      .withIndex("by_request", (q) => q.eq("requestId", requestId))
      .collect();
    // Mientras quede algo sin tratar o en camino, no: la petición sigue
    // esperando material (`lib/purchaseFlow`).
    const waiting = delPedido.some(isPurchaseRequestAwaitingDelivery);
    if (waiting) continue;
    const request = await ctx.db.get(requestId);
    if (!request) continue;
    // Desde qué estados se pasa a «material recibido» lo dice la máquina de la
    // petición (`lib/requestFlow`), la misma que consultan el resto de pasos y
    // los botones de la ficha. Aquí, además, lo que no encaja se salta sin
    // ruido: esto es una pasada sobre lo que acaba de entrar, no una decisión de
    // nadie.
    const settled = nextRequestStatus(request.status, "receiveMaterial");
    if (settled === null) continue;
    await ctx.db.patch(requestId, {
      status: settled,
      decisionNote: `Material recibido de ${order.supplier} (orden ${order.reference}).`,
    });
    materialReceived.push(request.reference);
    if (request.requesterId && !requesterIds.includes(request.requesterId)) {
      requesterIds.push(request.requesterId);
    }
  }

  return { status, received, materialReceived, requesterIds };
}

/** El proveedor con el que se agrupa: si el repuesto no dice ninguno, se pide. */
export const NO_SUPPLIER = "Sin proveedor";

/**
 * Las líneas de una petición que el almacén **no** puede cubrir: las que piden
 * más de lo que hay (los repuestos nuevos nacen con stock cero, así que entran
 * por aquí solas). Devuelve también por qué falta cada una, que es lo que se
 * apunta en la petición de compra.
 */
export type MissingLine = {
  sparePartId: Id<"spareParts">;
  code: string;
  name: string;
  unit: string;
  supplier: string;
  quantity: number;
  reason: "noStock" | "newPart";
};

export async function missingLines(
  ctx: QueryCtx,
  request: {
    lines: { sparePartId: Id<"spareParts">; quantity: number }[];
  },
  only?: Id<"spareParts">[],
): Promise<MissingLine[]> {
  const wanted = only ? new Set(only) : null;
  const missing: MissingLine[] = [];
  for (const line of request.lines) {
    if (wanted && !wanted.has(line.sparePartId)) continue;
    const part = await ctx.db.get(line.sparePartId);
    if (!part) {
      throw new ConvexError(
        `El repuesto ${line.sparePartId} ya no está en el catálogo: no se puede comprar.`,
      );
    }
    const falta = line.quantity - part.stock;
    if (falta <= 0) continue;
    missing.push({
      sparePartId: part._id,
      code: part.code,
      name: part.name,
      unit: part.unit,
      supplier: part.supplier?.trim() || NO_SUPPLIER,
      quantity: falta,
      // Un repuesto recién dado de alta en la petición nace sin stock: no es
      // que se haya agotado, es que nunca ha estado en el almacén.
      reason: part.stock === 0 ? "newPart" : "noStock",
    });
  }
  return missing;
}
