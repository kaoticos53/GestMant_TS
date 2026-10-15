import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation } from "./_generated/server";
import { notifyUsers } from "./notify";
import { freeReference } from "./references";
import {
  canAdvancePurchaseOrder,
  isPurchaseOrderClosed,
  isPurchaseRequestAwaitingDelivery,
  isPurchaseRequestClosed,
  isPurchaseRequestUntreated,
  nextPurchaseRequestStatus,
  purchaseOrderStatusAfterReceiving,
  purchaseRequestReceivedStatus,
} from "../lib/purchaseFlow";
import { canBuyForRequest, nextRequestStatus } from "../lib/requestFlow";
import {
  PURCHASE_ORDER_STATUSES,
  PURCHASE_REQUEST_STATUSES,
} from "./schema";

import {
  actorName,
  missingLines,
  NO_SUPPLIER,
  requirePurchasing,
} from "./purchasing/helpers";

/* ------------------------------------------------------------------ */
/* Re-exportaciones de sub-módulos CQS (queries y subida)             */
/* ------------------------------------------------------------------ */

export {
  listPurchaseRequests,
  listOrders,
  listReceptions,
  byRequest,
  generateUploadUrl,
} from "./purchasing/queries";

/**
 * Genera las peticiones de compra de una petición de repuesto: una por cada
 * línea que el almacén no cubre (o solo las que se le digan). Es el paso que da
 * el responsable cuando no hay material que apartar.
 *
 * Si de una línea ya había una petición de compra viva, no se repite: se cuenta
 * aparte, para poder decir «de estas dos ya se estaba ocupando alguien».
 */
export const requestPurchase = mutation({
  args: {
    requestId: v.id("partRequests"),
    /** Solo estas líneas (por repuesto); sin esto, todas las que falten. */
    sparePartIds: v.optional(v.array(v.id("spareParts"))),
    /** Proveedor para todas las líneas, cuando no es el del catálogo. */
    supplier: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requirePurchasing(ctx, "generar peticiones de compra");
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new ConvexError("La petición ya no existe.");
    if (request.archivedAt !== undefined) {
      throw new ConvexError(
        `La petición ${request.reference} está archivada: recupérala antes de comprar nada para ella.`,
      );
    }
    // Para qué peticiones se puede comprar lo dice la máquina de la petición
    // (`lib/requestFlow`): las que aún esperan decisión.
    if (!canBuyForRequest(request.status)) {
      throw new ConvexError(
        `La petición ${request.reference} ya está resuelta (${request.status}): no hay nada que comprar para ella.`,
      );
    }

    const missing = await missingLines(ctx, request, args.sparePartIds);
    if (missing.length === 0) {
      throw new ConvexError(
        `El almacén cubre todo lo que pide ${request.reference}: no hace falta comprar nada.`,
      );
    }

    const supplier = args.supplier?.trim() || "";
    if (args.supplier !== undefined && !supplier) {
      throw new ConvexError("Escribe el proveedor o déjalo en blanco.");
    }

    const previous = await ctx.db
      .query("purchaseRequests")
      .withIndex("by_request", (q) => q.eq("requestId", args.requestId))
      .collect();

    const created: string[] = [];
    let repeated = 0;
    const now = Date.now();
    for (const line of missing) {
      // Lo que ya está en camino no se aparta otra vez: cuántas van se cuenta
      // aparte, para poder decirlo.
      const already = previous.find(
        (row) =>
          row.sparePartId === line.sparePartId &&
          isPurchaseRequestAwaitingDelivery(row),
      );
      if (already) {
        repeated += 1;
        continue;
      }
      const reference = await freeReference(ctx, "purchaseRequest");
      await ctx.db.insert("purchaseRequests", {
        reference,
        requestId: request._id,
        requestReference: request.reference,
        requestDate: request.createdAt,
        requesterName: request.requesterName,
        sparePartId: line.sparePartId,
        code: line.code,
        name: line.name,
        unit: line.unit,
        quantity: line.quantity,
        supplier: supplier || line.supplier,
        status: PURCHASE_REQUEST_STATUSES.PENDING,
        reason: line.reason,
        ...(args.notes?.trim() ? { notes: args.notes.trim() } : {}),
        requestedAt: now,
        requestedBy: await actorName(ctx, userId),
        createdAt: now,
      });
      created.push(reference);
    }

    if (created.length === 0) {
      throw new ConvexError(
        `Ya había una petición de compra viva para todo lo que falta de ${request.reference}.`,
      );
    }

    return { references: created, repeated };
  },
});

/** Cambia el proveedor de una petición de compra sin tratar (para agruparla). */
export const setSupplier = mutation({
  args: { id: v.id("purchaseRequests"), supplier: v.string() },
  handler: async (ctx, args) => {
    await requirePurchasing(ctx, "cambiar el proveedor de una compra");
    const row = await ctx.db.get(args.id);
    if (!row) throw new ConvexError("La petición de compra ya no existe.");
    if (!isPurchaseRequestUntreated(row.status)) {
      throw new ConvexError(
        `La petición de compra ${row.reference} ya está en una orden: su proveedor no se cambia desde aquí.`,
      );
    }
    const supplier = args.supplier.trim();
    if (!supplier) {
      throw new ConvexError("Indica el proveedor con el que se agrupa.");
    }
    await ctx.db.patch(args.id, { supplier });
  },
});

/** La nota de una petición de compra mientras espera o está en una orden. */
export const setNote = mutation({
  args: { id: v.id("purchaseRequests"), notes: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requirePurchasing(ctx, "anotar una petición de compra");
    const row = await ctx.db.get(args.id);
    if (!row) throw new ConvexError("La petición de compra ya no existe.");
    if (isPurchaseRequestClosed(row.status)) {
      throw new ConvexError(
        `La petición de compra ${row.reference} ya está cerrada: su nota no se toca.`,
      );
    }
    await ctx.db.patch(args.id, {
      notes: args.notes?.trim() ? args.notes.trim() : undefined,
    });
  },
});

/**
 * Retira una petición de compra que todavía no está en ninguna orden: ya no se
 * compra. Lo que esté dentro de una orden no se retira desde aquí (para eso se
 * anula la orden, que devuelve sus peticiones a la cola).
 */
export const cancelPurchaseRequest = mutation({
  args: { id: v.id("purchaseRequests"), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requirePurchasing(ctx, "retirar una petición de compra");
    const row = await ctx.db.get(args.id);
    if (!row) throw new ConvexError("La petición de compra ya no existe.");
    const cancelled = nextPurchaseRequestStatus(row.status, "cancel");
    if (cancelled === null) {
      throw new ConvexError(
        `La petición de compra ${row.reference} ya no está sin tratar: quítala desde su orden, o déjala como está.`,
      );
    }
    if (!args.note?.trim()) {
      throw new ConvexError(
        "Escribe por qué se retira: es lo que queda en la ficha de la compra.",
      );
    }
    await ctx.db.patch(args.id, {
      status: cancelled,
      cancelledAt: Date.now(),
      cancelNote: args.note.trim(),
    });
  },
});

/* ------------------------------------------------------------------ */
/* La orden que se manda al proveedor                                  */
/* ------------------------------------------------------------------ */

/**
 * Monta a mano una orden con las peticiones de compra de **un** proveedor. Ahí
 * se decide qué se compra y en qué orden, con una nota por artículo si hace
 * falta. La orden queda con su número y su fecha, y con las peticiones que la
 * han generado dentro (cada una con la suya).
 */
export const createOrder = mutation({
  args: {
    purchaseRequestIds: v.array(v.id("purchaseRequests")),
    notes: v.optional(v.string()),
    /** Nota de cada artículo, por petición de compra. */
    lineNotes: v.optional(v.record(v.string(), v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await requirePurchasing(ctx, "crear órdenes de compra");
    const ids = [...new Set(args.purchaseRequestIds)];
    if (ids.length === 0) {
      throw new ConvexError(
        "Elige al menos una petición de compra para la orden.",
      );
    }

    const rows = [];
    for (const id of ids) {
      const row = await ctx.db.get(id);
      if (!row) {
        throw new ConvexError(
          "Una de las peticiones de compra ya no existe: vuelve a mirar el grupo.",
        );
      }
      if (nextPurchaseRequestStatus(row.status, "order") === null) {
        throw new ConvexError(
          `La petición de compra ${row.reference} ya está en una orden o cerrada.`,
        );
      }
      rows.push(row);
    }

    const suppliers = [...new Set(rows.map((row) => row.supplier))];
    if (suppliers.length > 1) {
      throw new ConvexError(
        `Una orden es de un solo proveedor y has mezclado ${suppliers.join(", ")}.`,
      );
    }
    const supplier = suppliers[0];

    const now = Date.now();
    const reference = await freeReference(ctx, "purchaseOrder");
    const by = await actorName(ctx, userId);
    const orderId = await ctx.db.insert("purchaseOrders", {
      reference,
      supplier,
      status: PURCHASE_ORDER_STATUSES.PENDING,
      orderedAt: now,
      orderedBy: by,
      requestRefs: [
        ...new Map(
          rows.map((row) => [
            row.requestReference,
            { reference: row.requestReference, requestedAt: row.requestDate },
          ]),
        ).values(),
      ].sort((a, b) => a.requestedAt - b.requestedAt),
      lines: rows.map((row) => ({
        purchaseRequestId: row._id,
        requestId: row.requestId,
        requestReference: row.requestReference,
        requestDate: row.requestDate,
        sparePartId: row.sparePartId,
        code: row.code,
        name: row.name,
        unit: row.unit,
        quantity: row.quantity,
        receivedQuantity: 0,
        ...(args.lineNotes?.[row._id]?.trim()
          ? { note: args.lineNotes[row._id].trim() }
          : row.notes?.trim()
            ? { note: row.notes.trim() }
            : {}),
      })),
      ...(args.notes?.trim() ? { notes: args.notes.trim() } : {}),
      createdAt: now,
      updatedAt: now,
    });

    for (const row of rows) {
      await ctx.db.patch(row._id, {
        // Lo que acaba de comprobarse arriba: desde «sin tratar» se entra en una
        // orden (`lib/purchaseFlow`).
        status: nextPurchaseRequestStatus(row.status, "order") ?? row.status,
        orderId,
        orderedAt: now,
      });
    }

    return { reference, orderId, lines: rows.length };
  },
});

/** Anota un artículo de una orden (mientras no esté cerrada). */
export const setLineNote = mutation({
  args: {
    orderId: v.id("purchaseOrders"),
    purchaseRequestId: v.id("purchaseRequests"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requirePurchasing(ctx, "anotar un artículo de una orden");
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new ConvexError("La orden ya no existe.");
    if (isPurchaseOrderClosed(order.status)) {
      throw new ConvexError(
        `La orden ${order.reference} está cerrada: sus artículos ya no se tocan.`,
      );
    }
    const note = args.note?.trim();
    const lines = order.lines.map((line) =>
      line.purchaseRequestId === args.purchaseRequestId
        ? { ...line, note: note ? note : undefined }
        : line,
    );
    if (
      !lines.some((line) => line.purchaseRequestId === args.purchaseRequestId)
    ) {
      throw new ConvexError(
        `Ese artículo no está en la orden ${order.reference}.`,
      );
    }
    await ctx.db.patch(args.orderId, { lines, updatedAt: Date.now() });
  },
});

/**
 * Recepciona material de una orden: lo que ha llegado, con su **albarán de
 * entrega** adjunto (obligatorio: es el papel que lo respalda).
 *
 * De aquí salen tres cosas: el movimiento de recepción con el albarán, el stock
 * que entra en el catálogo y el estado de la orden —completada si ha llegado
 * todo, parcial si falta algo—. Y las peticiones de repuesto que ya tienen todo
 * lo comprado pasan a «material recibido», que es lo que las desatasca.
 */
export const receive = mutation({
  args: {
    orderId: v.id("purchaseOrders"),
    items: v.array(
      v.object({
        purchaseRequestId: v.id("purchaseRequests"),
        quantity: v.number(),
      }),
    ),
    deliveryNote: v.object({
      storageId: v.id("_storage"),
      name: v.string(),
      kind: v.union(v.literal("image"), v.literal("document")),
    }),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requirePurchasing(ctx, "recepcionar material");
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
      throw new ConvexError(
        "El albarán necesita un nombre para poder abrirlo.",
      );
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

    const now = Date.now();
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
      receivedBy: await actorName(ctx, userId),
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
      const settled = recibido
        ? purchaseRequestReceivedStatus(row.status)
        : null;
      if (settled !== null) {
        await ctx.db.patch(row._id, { status: settled, receivedAt: now });
        if (!closed.includes(row.requestId)) closed.push(row.requestId);
      }
    }

    // Y las peticiones de repuesto que ya tienen todo lo comprado pasan a
    // «material recibido». Mientras quede algo pendiente o en camino, no: la
    // petición sigue esperando.
    const materialReceived: string[] = [];
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
      const received = nextRequestStatus(request.status, "receiveMaterial");
      if (received === null) continue;
      await ctx.db.patch(requestId, {
        status: received,
        decisionNote: `Material recibido de ${order.supplier} (orden ${order.reference}).`,
      });
      materialReceived.push(request.reference);
    }

    if (materialReceived.length > 0) {
      const ids = (
        await Promise.all(closed.map((requestId) => ctx.db.get(requestId)))
      )
        .filter((request) => request !== null)
        .map((request) => request.requesterId)
        .filter((id): id is Id<"users"> => Boolean(id));
      await notifyUsers(
        ctx,
        ids,
        `Material recibido: ${materialReceived.join(", ")} ya se puede entregar`,
        undefined,
        userId,
      );
    }

    return {
      status,
      received,
      materialReceived,
    };
  },
});

/**
 * Anula una orden que todavía no está completa (un error, un proveedor que ya
 * no sirve). Sus peticiones de compra **vuelven a la cola** —las que no hayan
 * llegado, que el material ya recibido no se devuelve solo—, para poder
 * montarlas otra vez.
 */
export const cancelOrder = mutation({
  args: { orderId: v.id("purchaseOrders"), note: v.string() },
  handler: async (ctx, args) => {
    await requirePurchasing(ctx, "anular órdenes de compra");
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new ConvexError("La orden ya no existe.");
    // Una anulada se queda como está —anular dos veces no es un error—, y de una
    // completada no se anula nada: lo dice la máquina de la orden.
    if (!canAdvancePurchaseOrder(order.status, "cancel")) {
      if (order.status === PURCHASE_ORDER_STATUSES.CANCELLED)
        return { returned: 0 };
      throw new ConvexError(
        `La orden ${order.reference} ya está completada: no hay nada que anular.`,
      );
    }
    const note = args.note.trim();
    if (!note) {
      throw new ConvexError("Escribe por qué se anula la orden.");
    }

    let returned = 0;
    for (const line of order.lines) {
      const row = await ctx.db.get(line.purchaseRequestId);
      if (!row) continue;
      // La vuelta a la cola: solo las que estaban dentro de la orden —lo que ya
      // había llegado no se devuelve solo—.
      const pending = nextPurchaseRequestStatus(row.status, "unorder");
      if (pending === null) continue;
      await ctx.db.patch(row._id, {
        status: pending,
        orderId: undefined,
        orderedAt: undefined,
      });
      returned += 1;
    }

    await ctx.db.patch(order._id, {
      status: PURCHASE_ORDER_STATUSES.CANCELLED,
      cancelledAt: Date.now(),
      cancelNote: note,
      updatedAt: Date.now(),
    });

    return { returned };
  },
});
