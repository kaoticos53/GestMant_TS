import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import {
  SAMPLE_DELIVERY_NOTES,
  SAMPLE_PURCHASES,
  planPurchasingSample,
  sampleDeliveryNotePdf,
} from "../lib/samplePurchasing";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { hasCapability } from "./permissions";
import { freeReference } from "./references";
import {
  PURCHASE_ORDER_STATUSES,
  PURCHASE_REQUEST_STATUSES,
  REQUEST_STATUSES,
} from "./schema";
import { applyReception } from "./_purchasing/helpers";

/**
 * La muestra de compras: peticiones de repuesto que el almacén no cubre,
 * apartadas de varias maneras para poder mirar el módulo con contenido de
 * verdad —cinco proveedores esperando orden, una orden servida a medias con sus
 * albaranes y otra que ya entró entera—.
 *
 * Va en dos mitades porque los albaranes son archivos: la acción los guarda en
 * el almacén de Convex y la mutación interna escribe el resto. Es el mismo
 * reparto que `seed.ts` hace con las fotos y los manuales.
 *
 * Lo que se compra sale de lo que hay en el almacén (`planPurchasingSample`),
 * así que la muestra se puede volver a cargar sin que las cuentas se crucen. Y
 * las recepciones pasan por `applyReception`, el mismo código que el botón
 * «Recepcionar»: el stock, los estados y las peticiones que quedan entregables
 * se mueven igual que en el taller.
 */

const H = 60 * 60 * 1000;
const DAY = 24 * H;

const SEED_SESSION_MESSAGE =
  "Debes iniciar sesión para cargar los datos de ejemplo.";

const SEED_PERMISSION_MESSAGE =
  "No tienes permisos para cargar los datos de ejemplo. Necesitas la capacidad de gestionar las compras.";

/** Quién puede cargar la muestra de compras: quien compra material. */
async function requireBuyer(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<Doc<"users">> {
  const user = await ctx.db.get(userId);
  if (!user || user.active === false || user.isAnonymous === true) {
    throw new ConvexError(SEED_SESSION_MESSAGE);
  }
  if (!(await hasCapability(ctx, user, "managePurchasing"))) {
    throw new ConvexError(SEED_PERMISSION_MESSAGE);
  }
  return user;
}

/** La acción solo puede preguntar por una consulta interna. */
export const canSeedPurchasing = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireBuyer(ctx, args.userId);
    return true;
  },
});

export const seedPurchasingDemoData = action({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    requests: number;
    purchases: number;
    orders: number;
    receptions: number;
  }> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new ConvexError(SEED_SESSION_MESSAGE);
    await ctx.runQuery(internal.seedPurchasing.canSeedPurchasing, { userId });

    // Los albaranes se guardan antes de escribir nada: escribir es cosa de la
    // mutación, y guardar archivos solo se puede desde una acción.
    const albaranes: {
      storageId: Id<"_storage">;
      name: string;
      kind: "document";
    }[] = [];
    for (const note of SAMPLE_DELIVERY_NOTES) {
      const storageId = await ctx.storage.store(
        new Blob([sampleDeliveryNotePdf(note)], { type: "application/pdf" }),
      );
      albaranes.push({ storageId, name: note.name, kind: "document" });
    }

    return await ctx.runMutation(internal.seedPurchasing.recordSample, {
      userId,
      albaranes,
    });
  },
});

/** Escribe la muestra de punta a punta, en una sola transacción. */
export const recordSample = internalMutation({
  args: {
    userId: v.id("users"),
    albaranes: v.array(
      v.object({
        storageId: v.id("_storage"),
        name: v.string(),
        kind: v.union(v.literal("image"), v.literal("document")),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireBuyer(ctx, args.userId);
    const actor = user.name?.trim() || user.email?.trim() || "Coordinación";
    const now = Date.now();

    // El catálogo de la muestra tiene que estar: la compra cuelga de él.
    const parts = await ctx.db.query("spareParts").collect();
    const byCode = new Map(parts.map((part) => [part.code, part]));
    const codes = [
      ...new Set(
        SAMPLE_PURCHASES.flatMap((group) =>
          group.lines.map((line) => line.code),
        ),
      ),
    ];
    const missing = codes.filter((code) => !byCode.has(code));
    if (missing.length > 0) {
      throw new ConvexError(
        `Faltan repuestos de la muestra (${missing.join(", ")}): carga antes los datos de ejemplo del taller.`,
      );
    }

    const stock: Record<string, number> = {};
    for (const code of codes) stock[code] = byCode.get(code)?.stock ?? 0;
    const plan = planPurchasingSample(stock);

    const users = await ctx.db.query("users").collect();
    const technicians = users
      .filter((row) => row.active !== false && row._id !== user._id)
      .map((row) => row.name?.trim())
      .filter((name): name is string => Boolean(name));
    const equipmentDocs = await ctx.db.query("equipment").collect();
    const equipmentByCode = new Map(
      equipmentDocs
        .filter((doc) => doc.code)
        .map((doc) => [doc.code ?? "", doc] as const),
    );

    // 1. Las peticiones de repuesto y, de cada línea que el almacén no cubre, su
    //    petición de compra.
    const purchases: {
      id: Id<"purchaseRequests">;
      orderKey?: string;
      code: string;
    }[] = [];
    for (const request of plan.requests) {
      const createdAt = now - request.daysAgo * DAY;
      const reference = await freeReference(ctx, "partRequest");
      const requesterName =
        technicians[request.technician % Math.max(1, technicians.length)] ??
        actor;
      const equipmentDoc = request.equipment
        ? equipmentByCode.get(request.equipment)
        : undefined;
      const requestId = await ctx.db.insert("partRequests", {
        reference,
        requesterName,
        priority: request.priority,
        // Nadie la ha decidido todavía: es lo que deja la cola de material
        // recibido y la de «sin material» como las deja el taller.
        status: REQUEST_STATUSES.PENDING,
        lines: request.lines.map((line) => {
          const part = byCode.get(line.code);
          return {
            sparePartId: part?._id as Id<"spareParts">,
            code: part?.code ?? line.code,
            name: part?.name ?? line.code,
            quantity: line.requested,
          };
        }),
        ...(equipmentDoc
          ? { equipmentId: equipmentDoc._id, equipment: equipmentDoc.name }
          : {}),
        createdAt,
      });
      if (request.uncovered) continue;

      const requestedAt = createdAt + H;
      for (const line of request.lines) {
        const part = byCode.get(line.code);
        if (!part) continue;
        const purchaseReference = await freeReference(ctx, "purchaseRequest");
        const id = await ctx.db.insert("purchaseRequests", {
          reference: purchaseReference,
          requestId,
          requestReference: reference,
          requestDate: createdAt,
          requesterName,
          sparePartId: part._id,
          code: part.code,
          name: part.name,
          unit: part.unit,
          quantity: line.quantity,
          supplier: request.supplier,
          status: PURCHASE_REQUEST_STATUSES.PENDING,
          reason: line.reason,
          ...(line.note ? { notes: line.note } : {}),
          requestedAt,
          requestedBy: actor,
          createdAt: requestedAt,
        });
        purchases.push({
          id,
          ...(request.orderKey ? { orderKey: request.orderKey } : {}),
          code: part.code,
        });
      }
    }

    // 2. Las órdenes, con lo que esperaba por cada proveedor, y sus recepciones.
    const orders: string[] = [];
    let receptions = 0;
    for (const order of plan.orders) {
      const rows: Doc<"purchaseRequests">[] = [];
      for (const purchase of purchases) {
        if (purchase.orderKey !== order.key) continue;
        const row = await ctx.db.get(purchase.id);
        if (row) rows.push(row);
      }
      if (rows.length === 0) continue;

      const orderedAt = now - order.daysAgo * DAY;
      const reference = await freeReference(ctx, "purchaseOrder");
      const orderId = await ctx.db.insert("purchaseOrders", {
        reference,
        supplier: order.supplier,
        status: PURCHASE_ORDER_STATUSES.PENDING,
        orderedAt,
        orderedBy: actor,
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
          ...(row.notes?.trim() ? { note: row.notes.trim() } : {}),
        })),
        ...(order.solicitudeCode
          ? { solicitudeCode: order.solicitudeCode }
          : {}),
        ...(order.note ? { notes: order.note } : {}),
        createdAt: orderedAt,
        updatedAt: orderedAt,
      });
      for (const row of rows) {
        await ctx.db.patch(row._id, {
          status: PURCHASE_REQUEST_STATUSES.ORDERED,
          orderId,
          orderedAt,
        });
      }
      orders.push(reference);

      for (const reception of order.receptions) {
        const items = reception.items.map((item) => {
          const row = rows.find((candidate) => candidate.code === item.code);
          if (!row) {
            throw new Error(
              `La muestra recepciona ${item.code} en ${reference}, donde no se pidió.`,
            );
          }
          return { purchaseRequestId: row._id, quantity: item.quantity };
        });
        // La recepción es la de verdad —stock, estados y peticiones que ya se
        // pueden entregar—, solo que con la fecha que le toca.
        await applyReception(ctx, {
          orderId,
          items,
          deliveryNote: args.albaranes[reception.deliveryNote],
          ...(reception.note ? { note: reception.note } : {}),
          receivedBy: actor,
          at: now - reception.daysAgo * DAY,
        });
        receptions += 1;
      }
    }

    return {
      requests: plan.requests.length,
      purchases: purchases.length,
      orders: orders.length,
      receptions,
    };
  },
});
