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
  buildWorkshopChatMessages,
  matchCatalogEquipmentModel,
  parseEquipmentLabelResponse,
  parseIncidentQaResponse,
  parseWorkshopQaResponse,
  resolveAllowedAiTools,
  type EquipmentLabelExtraction,
  type IncidentContextItem,
  type IncidentQaAnswer,
  type UserModuleCapabilities,
  type WorkshopContextSnapshot,
  type WorkshopQaAnswer,
} from "../lib/ai";
import { compactChatTurns } from "../lib/ai/memory";
import { buildToolResultTable } from "../lib/ai/tables";
import type { AiResultTable } from "../lib/ai/types";
import { isClosedIncident } from "../lib/incidentFlow";
import type { Capability } from "../lib/permissions";
import { DEFAULT_ROLE, effectiveUserRoles } from "../lib/roles";
import { richDocToPlainText } from "../lib/richDoc";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
  query,
  type ActionCtx,
  type QueryCtx,
} from "./_generated/server";
import { callDeepSeekJson, callDeepSeekWithTools } from "./_ai/client";
import { grantsForRoles } from "./permissions";

const PURGE_LIMIT = 100;
const MAX_INCIDENT_CONTEXT = 60;

async function activeMemberDoc(ctx: QueryCtx): Promise<Doc<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;
  const user = await ctx.db.get(userId);
  if (user === null || user.active === false || user.isAnonymous === true) {
    return null;
  }
  return user;
}

function capabilitiesFromGrants(
  grants: Record<Capability, boolean>,
): UserModuleCapabilities {
  return {
    equipment:
      grants.viewEquipment ||
      grants.manageEquipment ||
      grants.lookupEquipment,
    incidents: grants.viewIncidents || grants.manageIncidents,
    requests:
      grants.viewRequests ||
      grants.createRequests ||
      grants.decideRequests,
    purchasing: grants.viewPurchasing || grants.managePurchasing,
    parts:
      grants.viewInventory ||
      grants.manageInventory ||
      grants.lookupCatalog,
    manuals: grants.viewManuals || grants.manageManuals,
  };
}

function isRoleAllowed(
  roleOrRoles: string | readonly string[] | undefined,
  allowedRoles: readonly string[],
): boolean {
  if (allowedRoles.length === 0) return true;
  if (!roleOrRoles) return false;
  if (typeof roleOrRoles === "string") {
    return allowedRoles.includes(roleOrRoles);
  }
  return roleOrRoles.some((role) => allowedRoles.includes(role));
}

/** Indica al cliente si el usuario autenticado tiene acceso a las funciones de IA. */
export const availability = query({
  args: {},
  handler: async (ctx) => {
    const member = await activeMemberDoc(ctx);
    if (member === null) {
      return {
        available: false,
        tasks: { labelScanner: false, incidentQa: false, workshopChat: false },
      };
    }

    const row = await ctx.db
      .query("aiSettings")
      .withIndex("by_key", (q) => q.eq("key", "default"))
      .unique();
    const enabled = row?.enabled ?? false;
    const hasStored = (row?.apiKey ?? "").trim() !== "";
    const hasEnv = (process.env.DEEPSEEK_API_KEY ?? "").trim() !== "";
    const assignedRoles = effectiveUserRoles(member);
    const roleAllowed = isRoleAllowed(
      assignedRoles.length > 0 ? assignedRoles : [DEFAULT_ROLE],
      row?.allowedRoles ?? [],
    );
    const baseAvailable = enabled && (hasStored || hasEnv) && roleAllowed;

    const tasks = {
      labelScanner: baseAvailable && (row?.tasks?.labelScanner ?? true),
      incidentQa: baseAvailable && (row?.tasks?.incidentQa ?? true),
      workshopChat: baseAvailable && (row?.tasks?.workshopChat ?? true),
    };

    return {
      available: baseAvailable,
      tasks,
    };
  },
});

export const assertActiveMember = internalQuery({
  args: {},
  handler: async (ctx): Promise<Id<"users">> => {
    const member = await activeMemberDoc(ctx);
    if (member === null) {
      throw new ConvexError(
        "Solo los miembros registrados y activos del taller pueden usar el asistente IA.",
      );
    }
    return member._id;
  },
});

export const activeMemberProfile = internalQuery({
  args: {},
  handler: async (ctx) => {
    const member = await activeMemberDoc(ctx);
    if (member === null) {
      throw new ConvexError(
        "Solo los miembros registrados y activos del taller pueden usar el asistente IA.",
      );
    }
    const assigned = effectiveUserRoles(member);
    const roles = assigned.length > 0 ? assigned : [DEFAULT_ROLE];
    const role = roles[0];
    const grants = await grantsForRoles(ctx, roles);
    return {
      userId: member._id,
      name: member.name?.trim() || member.email?.trim() || "Técnico",
      role,
      roles,
      capabilities: capabilitiesFromGrants(grants),
      canViewMailbox: Boolean(grants.viewMailbox),
    };
  },
});

export const admitUserUsage = internalMutation({
  args: { userId: v.id("users"), limit: v.optional(v.number()) },
  handler: async (ctx, args): Promise<void> => {
    const now = Date.now();
    const limit = args.limit ?? AI_MAX_CALLS_PER_USER_HOUR;
    const existing = await ctx.db
      .query("aiUsageLimits")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (
      existing !== null &&
      now - existing.windowStart < AI_WINDOW_MS
    ) {
      const admission = admitAiUsage(existing.count, limit);
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
    const member = await ctx.runQuery(internal.ai.activeMemberProfile, {});

    if (
      !args.imageDataUrl.startsWith("data:image/") ||
      args.imageDataUrl.length > AI_MAX_IMAGE_DATA_URL_BYTES
    ) {
      throw new ConvexError(
        "La imagen de la etiqueta no es válida o supera el tamaño máximo permitido.",
      );
    }

    const config = await ctx.runQuery(internal.aiSettings.resolved, {});
    if (
      !config.enabled ||
      config.apiKey.trim() === "" ||
      !config.tasks.labelScanner ||
      !isRoleAllowed(member.roles, config.allowedRoles)
    ) {
      throw new ConvexError(
        "El escáner IA de etiquetas no está habilitado para tu usuario o falta configurar DeepSeek en Ajustes.",
      );
    }

    await ctx.runMutation(internal.ai.admitUserUsage, {
      userId: member.userId,
      limit: config.rateLimitPerHour,
    });

    const catalog = await ctx.runQuery(internal.ai.labelCatalogContext, {});
    const taskCfg = config.taskParams.label_scanner;
    const messages = buildEquipmentLabelMessages({
      imageDataUrl: args.imageDataUrl,
      detectedBarcodes: args.detectedBarcodes,
      knownBrands: catalog.knownBrands,
      customPrompt: taskCfg.customPrompt,
      variables: {
        usuario_nombre: member.name,
        usuario_rol: member.role,
        fecha_actual: new Date().toISOString().slice(0, 10),
      },
    });

    const raw = await callDeepSeekJson({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      model: config.visionModel,
      messages,
      maxTokens: taskCfg.maxTokens,
      temperature: taskCfg.temperature,
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
    const member = await ctx.runQuery(internal.ai.activeMemberProfile, {});
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
    if (
      !config.enabled ||
      config.apiKey.trim() === "" ||
      !config.tasks.incidentQa ||
      !isRoleAllowed(member.roles, config.allowedRoles)
    ) {
      throw new ConvexError(
        "El asistente IA de incidencias no está habilitado para tu usuario.",
      );
    }

    await ctx.runMutation(internal.ai.admitUserUsage, {
      userId: member.userId,
      limit: config.rateLimitPerHour,
    });

    const incidents = await ctx.runQuery(internal.ai.incidentsContext, {});
    const validRefs = new Set(incidents.map((item) => item.reference));
    const taskCfg = config.taskParams.incident_qa;
    const messages = buildIncidentQaMessages({
      question,
      incidents,
      customPrompt: taskCfg.customPrompt,
      variables: {
        usuario_nombre: member.name,
        usuario_rol: member.role,
        fecha_actual: new Date().toISOString().slice(0, 10),
      },
    });

    const raw = await callDeepSeekJson({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      model: config.chatModel,
      messages,
      maxTokens: taskCfg.maxTokens,
      temperature: taskCfg.temperature,
    });

    const parsed = parseIncidentQaResponse(raw, validRefs);
    if (!parsed.ok) {
      throw new ConvexError(parsed.error);
    }
    return parsed.value;
  },
});

/**
 * Snapshot ligero de contadores + referencias válidas del taller.
 */
export const workshopContext = internalQuery({
  args: {},
  handler: async (ctx): Promise<WorkshopContextSnapshot> => {
    const [
      allEquipment,
      allIncidents,
      allSpareParts,
      allRequests,
      allOrders,
    ] = await Promise.all([
      ctx.db.query("equipment").collect(),
      ctx.db.query("incidents").withIndex("by_createdAt").order("desc").collect(),
      ctx.db.query("spareParts").collect(),
      ctx.db.query("partRequests").order("desc").collect(),
      ctx.db.query("purchaseOrders").withIndex("by_orderedAt").order("desc").collect(),
    ]);

    const activeIncidents = allIncidents.filter(
      (item) => item.deletedAt === undefined,
    );
    const activeRequests = allRequests.filter(
      (item) => item.deletedAt === undefined,
    );
    const lowStockParts = allSpareParts.filter(
      (sp) => sp.stock <= sp.minStock,
    );

    return {
      counts: {
        equipment: allEquipment.length,
        incidents: activeIncidents.length,
        openIncidents: activeIncidents.filter(
          (i) => !isClosedIncident(i.status),
        ).length,
        spareParts: allSpareParts.length,
        lowStockParts: lowStockParts.length,
        partRequests: activeRequests.length,
        purchaseOrders: allOrders.length,
      },
      equipment: allEquipment.map((eq) => ({
        ...(eq.code ? { code: eq.code } : {}),
        name: eq.name,
        model: eq.model,
      })),
      incidents: activeIncidents.map((item) => ({
        reference: item.reference,
        status: item.status,
        description: "",
        reportedAt: item.reportedAt,
      })),
      spareParts: allSpareParts.map((sp) => ({
        code: sp.code,
        name: sp.name,
        category: sp.category,
        stock: sp.stock,
        minStock: sp.minStock,
        unit: sp.unit,
      })),
      partRequests: activeRequests.map((req) => ({
        reference: req.reference,
        status: req.status,
        priority: req.priority,
        requesterName: req.requesterName,
        summary: "",
      })),
      purchaseOrders: allOrders.map((po) => ({
        reference: po.reference,
        status: po.status,
        supplier: po.supplier,
        orderedAt: po.orderedAt,
        itemsCount: po.lines.length,
      })),
    };
  },
});

async function dispatchWorkshopTool(
  ctx: ActionCtx,
  name: string,
  rawArgs: string,
  allowedNames: ReadonlySet<string>,
  actor: {
    userId: Id<"users">;
    allowedModules: string[];
    canViewMailbox: boolean;
    canParts: boolean;
    canEquipment: boolean;
  },
  collectedTables?: AiResultTable[],
): Promise<string> {
  if (!allowedNames.has(name)) {
    return JSON.stringify({
      error: "Herramienta no permitida para tu rol o módulo desactivado.",
    });
  }

  let parsedArgs: Record<string, unknown> = {};
  try {
    const raw: unknown = JSON.parse(rawArgs || "{}");
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      parsedArgs = raw as Record<string, unknown>;
    }
  } catch {
    parsedArgs = {};
  }

  const strArg = (key: string): string | undefined =>
    typeof parsedArgs[key] === "string" ? parsedArgs[key] : undefined;

  const recordTable = <T>(data: T): string => {
    if (collectedTables) {
      const table = buildToolResultTable(name, data);
      if (table) {
        const idx = collectedTables.findIndex((t) => t.kind === table.kind);
        if (idx >= 0) collectedTables[idx] = table;
        else collectedTables.push(table);
      }
    }
    return JSON.stringify(data);
  };

  switch (name) {
    case "get_workshop_stats":
      return JSON.stringify(
        await ctx.runQuery(internal._ai.workshopTools.queryStats, {}),
      );
    case "search_equipment":
      return recordTable(
        await ctx.runQuery(internal._ai.workshopTools.queryEquipment, {
          query: strArg("query"),
        }),
      );
    case "get_equipment_history":
      return JSON.stringify(
        await ctx.runQuery(internal._ai.workshopTools.queryEquipmentHistory, {
          codeOrModel: strArg("codeOrModel") ?? "",
        }),
      );
    case "search_incidents":
      return recordTable(
        await ctx.runQuery(internal._ai.workshopTools.queryIncidents, {
          query: strArg("query"),
          onlyOpen: strArg("onlyOpen") === "true",
        }),
      );
    case "search_spare_parts":
      return recordTable(
        await ctx.runQuery(internal._ai.workshopTools.querySpareParts, {
          query: strArg("query"),
          lowStockOnly: strArg("lowStockOnly") === "true",
        }),
      );
    case "search_part_requests":
      return recordTable(
        await ctx.runQuery(internal._ai.workshopTools.queryPartRequests, {
          query: strArg("query"),
        }),
      );
    case "search_purchase_orders":
      return recordTable(
        await ctx.runQuery(internal._ai.workshopTools.queryPurchasing, {
          query: strArg("query"),
        }),
      );
    case "search_manuals":
      return recordTable(
        await ctx.runQuery(internal._ai.workshopTools.queryManuals, {
          query: strArg("query"),
        }),
      );
    case "search_workshop_memory":
      return JSON.stringify(
        await ctx.runAction(internal.aiMemory.searchMemoryHybrid, {
          userId: actor.userId,
          query: strArg("query") ?? "",
          allowedModules: actor.allowedModules,
          includeMailbox: actor.canViewMailbox,
        }),
      );
    case "search_mailbox":
      if (!actor.canViewMailbox) {
        return JSON.stringify({ error: "Sin permiso para consultar tu buzón." });
      }
      return JSON.stringify(
        await ctx.runQuery(internal._ai.workshopTools.queryMailbox, {
          userId: actor.userId,
          query: strArg("query"),
          tag: strArg("tag"),
        }),
      );
    case "search_movements":
      return JSON.stringify(
        await ctx.runQuery(internal._ai.workshopTools.queryMovements, {
          query: strArg("query"),
          canParts: actor.canParts,
          canEquipment: actor.canEquipment,
        }),
      );
    default:
      return JSON.stringify({ error: `Herramienta desconocida: ${name}` });
  }
}

/**
 * Chat asistente global sobre los datos operativos del taller con Tool Calling
 * bajo demanda y filtrado estricto por permisos CASL.
 */
export const askWorkshop = action({
  args: {
    question: v.string(),
    activeView: v.optional(v.string()),
    debug: v.optional(v.boolean()),
    history: v.optional(
      v.array(
        v.object({
          role: v.union(v.literal("user"), v.literal("assistant")),
          content: v.string(),
        }),
      ),
    ),
  },
  handler: async (ctx, args): Promise<WorkshopQaAnswer> => {
    const member = await ctx.runQuery(internal.ai.activeMemberProfile, {});
    const question = args.question.trim();
    if (question === "") {
      throw new ConvexError("Escribe una pregunta para el asistente del taller.");
    }
    if (question.length > AI_MAX_QUESTION_LENGTH) {
      throw new ConvexError(
        `La pregunta es demasiado larga (máximo ${AI_MAX_QUESTION_LENGTH} caracteres).`,
      );
    }

    const config = await ctx.runQuery(internal.aiSettings.resolved, {});
    if (
      !config.enabled ||
      config.apiKey.trim() === "" ||
      !config.tasks.workshopChat ||
      !isRoleAllowed(member.roles, config.allowedRoles)
    ) {
      throw new ConvexError(
        "El chat asistente IA no está habilitado para tu usuario o falta configurar DeepSeek en Ajustes.",
      );
    }

    await ctx.runMutation(internal.ai.admitUserUsage, {
      userId: member.userId,
      limit: config.rateLimitPerHour,
    });

    const context = await ctx.runQuery(internal.ai.workshopContext, {});
    const validRefs = new Set<string>();
    for (const eq of context.equipment) {
      if (eq.code) validRefs.add(eq.code);
    }
    for (const inc of context.incidents) validRefs.add(inc.reference);
    for (const sp of context.spareParts) validRefs.add(sp.code);
    for (const req of context.partRequests) validRefs.add(req.reference);
    for (const po of context.purchaseOrders) validRefs.add(po.reference);

    const allowedTools = resolveAllowedAiTools(
      config.enabledModules,
      member.capabilities,
    ).filter(
      (tool) =>
        tool.function.name !== "search_mailbox" || member.canViewMailbox,
    );
    const allowedToolNames = new Set(allowedTools.map((t) => t.function.name));
    const allowedModuleList = config.enabledModules.filter(
      (m) => member.capabilities[m],
    );

    const taskCfg = config.taskParams.workshop_chat;
    const messages = buildWorkshopChatMessages({
      question,
      history: compactChatTurns(args.history ?? []),
      context,
      customPrompt: taskCfg.customPrompt,
      variables: {
        usuario_nombre: member.name,
        usuario_rol: member.role,
        fecha_actual: new Date().toISOString().slice(0, 10),
        vista_actual: args.activeView?.trim() || "Panel",
      },
    });

    const collectedTables: AiResultTable[] = [];
    const { content, usedTools, debugTrace } = await callDeepSeekWithTools({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      model: config.chatModel,
      messages,
      maxTokens: taskCfg.maxTokens,
      temperature: taskCfg.temperature,
      tools: allowedTools,
      collectDebug: args.debug === true,
      executeTool: (name, rawArgs) =>
        dispatchWorkshopTool(
          ctx,
          name,
          rawArgs,
          allowedToolNames,
          {
            userId: member.userId,
            allowedModules: allowedModuleList,
            canViewMailbox: member.canViewMailbox,
            canParts: member.capabilities.parts,
            canEquipment: member.capabilities.equipment,
          },
          collectedTables,
        ),
    });

    const parsed = parseWorkshopQaResponse(content, validRefs);
    if (!parsed.ok) {
      if (args.debug === true) {
        return {
          answer: `⚠️ ${parsed.error}\n\nRespuesta cruda del modelo:\n${content}`,
          citedReferences: [],
          usedTools,
          ...(collectedTables.length > 0 ? { tables: collectedTables } : {}),
          ...(debugTrace ? { debugTrace } : {}),
        };
      }
      throw new ConvexError(parsed.error);
    }
    return {
      ...parsed.value,
      usedTools,
      ...(collectedTables.length > 0 ? { tables: collectedTables } : {}),
      ...(debugTrace ? { debugTrace } : {}),
    };
  },
});
