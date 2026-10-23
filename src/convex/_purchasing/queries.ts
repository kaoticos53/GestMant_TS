import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
import { isPurchaseRequestUntreated } from "../../lib/purchaseFlow";
import {
  purchaseOrderStatusValidator,
  purchaseRequestStatusValidator,
} from "../schema";
import { secureMutation } from "../_auth/secureMutation";
import { requireReading } from "./helpers";

/**
 * Las peticiones de compra, con el grupo por proveedor que necesita la pantalla:
 * las **sin tratar** (pendientes) agrupadas por proveedor, que es el montón del
 * que sale cada orden. `status` y `supplier` filtran la lista larga.
 */
export const listPurchaseRequests = query({
  args: {
    // Los estados que se pueden filtrar son los de la tabla: se declaran una vez
    // en `schema.ts` y aquí se reutilizan, para que no haya dos listas que
    // puedan separarse (`tests/arquitectura.test.ts`).
    status: v.optional(purchaseRequestStatusValidator),
    supplier: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireReading(ctx);
    const all = args.status
      ? await ctx.db
          .query("purchaseRequests")
          .withIndex("by_status", (q) => q.eq("status", args.status!))
          .collect()
      : await ctx.db.query("purchaseRequests").collect();

    const requests = all
      .filter((row) => !args.supplier || row.supplier === args.supplier)
      .sort(
        (a, b) =>
          a.supplier.localeCompare(b.supplier, "es") ||
          a.createdAt - b.createdAt,
      );

    // Los grupos son las pendientes: lo que espera a que alguien monte la
    // orden. Se ordenan por proveedor y, dentro, por antigüedad (lo que lleva
    // más tiempo esperando va primero).
    const groups: {
      supplier: string;
      items: typeof requests;
      quantity: number;
      requests: number;
    }[] = [];
    for (const row of requests) {
      // «Sin tratar»: lo que espera a que alguien monte la orden, que es de donde
      // se puede pedir (`lib/purchaseFlow`).
      if (!isPurchaseRequestUntreated(row.status)) continue;
      const last = groups[groups.length - 1];
      if (last && last.supplier === row.supplier) {
        last.items.push(row);
        last.quantity += row.quantity;
        last.requests += 1;
      } else {
        groups.push({
          supplier: row.supplier,
          items: [row],
          quantity: row.quantity,
          requests: 1,
        });
      }
    }

    return { requests, groups };
  },
});

/** Las órdenes de compra, de la más reciente a la más antigua. */
export const listOrders = query({
  args: {
    // Igual que en las peticiones de compra: la tabla de estados de la orden es
    // la de `schema.ts`, no una copia local.
    status: v.optional(purchaseOrderStatusValidator),
  },
  handler: async (ctx, args) => {
    await requireReading(ctx);
    const orders = args.status
      ? await ctx.db
          .query("purchaseOrders")
          .withIndex("by_status", (q) => q.eq("status", args.status!))
          .collect()
      : await ctx.db.query("purchaseOrders").collect();
    return orders.sort((a, b) => b.orderedAt - a.orderedAt);
  },
});

/** Órdenes de compra paginadas con cursor para listas largas. */
export const paginatedOrders = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(purchaseOrderStatusValidator),
  },
  handler: async (ctx, args) => {
    await requireReading(ctx);
    if (args.status) {
      return await ctx.db
        .query("purchaseOrders")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .paginate(args.paginationOpts);
    }
    return await ctx.db
      .query("purchaseOrders")
      .withIndex("by_orderedAt")
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

/**
 * Los movimientos de recepción (con su albarán listo para abrir) y, si se pide
 * una orden concreta, solo los de esa orden.
 */
export const listReceptions = query({
  args: { orderId: v.optional(v.id("purchaseOrders")) },
  handler: async (ctx, args) => {
    await requireReading(ctx);
    const rows = args.orderId
      ? await ctx.db
          .query("receptions")
          .withIndex("by_order", (q) => q.eq("orderId", args.orderId!))
          .collect()
      : await ctx.db.query("receptions").collect();
    const sorted = rows.sort(
      (a, b) =>
        b.receivedAt - a.receivedAt || b._creationTime - a._creationTime,
    );
    return await Promise.all(
      sorted.map(async (row) => ({
        ...row,
        deliveryNoteUrl: await ctx.storage.getUrl(row.deliveryNote.storageId),
      })),
    );
  },
});

/**
 * Lo comprado para **una** petición de repuesto: sus peticiones de compra y las
 * órdenes en las que han entrado. Es lo que se lee en la ficha de la petición.
 */
export const byRequest = query({
  args: { requestId: v.id("partRequests") },
  handler: async (ctx, args) => {
    await requireReading(ctx);
    const requests = await ctx.db
      .query("purchaseRequests")
      .withIndex("by_request", (q) => q.eq("requestId", args.requestId))
      .collect();
    const orders: Doc<"purchaseOrders">[] = [];
    for (const request of requests) {
      if (!request.orderId) continue;
      if (orders.some((order) => order._id === request.orderId)) continue;
      const order = await ctx.db.get(request.orderId);
      if (order) orders.push(order);
    }
    const receptions = [];
    for (const order of orders) {
      const rows = await ctx.db
        .query("receptions")
        .withIndex("by_order", (q) => q.eq("orderId", order._id))
        .collect();
      for (const row of rows) {
        receptions.push({
          ...row,
          deliveryNoteUrl: await ctx.storage.getUrl(row.deliveryNote.storageId),
        });
      }
    }
    return {
      requests: requests.sort((a, b) => a.createdAt - b.createdAt),
      orders,
      receptions: receptions.sort((a, b) => b.receivedAt - a.receivedAt),
    };
  },
});

/** URL de subida para el albarán de una recepción. */
const generateUploadUrlArgs = {};

export const generateUploadUrl = mutation({
  args: generateUploadUrlArgs,
  handler: secureMutation(
    {
      capability: "managePurchasing",
      identityMessage:
        "Debes iniciar sesión con una cuenta registrada para gestionar las compras.",
      denyMessage:
        "No tienes permisos para adjuntar albaranes. Revisa la configuración de tu rol con el administrador.",
    },
    generateUploadUrlArgs,
    async (ctx) => {
      return await ctx.storage.generateUploadUrl();
    },
  ),
});
