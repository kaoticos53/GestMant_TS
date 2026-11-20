import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import {
  AI_MAX_CALLS_PER_USER_HOUR,
  AI_MAX_IMAGE_DATA_URL_BYTES,
  AI_MAX_QUESTION_LENGTH,
  AI_WINDOW_MS,
  admitAiUsage,
  buildEquipmentLabelMessages,
  buildIncidentQaMessages,
  matchCatalogEquipmentModel,
  parseEquipmentLabelResponse,
  parseIncidentQaResponse,
  type EquipmentLabelExtraction,
  type IncidentContextItem,
  type IncidentQaAnswer,
} from "../lib/ai";
import { richDocToPlainText } from "../lib/richDoc";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
  query,
  type QueryCtx,
} from "./_generated/server";
import { callDeepSeekJson } from "./_ai/client";

const PURGE_LIMIT = 100;
const MAX_INCIDENT_CONTEXT = 40;

async function activeMemberOrNull(ctx: QueryCtx): Promise<Id<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;
  const user = await ctx.db.get(userId);
  if (!user || user.active === false || user.isAnonymous === true) {
    return null;
  }
  return user._id;
}

/** Indica a miembros autenticados si la IA está activa y lista para usarse. */
export const availability = query({
  args: {},
  handler: async (ctx): Promise<{ available: boolean }> => {
    const memberId = await activeMemberOrNull(ctx);
    if (memberId === null) return { available: false };

    const row = await ctx.db
      .query("aiSettings")
      .withIndex("by_key", (q) => q.eq("key", "default"))
      .unique();
    const enabled = row?.enabled ?? false;
    const hasKey =
      (row?.apiKey ?? "").trim() !== "" ||
      (process.env.DEEPSEEK_API_KEY ?? "").trim() !== "";
    return { available: enabled && hasKey };
  },
});

export const assertActiveMember = internalQuery({
  args: {},
  handler: async (ctx): Promise<Id<"users">> => {
    const memberId = await activeMemberOrNull(ctx);
    if (memberId === null) {
      throw new ConvexError(
        "Solo los miembros registrados y activos del taller pueden usar el asistente IA.",
      );
    }
    return memberId;
  },
});

export const admitUserUsage = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<void> => {
    const now = Date.now();
    const existing = await ctx.db
      .query("aiUsageLimits")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (
      existing !== null &&
      now - existing.windowStart < AI_WINDOW_MS
    ) {
      const admission = admitAiUsage(existing.count, AI_MAX_CALLS_PER_USER_HOUR);
      if (!admission.allowed) {
        throw new ConvexError(admission.error!);
      }
      await ctx.db.patch(existing._id, { count: existing.count + 1 });
      return;
    }

    if (existing === null) {
      await ctx.db.insert("aiUsageLimits", {
        userId: args.userId,
        windowStart: now,
        count: 1,
      });
    } else {
      await ctx.db.patch(existing._id, { windowStart: now, count: 1 });
    }
  },
});

export const purgeExpiredUsage = internalMutation({
  args: {},
  handler: async (ctx): Promise<number> => {
    const cutoff = Date.now() - AI_WINDOW_MS;
    const rows = await ctx.db
      .query("aiUsageLimits")
      .withIndex("by_windowStart", (q) => q.lte("windowStart", cutoff))
      .take(PURGE_LIMIT);
    for (const row of rows) {
      await ctx.db.delete(row._id);
    }
    return rows.length;
  },
});

export const labelCatalogContext = internalQuery({
  args: {},
  handler: async (ctx) => {
    const models = await ctx.db.query("equipmentModels").collect();
    const brands = await ctx.db
      .query("catalogs")
      .withIndex("by_kind", (q) => q.eq("kind", "brand"))
      .collect();

    const brandSet = new Set<string>();
    for (const b of brands) {
      if (b.name.trim()) brandSet.add(b.name.trim());
    }
    for (const m of models) {
      if (m.brand?.trim()) brandSet.add(m.brand.trim());
    }

    return {
      models: models.map((m) => ({
        model: m.model,
        ...(m.brand ? { brand: m.brand } : {}),
        ...(m.name ? { equipmentKind: m.name } : {}),
      })),
      knownBrands: [...brandSet],
    };
  },
});

export const incidentsContext = internalQuery({
  args: {},
  handler: async (ctx): Promise<IncidentContextItem[]> => {
    const recent = await ctx.db
      .query("incidents")
      .withIndex("by_createdAt")
      .order("desc")
      .take(MAX_INCIDENT_CONTEXT);

    return recent
      .filter((item) => item.deletedAt === undefined)
      .map((item) => ({
        reference: item.reference,
        status: item.status,
        ...(item.equipmentKind ? { equipmentKind: item.equipmentKind } : {}),
        ...(item.model ? { model: item.model } : {}),
        ...(item.serialNumber ? { serialNumber: item.serialNumber } : {}),
        description: richDocToPlainText(item.description).slice(0, 320),
        reportedAt: item.reportedAt,
        ...(item.resolvedNote
          ? { resolutionNote: richDocToPlainText(item.resolvedNote).slice(0, 240) }
          : {}),
      }));
  },
});

/**
 * Extrae marca, modelo, número de serie y tipo de equipo desde una foto de
 * etiqueta técnica usando DeepSeek Visión + pistas locales de código de barras.
 */
export const extractEquipmentLabel = action({
  args: {
    imageDataUrl: v.string(),
    detectedBarcodes: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args): Promise<EquipmentLabelExtraction> => {
    const userId = await ctx.runQuery(internal.ai.assertActiveMember, {});

    if (
      !args.imageDataUrl.startsWith("data:image/") ||
      args.imageDataUrl.length > AI_MAX_IMAGE_DATA_URL_BYTES
    ) {
      throw new ConvexError(
        "La imagen de la etiqueta no es válida o supera el tamaño máximo permitido.",
      );
    }

    const config = await ctx.runQuery(internal.aiSettings.resolved, {});
    if (!config.enabled || config.apiKey.trim() === "") {
      throw new ConvexError(
        "El escáner IA de etiquetas no está activado o falta configurar la clave de DeepSeek en Ajustes.",
      );
    }

    await ctx.runMutation(internal.ai.admitUserUsage, { userId });

    const catalog = await ctx.runQuery(internal.ai.labelCatalogContext, {});
    const messages = buildEquipmentLabelMessages({
      imageDataUrl: args.imageDataUrl,
      detectedBarcodes: args.detectedBarcodes,
      knownBrands: catalog.knownBrands,
    });

    const raw = await callDeepSeekJson({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      model: config.visionModel,
      messages,
      maxTokens: 700,
    });

    const parsed = parseEquipmentLabelResponse(raw);
    if (!parsed.ok) {
      throw new ConvexError(parsed.error);
    }

    const catalogMatch = matchCatalogEquipmentModel(
      parsed.value,
      catalog.models,
    );
    return {
      ...parsed.value,
      ...(catalogMatch ? { catalogMatch } : {}),
    };
  },
});

/**
 * Responde preguntas sobre el historial reciente de incidencias del taller
 * citando referencias reales verificadas.
 */
export const askIncidents = action({
  args: { question: v.string() },
  handler: async (ctx, args): Promise<IncidentQaAnswer> => {
    const userId = await ctx.runQuery(internal.ai.assertActiveMember, {});
    const question = args.question.trim();
    if (question === "") {
      throw new ConvexError("Escribe una pregunta sobre las incidencias.");
    }
    if (question.length > AI_MAX_QUESTION_LENGTH) {
      throw new ConvexError(
        `La pregunta es demasiado larga (máximo ${AI_MAX_QUESTION_LENGTH} caracteres).`,
      );
    }

    const config = await ctx.runQuery(internal.aiSettings.resolved, {});
    if (!config.enabled || config.apiKey.trim() === "") {
      throw new ConvexError(
        "El asistente IA no está activado o falta configurar la clave de DeepSeek en Ajustes.",
      );
    }

    await ctx.runMutation(internal.ai.admitUserUsage, { userId });

    const incidents = await ctx.runQuery(internal.ai.incidentsContext, {});
    const validRefs = new Set(incidents.map((item) => item.reference));
    const messages = buildIncidentQaMessages({ question, incidents });

    const raw = await callDeepSeekJson({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      model: config.chatModel,
      messages,
      maxTokens: 900,
    });

    const parsed = parseIncidentQaResponse(raw, validRefs);
    if (!parsed.ok) {
      throw new ConvexError(parsed.error);
    }
    return parsed.value;
  },
});
