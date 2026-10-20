import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, type MutationCtx } from "./_generated/server";
import { notifyUsers } from "./notify";
import { freeReference } from "./references";
import {
  canAdvancePurchaseOrder,
  isPurchaseOrderClosed,
  isPurchaseRequestAwaitingDelivery,
  isPurchaseRequestClosed,
  isPurchaseRequestUntreated,
  nextPurchaseRequestStatus,
} from "../lib/purchaseFlow";
import { canBuyForRequest } from "../lib/requestFlow";
import {
  PURCHASE_ORDER_STATUSES,
  PURCHASE_REQUEST_STATUSES,
} from "./schema";

import {
  actorName,
  applyReception,
  missingLines,
  requirePurchasing,
} from "./_purchasing/helpers";

/* ------------------------------------------------------------------ */
/* Re-exportaciones de sub-módulos CQS (queries y subida)             */
/* ------------------------------------------------------------------ */

export {
  listPurchaseRequests,
  listOrders,
  listReceptions,
  byRequest,
  generateUploadUrl,
} from "./_purchasing/queries";

/**
 * Aparta las líneas que faltan de una petición de repuesto como peticiones de
 * compra. Lo comparten la acción de una en una y la de varias a la vez, para que
 * no puedan contar cosas distintas.
 *
 * Lo que ya está en camino no se aparta otra vez: cuántas van se cuenta aparte,
 * para poder decir «de estas dos ya se estaba ocupando alguien».
 */
async function apartarLineas(
  ctx: MutationCtx,
  request: Doc<"partRequests">,
  userId: Id<"users">,
  options: {
    sparePartIds?: Id<"spareParts">[];
    supplier?: string;
    notes?: string;
  },
): Promise<{ created: string[]; repeated: number }> {
  const missing = await missingLines(ctx, request, options.sparePartIds);
  const supplier = options.supplier?.trim() || "";

  const previous = await ctx.db
    .query("purchaseRequests")
    .withIndex("by_request", (q) => q.eq("requestId", request._id))
    .collect();

  const created: string[] = [];
  let repeated = 0;
  const now = Date.now();
  const requestedBy = await actorName(ctx, userId);
  for (const line of missing) {
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
      ...(options.notes?.trim() ? { notes: options.notes.trim() } : {}),
      requestedAt: now,
      requestedBy,
      createdAt: now,
    });
    created.push(reference);
  }
  return { created, repeated };
}

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

    if (args.supplier !== undefined && !args.supplier.trim()) {
      throw new ConvexError("Escribe el proveedor o déjalo en blanco.");
    }

    const { created, repeated } = await apartarLineas(ctx, request, userId, {
      sparePartIds: args.sparePartIds,
      supplier: args.supplier,
      notes: args.notes,
    });

    if (created.length === 0) {
      throw new ConvexError(
        `Ya había una petición de compra viva para todo lo que falta de ${request.reference}.`,
      );
    }

    return { references: created, repeated };
  },
});

/**
 * La misma apartada, para varias peticiones de repuesto de una vez: es lo que
 * pide la cola de «Sin material en el almacén», donde antes había un botón por
 * fila y nueve clics para preparar la compra del día.
 *
 * Lo que no se puede apartar no tumba el resto: se cuenta aparte y se devuelve
 * con su motivo —la petición ya está resuelta, el almacén ya la cubre, ya había
 * una compra viva—, para que la pantalla lo diga en vez de dejar al responsable
 * con un error y sin saber cuáles quedaron fuera.
 *
 * Todo va en una sola mutación: o entran todas las que se pueden, o no entra
 * ninguna (Convex la revierte entera si algo falla de verdad).
 */
export const requestPurchases = mutation({
  args: {
    requestIds: v.array(v.id("partRequests")),
  },
  handler: async (ctx, args) => {
    const userId = await requirePurchasing(ctx, "generar peticiones de compra");
    const ids = [...new Set(args.requestIds)];
    if (ids.length === 0) {
      throw new ConvexError("Elige al menos una petición para comprar.");
    }

    const references: string[] = [];
    const skipped: { reference: string; reason: string }[] = [];
    let requests = 0;
    let repeated = 0;

    for (const id of ids) {
      const request = await ctx.db.get(id);
      if (!request) {
        skipped.push({ reference: id, reason: "ya no existe" });
        continue;
      }
      if (request.archivedAt !== undefined) {
        skipped.push({
          reference: request.reference,
          reason: "está archivada: recupérala antes de comprar nada para ella",
        });
        continue;
      }
      // Para qué peticiones se puede comprar lo dice la máquina (`lib/requestFlow`).
      if (!canBuyForRequest(request.status)) {
        skipped.push({
          reference: request.reference,
          reason: `ya está resuelta (${request.status}): no hay nada que comprar para ella`,
        });
        continue;
      }
      if ((await missingLines(ctx, request)).length === 0) {
        skipped.push({
          reference: request.reference,
          reason: "el almacén ya cubre lo que pide",
        });
        continue;
      }

      const result = await apartarLineas(ctx, request, userId, {});
      repeated += result.repeated;
      if (result.created.length === 0) {
        skipped.push({
          reference: request.reference,
          reason: "ya había una petición de compra viva para todo lo que falta",
        });
        continue;
      }
      references.push(...result.created);
      requests += 1;
    }

    return { references, requests, repeated, skipped };
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
    solicitudeCode: v.optional(v.string()),
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
      ...(args.solicitudeCode?.trim()
        ? { solicitudeCode: args.solicitudeCode.trim() }
        : {}),
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

/** Cambia el código de solicitud de compra externa de una orden. */
export const setSolicitudeCode = mutation({
  args: {
    orderId: v.id("purchaseOrders"),
    solicitudeCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requirePurchasing(ctx, "cambiar el código de la solicitud de compra");
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new ConvexError("La orden ya no existe.");
    const code = args.solicitudeCode?.trim();
    await ctx.db.patch(args.orderId, {
      solicitudeCode: code ? code : undefined,
      updatedAt: Date.now(),
    });
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
 * lo comprado pasan a «material recibido», que es lo que las desatasca. Todo eso
 * está en `applyReception`, que es también lo que usa la muestra de compras.
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

    const { status, received, materialReceived, requesterIds } =
      await applyReception(ctx, {
        orderId: args.orderId,
        items: args.items,
        deliveryNote: args.deliveryNote,
        note: args.note,
        receivedBy: await actorName(ctx, userId),
        at: Date.now(),
      });

    if (materialReceived.length > 0) {
      await notifyUsers(
        ctx,
        requesterIds,
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
