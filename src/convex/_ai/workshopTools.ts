import { v } from "convex/values";
import { isClosedIncident } from "../../lib/incidentFlow";
import { richDocToPlainText } from "../../lib/richDoc";
import { internalQuery } from "../_generated/server";

const MAX_TOOL_RESULTS = 25;

function matchesQuery(fields: Array<string | undefined>, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === "") return true;
  return fields.some((f) => f !== undefined && f.toLowerCase().includes(q));
}

export const queryStats = internalQuery({
  args: {},
  handler: async (ctx) => {
    const [
      equipment,
      incidents,
      spareParts,
      partRequests,
      purchaseOrders,
      manuals,
    ] = await Promise.all([
      ctx.db.query("equipment").collect(),
      ctx.db.query("incidents").collect(),
      ctx.db.query("spareParts").collect(),
      ctx.db.query("partRequests").collect(),
      ctx.db.query("purchaseOrders").collect(),
      ctx.db.query("manuals").collect(),
    ]);

    const activeIncidents = incidents.filter((i) => i.deletedAt === undefined);
    const activeRequests = partRequests.filter((r) => r.deletedAt === undefined);

    return {
      equipment: equipment.length,
      incidents: activeIncidents.length,
      openIncidents: activeIncidents.filter((i) => !isClosedIncident(i.status))
        .length,
      spareParts: spareParts.length,
      lowStockParts: spareParts.filter((s) => s.stock <= s.minStock).length,
      partRequests: activeRequests.length,
      purchaseOrders: purchaseOrders.length,
      manuals: manuals.length,
    };
  },
});

export const queryEquipment = internalQuery({
  args: { query: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("equipment").collect();
    const q = args.query ?? "";
    return rows
      .filter((eq) =>
        matchesQuery(
          [eq.code, eq.name, eq.brand, eq.model, eq.serialNumber, eq.location],
          q,
        ),
      )
      .slice(0, MAX_TOOL_RESULTS)
      .map((eq) => ({
        code: eq.code ?? null,
        name: eq.name,
        brand: eq.brand ?? null,
        model: eq.model,
        serialNumber: eq.serialNumber ?? null,
        location: eq.location ?? null,
        decommissioned: Boolean(eq.decommissionDate),
      }));
  },
});

export const queryEquipmentHistory = internalQuery({
  args: { codeOrModel: v.string() },
  handler: async (ctx, args) => {
    const needle = args.codeOrModel.trim().toLowerCase();
    const allEquipment = await ctx.db.query("equipment").collect();
    const target =
      allEquipment.find(
        (eq) =>
          (eq.code ?? "").toLowerCase() === needle ||
          (eq.serialNumber ?? "").toLowerCase() === needle,
      ) ??
      allEquipment.find((eq) => eq.model.toLowerCase().includes(needle));

    const [maintenances, incidents, spareParts, movements] = await Promise.all([
      target
        ? ctx.db
            .query("maintenanceRecords")
            .withIndex("by_equipment", (q) => q.eq("equipmentId", target._id))
            .collect()
        : Promise.resolve([]),
      ctx.db.query("incidents").withIndex("by_createdAt").order("desc").collect(),
      target ? ctx.db.query("spareParts").collect() : Promise.resolve([]),
      target
        ? ctx.db
            .query("equipmentMovements")
            .withIndex("by_equipment", (q) => q.eq("equipmentId", target._id))
            .order("desc")
            .take(15)
        : Promise.resolve([]),
    ]);

    const compatibleParts = target
      ? spareParts
          .filter(
            (sp) =>
              sp.compatibleWith?.includes(target._id) ||
              (target.modelId !== undefined &&
                sp.compatibleModels?.includes(target.modelId)),
          )
          .slice(0, 20)
          .map((sp) => ({
            code: sp.code,
            name: sp.name,
            stock: sp.stock,
            minStock: sp.minStock,
            unit: sp.unit,
          }))
      : [];

    const relatedIncidents = incidents
      .filter((inc) => {
        if (inc.deletedAt !== undefined) return false;
        if (target && inc.equipmentId === target._id) return true;
        return matchesQuery(
          [inc.model, inc.serialNumber, inc.description],
          args.codeOrModel,
        );
      })
      .slice(0, 20)
      .map((inc) => ({
        reference: inc.reference,
        status: inc.status,
        reportedAt: new Date(inc.reportedAt).toISOString().slice(0, 10),
        model: inc.model ?? null,
        serialNumber: inc.serialNumber ?? null,
        description: richDocToPlainText(inc.description).slice(0, 200),
        resolvedNote: inc.resolvedNote
          ? richDocToPlainText(inc.resolvedNote).slice(0, 160)
          : null,
      }));

    return {
      equipment: target
        ? {
            code: target.code ?? null,
            name: target.name,
            brand: target.brand ?? null,
            model: target.model,
            serialNumber: target.serialNumber ?? null,
            location: target.location ?? null,
          }
        : null,
      maintenances: maintenances.slice(0, 15).map((m) => ({
        kind: m.kind,
        title: m.title,
        performedAt: new Date(m.performedAt).toISOString().slice(0, 10),
        technician: m.technician ?? null,
        description: m.description
          ? richDocToPlainText(m.description).slice(0, 160)
          : null,
      })),
      incidents: relatedIncidents,
      compatibleParts,
      movements: movements.map((m) => ({
        kind: m.kind,
        fromLocation: m.fromLocation ?? null,
        toLocation: m.toLocation ?? null,
        actorName: m.actorName,
        at: new Date(m.createdAt).toISOString().slice(0, 10),
      })),
    };
  },
});

export const queryIncidents = internalQuery({
  args: {
    query: v.optional(v.string()),
    onlyOpen: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("incidents")
      .withIndex("by_createdAt")
      .order("desc")
      .collect();
    const q = args.query ?? "";
    return rows
      .filter((inc) => {
        if (inc.deletedAt !== undefined) return false;
        if (args.onlyOpen && isClosedIncident(inc.status)) return false;
        return matchesQuery(
          [
            inc.reference,
            inc.status,
            inc.equipmentKind,
            inc.model,
            inc.serialNumber,
            richDocToPlainText(inc.description),
          ],
          q,
        );
      })
      .slice(0, MAX_TOOL_RESULTS)
      .map((inc) => ({
        reference: inc.reference,
        status: inc.status,
        reportedAt: new Date(inc.reportedAt).toISOString().slice(0, 10),
        model: inc.model ?? null,
        serialNumber: inc.serialNumber ?? null,
        description: richDocToPlainText(inc.description).slice(0, 200),
        resolvedNote: inc.resolvedNote
          ? richDocToPlainText(inc.resolvedNote).slice(0, 150)
          : null,
      }));
  },
});

export const querySpareParts = internalQuery({
  args: {
    query: v.optional(v.string()),
    lowStockOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const [rows, allEquipment, allModels] = await Promise.all([
      ctx.db.query("spareParts").collect(),
      ctx.db.query("equipment").collect(),
      ctx.db.query("equipmentModels").collect(),
    ]);
    const equipmentById = new Map(allEquipment.map((eq) => [eq._id, eq]));
    const modelById = new Map(allModels.map((m) => [m._id, m]));

    const q = args.query ?? "";
    return rows
      .filter((sp) => {
        if (args.lowStockOnly && sp.stock > sp.minStock) return false;
        const compatText: Array<string | undefined> = [];
        for (const eqId of sp.compatibleWith ?? []) {
          const eq = equipmentById.get(eqId);
          if (eq) compatText.push(eq.code, eq.name, eq.model, eq.brand);
        }
        for (const modelId of sp.compatibleModels ?? []) {
          const m = modelById.get(modelId);
          if (m) compatText.push(m.model, m.brand, m.name);
        }
        return matchesQuery(
          [
            sp.code,
            sp.name,
            sp.description,
            sp.category,
            sp.location,
            sp.partNumber,
            ...compatText,
          ],
          q,
        );
      })
      .slice(0, MAX_TOOL_RESULTS)
      .map((sp) => ({
        code: sp.code,
        name: sp.name,
        category: sp.category,
        stock: sp.stock,
        minStock: sp.minStock,
        unit: sp.unit,
        location: sp.location ?? null,
        partNumber: sp.partNumber ?? null,
        compatibleEquipment: (sp.compatibleWith ?? [])
          .map((eqId) => equipmentById.get(eqId))
          .filter((eq): eq is NonNullable<typeof eq> => Boolean(eq))
          .map((eq) => ({
            code: eq.code ?? null,
            name: eq.name,
            model: eq.model,
          })),
        compatibleModels: (sp.compatibleModels ?? [])
          .map((mId) => modelById.get(mId))
          .filter((m): m is NonNullable<typeof m> => Boolean(m))
          .map((m) => ({
            brand: m.brand ?? null,
            model: m.model,
            name: m.name,
          })),
      }));
  },
});

export const queryPartRequests = internalQuery({
  args: { query: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("partRequests").order("desc").collect();
    const q = args.query ?? "";
    return rows
      .filter((req) => {
        if (req.deletedAt !== undefined) return false;
        const lineText = req.lines.map((l) => l.name).join(" ");
        return matchesQuery(
          [req.reference, req.status, req.requesterName, req.equipment, lineText],
          q,
        );
      })
      .slice(0, MAX_TOOL_RESULTS)
      .map((req) => ({
        reference: req.reference,
        status: req.status,
        priority: req.priority,
        requesterName: req.requesterName,
        equipment: req.equipment ?? null,
        items: req.lines.map((l) => `${l.quantity}x ${l.name}`),
      }));
  },
});

export const queryPurchasing = internalQuery({
  args: { query: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const orders = await ctx.db
      .query("purchaseOrders")
      .withIndex("by_orderedAt")
      .order("desc")
      .collect();
    const q = args.query ?? "";
    return orders
      .filter((po) => matchesQuery([po.reference, po.supplier, po.status], q))
      .slice(0, MAX_TOOL_RESULTS)
      .map((po) => ({
        reference: po.reference,
        status: po.status,
        supplier: po.supplier,
        orderedAt: new Date(po.orderedAt).toISOString().slice(0, 10),
        linesCount: po.lines.length,
      }));
  },
});

export const queryManuals = internalQuery({
  args: { query: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("manuals").collect();
    const q = args.query ?? "";
    return rows
      .filter((m) =>
        matchesQuery(
          [
            m.title,
            m.type,
            m.brand,
            m.model,
            m.notes ? richDocToPlainText(m.notes) : undefined,
          ],
          q,
        ),
      )
      .slice(0, MAX_TOOL_RESULTS)
      .map((m) => ({
        id: m._id,
        title: m.title,
        type: m.type,
        brand: m.brand ?? null,
        model: m.model ?? null,
        notes: m.notes ? richDocToPlainText(m.notes).slice(0, 160) : null,
      }));
  },
});

export const queryMailbox = internalQuery({
  args: {
    userId: v.id("users"),
    query: v.optional(v.string()),
    tag: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("mailAccounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (!account) return [];

    const headers = await ctx.db
      .query("mailHeaders")
      .withIndex("by_account", (q) => q.eq("accountId", account._id))
      .collect();

    const q = args.query ?? "";
    const tagFilter = args.tag?.trim();

    return headers
      .filter((h) => {
        if (h.deletedRemoteAt !== undefined) return false;
        if (tagFilter && !h.tags?.includes(tagFilter)) return false;
        return matchesQuery(
          [h.subject, h.fromName, h.fromAddress, h.snippet, (h.tags ?? []).join(" ")],
          q,
        );
      })
      .sort((a, b) => b.date - a.date)
      .slice(0, MAX_TOOL_RESULTS)
      .map((h) => ({
        messageId: h.messageId,
        date: new Date(h.date).toISOString().slice(0, 10),
        from: h.fromName ? `${h.fromName} <${h.fromAddress}>` : h.fromAddress,
        subject: h.subject,
        snippet: h.snippet.slice(0, 180),
        tags: h.tags ?? [],
        hasAttachments: h.hasAttachments,
      }));
  },
});

export const queryMovements = internalQuery({
  args: {
    query: v.optional(v.string()),
    canParts: v.boolean(),
    canEquipment: v.boolean(),
  },
  handler: async (ctx, args) => {
    const q = args.query ?? "";

    const stock = args.canParts
      ? (
          await ctx.db
            .query("stockMovements")
            .withIndex("by_createdAt")
            .order("desc")
            .take(80)
        )
          .filter((m) =>
            matchesQuery([m.partCode, m.partName, m.actorName, m.reason], q),
          )
          .slice(0, 15)
          .map((m) => ({
            type: "stock",
            date: new Date(m.createdAt).toISOString().slice(0, 10),
            partCode: m.partCode,
            partName: m.partName,
            kind: m.kind,
            delta: m.delta,
            actor: m.actorName,
            reason: m.reason ?? null,
          }))
      : [];

    const equipment = args.canEquipment
      ? (
          await ctx.db
            .query("equipmentMovements")
            .withIndex("by_createdAt")
            .order("desc")
            .take(80)
        )
          .filter((m) =>
            matchesQuery(
              [m.equipmentCode, m.equipmentName, m.actorName, m.toLocation, m.note],
              q,
            ),
          )
          .slice(0, 15)
          .map((m) => ({
            type: "equipment",
            date: new Date(m.createdAt).toISOString().slice(0, 10),
            equipmentCode: m.equipmentCode ?? null,
            equipmentName: m.equipmentName,
            kind: m.kind,
            fromLocation: m.fromLocation ?? null,
            toLocation: m.toLocation ?? null,
            actor: m.actorName,
            note: m.note ?? null,
          }))
      : [];

    return { stock, equipment };
  },
});
