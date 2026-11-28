import { ConvexError, v } from "convex/values";
import {
  AI_EMBEDDING_DIMENSIONS,
  AI_MAX_CALLS_PER_USER_HOUR,
  ALL_AI_TOOL_MODULES,
  DEFAULT_DEEPSEEK_BASE_URL,
  DEFAULT_DEEPSEEK_CHAT_MODEL,
  DEFAULT_DEEPSEEK_VISION_MODEL,
  DEFAULT_EMBEDDING_BASE_URL,
  DEFAULT_EMBEDDING_MODEL,
  isValidAiBaseUrl,
  type AiSettingsPublicView,
  type AiTaskId,
  type AiTaskParamConfig,
  type AiTasksEnabledConfig,
  type AiToolModule,
} from "../lib/ai";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type QueryCtx,
} from "./_generated/server";
import { callDeepSeekJson } from "./_ai/client";
import { fetchEmbeddingVector } from "./_ai/embeddings";
import {
  decryptSecret,
  encryptSecret,
  isEncryptedSecret,
  secretHint,
} from "./_auth/secretCrypto";
import { logSecurityEvent } from "./audit";
import { requireAdmin } from "./permissions";

const SETTINGS_KEY = "default";
const MAX_API_KEY_LEN = 512;

const DEFAULT_TASKS: AiTasksEnabledConfig = {
  labelScanner: true,
  incidentQa: true,
  workshopChat: true,
};

const DEFAULT_TASK_PARAMS: Record<AiTaskId, AiTaskParamConfig> = {
  label_scanner: { temperature: 0.1, maxTokens: 1600 },
  incident_qa: { temperature: 0.1, maxTokens: 900 },
  workshop_chat: { temperature: 0.2, maxTokens: 1200 },
  mail_triage: { temperature: 0.1, maxTokens: 1200 },
};

function envApiKey(): string {
  return (process.env.DEEPSEEK_API_KEY ?? "").trim();
}

function envEmbeddingApiKey(): string {
  return (
    process.env.CLOUDFLARE_AI_API_TOKEN ??
    process.env.AI_EMBEDDING_API_KEY ??
    ""
  ).trim();
}

async function readRow(ctx: QueryCtx): Promise<Doc<"aiSettings"> | null> {
  return await ctx.db
    .query("aiSettings")
    .withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY))
    .unique();
}

function normalizedTasks(row: Doc<"aiSettings"> | null): AiTasksEnabledConfig {
  return {
    labelScanner: row?.tasks?.labelScanner ?? DEFAULT_TASKS.labelScanner,
    incidentQa: row?.tasks?.incidentQa ?? DEFAULT_TASKS.incidentQa,
    workshopChat: row?.tasks?.workshopChat ?? DEFAULT_TASKS.workshopChat,
  };
}

function normalizedTaskParams(
  row: Doc<"aiSettings"> | null,
): Record<AiTaskId, AiTaskParamConfig> {
  return {
    label_scanner:
      row?.taskParams?.label_scanner ?? DEFAULT_TASK_PARAMS.label_scanner,
    incident_qa:
      row?.taskParams?.incident_qa ?? DEFAULT_TASK_PARAMS.incident_qa,
    workshop_chat:
      row?.taskParams?.workshop_chat ?? DEFAULT_TASK_PARAMS.workshop_chat,
    mail_triage:
      row?.taskParams?.mail_triage ?? DEFAULT_TASK_PARAMS.mail_triage,
  };
}

function normalizedEnabledModules(
  row: Doc<"aiSettings"> | null,
): AiToolModule[] {
  if (row?.enabledModules !== undefined) {
    return [...row.enabledModules];
  }
  return [...ALL_AI_TOOL_MODULES];
}

function publicView(row: Doc<"aiSettings"> | null): AiSettingsPublicView {
  const stored = (row?.apiKey ?? "").trim();
  const fromEnv = envApiKey();
  const hasStored = stored !== "";
  const keyHint = hasStored
    ? (row?.apiKeyHint ??
      (isEncryptedSecret(stored) ? "" : secretHint(stored)))
    : "";

  const storedEmb = (row?.embeddingApiKey ?? "").trim();
  const fromEmbEnv = envEmbeddingApiKey();
  const hasStoredEmb = storedEmb !== "";
  const embeddingKeyHint = hasStoredEmb
    ? (row?.embeddingApiKeyHint ??
      (isEncryptedSecret(storedEmb) ? "" : secretHint(storedEmb)))
    : "";

  return {
    enabled: row?.enabled ?? false,
    baseUrl: row?.baseUrl ?? DEFAULT_DEEPSEEK_BASE_URL,
    visionModel: row?.visionModel ?? DEFAULT_DEEPSEEK_VISION_MODEL,
    chatModel: row?.chatModel ?? DEFAULT_DEEPSEEK_CHAT_MODEL,
    hasKey: hasStored || fromEnv !== "",
    keyHint,
    keySource: hasStored ? "guardada" : fromEnv !== "" ? "entorno" : "ninguna",
    envConfigured: fromEnv !== "",
    updatedAt: row?.updatedAt ?? null,
    updatedBy: row?.updatedBy ?? null,
    lastTestAt: row?.lastTestAt ?? null,
    lastTestOk: row?.lastTestOk ?? null,
    lastTestError: row?.lastTestError ?? null,
    tasks: normalizedTasks(row),
    rateLimitPerHour: row?.rateLimitPerHour ?? AI_MAX_CALLS_PER_USER_HOUR,
    allowedRoles: row?.allowedRoles ?? [],
    enabledModules: normalizedEnabledModules(row),
    taskParams: normalizedTaskParams(row),
    embeddingEnabled: row?.embeddingEnabled ?? false,
    embeddingBaseUrl: row?.embeddingBaseUrl ?? DEFAULT_EMBEDDING_BASE_URL,
    embeddingModel: row?.embeddingModel ?? DEFAULT_EMBEDDING_MODEL,
    hasEmbeddingKey: hasStoredEmb || fromEmbEnv !== "",
    embeddingKeyHint,
    embeddingEnvConfigured: fromEmbEnv !== "",
    lastEmbeddingTestAt: row?.lastEmbeddingTestAt ?? null,
    lastEmbeddingTestOk: row?.lastEmbeddingTestOk ?? null,
    lastEmbeddingTestError: row?.lastEmbeddingTestError ?? null,
  };
}

/** Consulta pública para administradores: ajustes IA sin exponer la API key. */
export const settings = query({
  args: {},
  handler: async (ctx): Promise<AiSettingsPublicView> => {
    await requireAdmin(ctx, "configurar la IA del taller");
    return publicView(await readRow(ctx));
  },
});

/** Comprobación interna de rol administrador para acciones. */
export const canConfigure = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<boolean> => {
    const user = await ctx.db.get(args.userId);
    return (
      user !== null &&
      user.active !== false &&
      user.isAnonymous !== true &&
      user.role === "admin"
    );
  },
});

/** Configuración descifrada interna para las acciones de DeepSeek y embeddings. */
export const resolved = internalQuery({
  args: {},
  handler: async (ctx) => {
    const row = await readRow(ctx);
    const storedRaw = (row?.apiKey ?? "").trim();
    let decrypted = "";
    let decryptionFailed = false;
    if (storedRaw !== "") {
      try {
        decrypted = await decryptSecret(storedRaw);
      } catch {
        decryptionFailed = true;
      }
    }
    const apiKey = decrypted !== "" ? decrypted : envApiKey();

    const storedEmbRaw = (row?.embeddingApiKey ?? "").trim();
    let decryptedEmb = "";
    let embeddingDecryptionFailed = false;
    if (storedEmbRaw !== "") {
      try {
        decryptedEmb = await decryptSecret(storedEmbRaw);
      } catch {
        embeddingDecryptionFailed = true;
      }
    }
    const embeddingApiKey =
      decryptedEmb !== "" ? decryptedEmb : envEmbeddingApiKey();

    return {
      enabled: row?.enabled ?? false,
      baseUrl: row?.baseUrl ?? DEFAULT_DEEPSEEK_BASE_URL,
      visionModel: row?.visionModel ?? DEFAULT_DEEPSEEK_VISION_MODEL,
      chatModel: row?.chatModel ?? DEFAULT_DEEPSEEK_CHAT_MODEL,
      apiKey,
      decryptionFailed,
      tasks: normalizedTasks(row),
      rateLimitPerHour: row?.rateLimitPerHour ?? AI_MAX_CALLS_PER_USER_HOUR,
      allowedRoles: row?.allowedRoles ?? [],
      enabledModules: normalizedEnabledModules(row),
      taskParams: normalizedTaskParams(row),
      embeddingEnabled: row?.embeddingEnabled ?? false,
      embeddingBaseUrl: row?.embeddingBaseUrl ?? DEFAULT_EMBEDDING_BASE_URL,
      embeddingModel: row?.embeddingModel ?? DEFAULT_EMBEDDING_MODEL,
      embeddingApiKey,
      embeddingDecryptionFailed,
    };
  },
});

async function resolveNextSecret(opts: {
  clear?: boolean;
  incoming?: string;
  existingSecret?: string;
  existingHint?: string;
  errorLabel: string;
}): Promise<{ secret?: string; hint?: string }> {
  if (opts.clear === true) {
    return {};
  }
  const incoming = (opts.incoming ?? "").trim();
  if (incoming !== "") {
    if (incoming.length > MAX_API_KEY_LEN || /[\r\n]/.test(incoming)) {
      throw new ConvexError(opts.errorLabel);
    }
    return {
      secret: await encryptSecret(incoming),
      hint: secretHint(incoming),
    };
  }
  if (opts.existingSecret) {
    return {
      secret: opts.existingSecret,
      hint:
        opts.existingHint ??
        (isEncryptedSecret(opts.existingSecret)
          ? undefined
          : secretHint(opts.existingSecret)),
    };
  }
  return {};
}

const taskParamValidator = v.object({
  temperature: v.number(),
  maxTokens: v.number(),
  customPrompt: v.optional(v.string()),
});

/** Guarda los ajustes de DeepSeek, prompts y permisos cifrando la API key en reposo. */
export const save = mutation({
  args: {
    enabled: v.boolean(),
    baseUrl: v.string(),
    visionModel: v.string(),
    chatModel: v.string(),
    apiKey: v.optional(v.string()),
    clearApiKey: v.optional(v.boolean()),
    tasks: v.optional(
      v.object({
        labelScanner: v.boolean(),
        incidentQa: v.boolean(),
        workshopChat: v.boolean(),
      }),
    ),
    rateLimitPerHour: v.optional(v.number()),
    allowedRoles: v.optional(v.array(v.string())),
    enabledModules: v.optional(
      v.array(
        v.union(
          v.literal("equipment"),
          v.literal("incidents"),
          v.literal("requests"),
          v.literal("purchasing"),
          v.literal("parts"),
          v.literal("manuals"),
        ),
      ),
    ),
    taskParams: v.optional(
      v.object({
        label_scanner: taskParamValidator,
        incident_qa: taskParamValidator,
        workshop_chat: taskParamValidator,
        mail_triage: v.optional(taskParamValidator),
      }),
    ),
    embeddingEnabled: v.optional(v.boolean()),
    embeddingBaseUrl: v.optional(v.string()),
    embeddingModel: v.optional(v.string()),
    embeddingApiKey: v.optional(v.string()),
    clearEmbeddingApiKey: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<AiSettingsPublicView> => {
    const admin = await requireAdmin(ctx, "configurar la IA del taller");

    const baseUrl = args.baseUrl.trim() || DEFAULT_DEEPSEEK_BASE_URL;
    if (!isValidAiBaseUrl(baseUrl)) {
      throw new ConvexError(
        "La URL del servicio de IA debe empezar por https:// o http://.",
      );
    }
    const visionModel =
      args.visionModel.trim() || DEFAULT_DEEPSEEK_VISION_MODEL;
    const chatModel = args.chatModel.trim() || DEFAULT_DEEPSEEK_CHAT_MODEL;

    const row = await readRow(ctx);
    const embeddingEnabled =
      args.embeddingEnabled !== undefined
        ? args.embeddingEnabled
        : (row?.embeddingEnabled ?? false);
    const embeddingBaseUrl =
      args.embeddingBaseUrl !== undefined
        ? args.embeddingBaseUrl.trim()
        : (row?.embeddingBaseUrl ?? DEFAULT_EMBEDDING_BASE_URL);
    if (embeddingBaseUrl !== "" && !isValidAiBaseUrl(embeddingBaseUrl)) {
      throw new ConvexError(
        "La URL base de embeddings debe empezar por https:// o http://.",
      );
    }
    const embeddingModel =
      args.embeddingModel !== undefined
        ? args.embeddingModel.trim() || DEFAULT_EMBEDDING_MODEL
        : (row?.embeddingModel ?? DEFAULT_EMBEDDING_MODEL);

    const { secret: nextApiKey, hint: nextHint } = await resolveNextSecret({
      clear: args.clearApiKey,
      incoming: args.apiKey,
      existingSecret: row?.apiKey,
      existingHint: row?.apiKeyHint,
      errorLabel: "La clave API de IA no tiene un formato válido.",
    });
    const { secret: nextEmbeddingApiKey, hint: nextEmbeddingHint } =
      await resolveNextSecret({
        clear: args.clearEmbeddingApiKey,
        incoming: args.embeddingApiKey,
        existingSecret: row?.embeddingApiKey,
        existingHint: row?.embeddingApiKeyHint,
        errorLabel: "El token de embeddings no tiene un formato válido.",
      });

    const now = Date.now();
    const by = admin.name?.trim() || admin.email?.trim() || "Administración";
    const rateLimitPerHour =
      args.rateLimitPerHour !== undefined
        ? Math.max(1, Math.min(500, Math.round(args.rateLimitPerHour)))
        : (row?.rateLimitPerHour ?? AI_MAX_CALLS_PER_USER_HOUR);

    const record = {
      enabled: args.enabled,
      baseUrl,
      visionModel,
      chatModel,
      updatedAt: now,
      updatedBy: by,
      tasks: args.tasks ?? normalizedTasks(row),
      rateLimitPerHour,
      allowedRoles:
        args.allowedRoles !== undefined
          ? args.allowedRoles
          : (row?.allowedRoles ?? []),
      enabledModules:
        args.enabledModules !== undefined
          ? args.enabledModules
          : normalizedEnabledModules(row),
      taskParams: args.taskParams ?? normalizedTaskParams(row),
      embeddingEnabled,
      embeddingBaseUrl,
      embeddingModel,
      ...(nextApiKey !== undefined ? { apiKey: nextApiKey } : {}),
      ...(nextHint !== undefined ? { apiKeyHint: nextHint } : {}),
      ...(nextEmbeddingApiKey !== undefined
        ? { embeddingApiKey: nextEmbeddingApiKey }
        : {}),
      ...(nextEmbeddingHint !== undefined
        ? { embeddingApiKeyHint: nextEmbeddingHint }
        : {}),
    };

    if (row === null) {
      await ctx.db.insert("aiSettings", { key: SETTINGS_KEY, ...record });
    } else {
      await ctx.db.patch(row._id, {
        ...record,
        ...(nextApiKey === undefined
          ? { apiKey: undefined, apiKeyHint: undefined }
          : {}),
        ...(nextEmbeddingApiKey === undefined
          ? { embeddingApiKey: undefined, embeddingApiKeyHint: undefined }
          : {}),
      });
    }

    await logSecurityEvent(ctx, {
      actorId: admin._id,
      action: "ai_settings_change",
      target: "system:ai",
      metadata: {
        enabled: args.enabled,
        visionModel,
        chatModel,
        hasApiKey: nextApiKey !== undefined,
        embeddingEnabled,
        embeddingModel,
        hasEmbeddingApiKey: nextEmbeddingApiKey !== undefined,
        rateLimitPerHour,
      },
    });

    return publicView(await readRow(ctx));
  },
});

export const recordTest = internalMutation({
  args: { ok: v.boolean(), error: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const row = await readRow(ctx);
    if (row === null) return;
    await ctx.db.patch(row._id, {
      lastTestAt: Date.now(),
      lastTestOk: args.ok,
      lastTestError: args.error,
    });
  },
});

/** Prueba la conexión real contra DeepSeek con la clave configurada. */
export const testConnection = action({
  args: {},
  handler: async (ctx): Promise<{ ok: boolean; error?: string }> => {
    const admin = await ctx.runQuery(internal.ai.assertActiveMember, {});
    const isAdmin = await ctx.runQuery(internal.aiSettings.canConfigure, {
      userId: admin,
    });
    if (!isAdmin) {
      throw new ConvexError(
        "Solo un administrador puede probar la conexión de IA.",
      );
    }

    const config = await ctx.runQuery(internal.aiSettings.resolved, {});
    if (!config.apiKey) {
      const msg = "No hay ninguna API key de DeepSeek configurada.";
      await ctx.runMutation(internal.aiSettings.recordTest, {
        ok: false,
        error: msg,
      });
      return { ok: false, error: msg };
    }

    try {
      await callDeepSeekJson({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        model: config.chatModel,
        maxTokens: 32,
        messages: [
          {
            role: "system",
            content: 'Responde únicamente con JSON válido: {"ok":true}',
          },
          { role: "user", content: "ping" },
        ],
      });
      await ctx.runMutation(internal.aiSettings.recordTest, { ok: true });
      return { ok: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await ctx.runMutation(internal.aiSettings.recordTest, {
        ok: false,
        error: msg,
      });
      return { ok: false, error: msg };
    }
  },
});

export const recordEmbeddingTest = internalMutation({
  args: { ok: v.boolean(), error: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const row = await readRow(ctx);
    if (row === null) return;
    await ctx.db.patch(row._id, {
      lastEmbeddingTestAt: Date.now(),
      lastEmbeddingTestOk: args.ok,
      lastEmbeddingTestError: args.error,
    });
  },
});

/** Prueba la conexión real contra el endpoint de embeddings (Cloudflare / OpenAI / Ollama). */
export const testEmbeddingConnection = action({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ ok: boolean; dimensions?: number; error?: string }> => {
    const admin = await ctx.runQuery(internal.ai.assertActiveMember, {});
    const isAdmin = await ctx.runQuery(internal.aiSettings.canConfigure, {
      userId: admin,
    });
    if (!isAdmin) {
      throw new ConvexError(
        "Solo un administrador puede probar la conexión de embeddings.",
      );
    }

    const config = await ctx.runQuery(internal.aiSettings.resolved, {});
    if (!config.embeddingBaseUrl.trim()) {
      const msg = "Configura y guarda primero la URL base de embeddings.";
      await ctx.runMutation(internal.aiSettings.recordEmbeddingTest, {
        ok: false,
        error: msg,
      });
      return { ok: false, error: msg };
    }

    try {
      const vector = await fetchEmbeddingVector({
        baseUrl: config.embeddingBaseUrl,
        apiKey: config.embeddingApiKey || undefined,
        model: config.embeddingModel,
        input: "compresor de aire sin presión en válvula de descarga",
      });
      if (vector.length !== AI_EMBEDDING_DIMENSIONS) {
        const msg = `El modelo devolvió ${vector.length} dimensiones, pero el índice vectorial espera ${AI_EMBEDDING_DIMENSIONS} (ej. @cf/baai/bge-m3).`;
        await ctx.runMutation(internal.aiSettings.recordEmbeddingTest, {
          ok: false,
          error: msg,
        });
        return { ok: false, dimensions: vector.length, error: msg };
      }
      await ctx.runMutation(internal.aiSettings.recordEmbeddingTest, {
        ok: true,
      });
      return { ok: true, dimensions: vector.length };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await ctx.runMutation(internal.aiSettings.recordEmbeddingTest, {
        ok: false,
        error: msg,
      });
      return { ok: false, error: msg };
    }
  },
});
