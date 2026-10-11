import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { MutationCtx, QueryCtx, mutation, query } from "./_generated/server";
import { hasAnyCapability, hasCapability } from "./permissions";
import { notifyUsers } from "./notify";

/**
 * Compras: lo que el almacén no puede cubrir.
 *
 * El camino, de principio a fin:
 *
 *   1. Una petición de repuesto pide algo que **no hay** (o un repuesto nuevo,
 *      que nace con stock cero). El responsable de repuestos no puede aprobarla:
 *      el almacén no tiene material que apartar.
 *   2. Así que **aparta la línea** y nace una *petición de compra* (`PC-…`) con
 *      el proveedor del repuesto. Mientras no se manda nada, espera ahí: la
 *      pantalla las agrupa por proveedor, que es como se compra.
 *   3. Con el grupo entero delante, el responsable monta a mano una **orden de
 *      compra** (`OC-…`) para ese proveedor. La orden lleva su número y su fecha,
 *      y cada artículo lo que pedía: de qué petición de repuesto sale y cuándo se
 *      pidió. A cada artículo se le puede añadir una nota.
 *   4. Cuando llega el material, el responsable **recepciona** con el **albarán
 *      de entrega** adjunto (sin él no hay entrada). Eso deja un *movimiento de
 *      recepción*, mete el stock en el catálogo y cierra la orden: **completada**
 *      si ha llegado todo, **parcial** si falta algo.
 *   5. Y eso se ve en las peticiones: las que ya tienen todo lo comprado pasan a
 *      **material recibido**, que sí se puede aprobar y entregar.
 *
 * Nada de esto decide por su cuenta: la orden la monta una persona, la entrada
 * la firma otra con un albarán delante y el estado de la orden lo cierran las
 * recepciones, no un botón.
 */

/** Toda la gestión de compras requiere sesión iniciada. */
async function requireUser(ctx: QueryCtx) {
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
async function requirePurchasing(ctx: QueryCtx, action: string) {
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
async function requireReading(ctx: QueryCtx) {
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
async function actorName(ctx: QueryCtx, userId: Id<"users">) {
  const user = await ctx.db.get(userId);
  return user?.name || user?.email || "Responsable de repuestos";
}

/**
 * El número que sigue para una serie («PC-0001», «OC-0002»). Se mira el más alto
 * ya usado y no cuántos hay: borrar una petición no reutiliza su número, que es
 * lo que se espera de un documento que se lee por su número.
 */
async function nextReference(
  ctx: MutationCtx,
  table: "purchaseRequests" | "purchaseOrders",
  prefix: string,
): Promise<string> {
  const rows = await ctx.db.query(table).collect();
  let max = 0;
  for (const row of rows) {
    const match = /^[A-Z]+-(\d+)$/.exec(row.reference);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `${prefix}-${String(max + 1).padStart(4, "0")}`;
}

/** El proveedor con el que se agrupa: si el repuesto no dice ninguno, se pide. */
const NO_SUPPLIER = "Sin proveedor";

/**
 * Las líneas de una petición que el almacén **no** puede cubrir: las que piden
 * más de lo que hay (los repuestos nuevos nacen con stock cero, así que entran
 * por aquí solas). Devuelve también por qué falta cada una, que es lo que se
 * apunta en la petición de compra.
 */
type MissingLine = {
  sparePartId: Id<"spareParts">;
  code: string;
  name: string;
  unit: string;
  supplier: string;
  quantity: number;
  reason: "noStock" | "newPart";
};

async function missingLines(
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

/* ------------------------------------------------------------------ */
/* Lo que se puede leer                                                */
/* ------------------------------------------------------------------ */

/**
 * Las peticiones de compra, con el grupo por proveedor que necesita la pantalla:
 * las **sin tratar** (pendientes) agrupadas por proveedor, que es el montón del
 * que sale cada orden. `status` y `supplier` filtran la lista larga.
 */
export const listPurchaseRequests = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("ordered"),
        v.literal("received"),
        v.literal("cancelled"),
      ),
    ),
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
      if (row.status !== "pending") continue;
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
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("partial"),
        v.literal("completed"),
        v.literal("cancelled"),
      ),
    ),
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
    const sorted = rows.sort((a, b) => b.receivedAt - a.receivedAt);
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

/* ------------------------------------------------------------------ */
/* Apartar lo que hay que comprar                                      */
/* ------------------------------------------------------------------ */

/** URL de subida para el albarán de una recepción. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requirePurchasing(ctx, "adjuntar albaranes");
    return await ctx.storage.generateUploadUrl();
  },
});

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
    if (
      request.status === "approved" ||
      request.status === "issued" ||
      request.status === "rejected" ||
      request.status === "cancelled" ||
      request.status === "returned"
    ) {
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
      const already = previous.find(
        (row) =>
          row.sparePartId === line.sparePartId &&
          row.status !== "cancelled" &&
          row.receivedAt === undefined,
      );
      if (already) {
        repeated += 1;
        continue;
      }
      const reference = await nextReference(ctx, "purchaseRequests", "PC");
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
        status: "pending",
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
    if (row.status !== "pending") {
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
    if (row.status === "received" || row.status === "cancelled") {
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
    if (row.status !== "pending") {
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
      status: "cancelled",
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
      if (row.status !== "pending") {
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
    const reference = await nextReference(ctx, "purchaseOrders", "OC");
    const by = await actorName(ctx, userId);
    const orderId = await ctx.db.insert("purchaseOrders", {
      reference,
      supplier,
      status: "pending",
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
        status: "ordered",
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
    if (order.status === "completed" || order.status === "cancelled") {
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
    if (order.status === "completed") {
      throw new ConvexError(
        `La orden ${order.reference} ya está completada: no queda nada por recibir.`,
      );
    }
    if (order.status === "cancelled") {
      throw new ConvexError(
        `La orden ${order.reference} está anulada: no se recepciona nada de ella.`,
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

    const complete = lines.every(
      (line) => line.receivedQuantity >= line.quantity,
    );
    await ctx.db.patch(order._id, {
      lines,
      status: complete ? "completed" : "partial",
      ...(complete ? { completedAt: now } : {}),
      updatedAt: now,
    });

    // Las peticiones de compra que ya han llegado enteras se cierran solas.
    const closed: Id<"partRequests">[] = [];
    for (const line of lines) {
      const recibido = line.receivedQuantity >= line.quantity;
      const row = await ctx.db.get(line.purchaseRequestId);
      if (!row) continue;
      if (recibido && row.status !== "received") {
        await ctx.db.patch(row._id, { status: "received", receivedAt: now });
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
      const waiting = delPedido.some(
        (row) => row.status === "pending" || row.status === "ordered",
      );
      if (waiting) continue;
      const request = await ctx.db.get(requestId);
      if (!request) continue;
      if (request.status === "materialReceived") continue;
      if (
        request.status !== "pending" &&
        request.status !== "onHold" &&
        request.status !== "pendingSupplierQuote"
      ) {
        continue;
      }
      await ctx.db.patch(requestId, {
        status: "materialReceived",
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
      status: complete ? ("completed" as const) : ("partial" as const),
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
    if (order.status === "cancelled") return { returned: 0 };
    if (order.status === "completed") {
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
      if (!row || row.status !== "ordered") continue;
      await ctx.db.patch(row._id, {
        status: "pending",
        orderId: undefined,
        orderedAt: undefined,
      });
      returned += 1;
    }

    await ctx.db.patch(order._id, {
      status: "cancelled",
      cancelledAt: Date.now(),
      cancelNote: note,
      updatedAt: Date.now(),
    });

    return { returned };
  },
});
