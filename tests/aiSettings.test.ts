import { ConvexError } from "convex/values";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../src/convex/_generated/api";
import { backend } from "./backend";

afterEach(() => {
  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.PULSO_SETTINGS_ENCRYPTION_KEY;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function setup() {
  const t = backend();
  const { adminId, techId } = await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("users", {
      name: "Admin",
      email: "admin@taller.es",
      role: "admin",
      active: true,
    });
    const techId = await ctx.db.insert("users", {
      name: "Técnico",
      email: "tech@taller.es",
      role: "technician",
      active: true,
    });
    return { adminId, techId };
  });
  return {
    t,
    admin: t.withIdentity({ subject: `${adminId}|s-admin` }),
    tech: t.withIdentity({ subject: `${techId}|s-tech` }),
  };
}

describe("Fase 2 TDD — aiSettings (configuración cifrada de DeepSeek)", () => {
  test("solo el administrador activo puede consultar, guardar o probar ajustes de IA", async () => {
    const { t, tech } = await setup();

    await expect(t.query(api.aiSettings.settings, {})).rejects.toThrow(
      ConvexError,
    );
    await expect(tech.query(api.aiSettings.settings, {})).rejects.toThrow(
      /administrador/i,
    );
    await expect(
      tech.mutation(api.aiSettings.save, {
        enabled: true,
        baseUrl: "https://api.deepseek.com/v1",
        visionModel: "deepseek-flash",
        chatModel: "deepseek-chat",
        apiKey: "sk-secret",
      }),
    ).rejects.toThrow(/administrador/i);
    await expect(tech.action(api.aiSettings.testConnection, {})).rejects.toThrow(
      /administrador/i,
    );
  });

  test("la API key se cifra con AES-256-GCM en reposo, no regresa al cliente y queda auditada", async () => {
    process.env.PULSO_SETTINGS_ENCRYPTION_KEY = "clave-maestra-ai-32-bytes-test";
    const { t, admin } = await setup();

    const saved = await admin.mutation(api.aiSettings.save, {
      enabled: true,
      baseUrl: "https://api.deepseek.com/v1",
      visionModel: "deepseek-flash",
      chatModel: "deepseek-chat",
      apiKey: "sk-deepseek-real-9876",
    });

    expect(saved.enabled).toBe(true);
    expect(saved.hasKey).toBe(true);
    expect(saved.keySource).toBe("guardada");
    expect(saved.keyHint).toBe("…9876");
    expect(JSON.stringify(saved)).not.toContain("sk-deepseek-real-9876");

    const row = await t.run((ctx) => ctx.db.query("aiSettings").unique());
    expect(row?.apiKey).toMatch(/^enc:v1:/);
    expect(row?.apiKey).not.toContain("sk-deepseek-real-9876");

    const resolved = await t.query(internal.aiSettings.resolved, {});
    expect(resolved.apiKey).toBe("sk-deepseek-real-9876");

    const auditLogs = await t.run((ctx) =>
      ctx.db
        .query("securityAuditLog")
        .withIndex("by_action", (q) => q.eq("action", "ai_settings_change"))
        .collect(),
    );
    expect(auditLogs).toHaveLength(1);
    expect(JSON.stringify(auditLogs[0])).not.toContain("sk-deepseek-real-9876");
  });

  test("sin clave guardada usa DEEPSEEK_API_KEY del entorno y testConnection verifica conectividad", async () => {
    process.env.DEEPSEEK_API_KEY = "sk-env-1234";
    const { admin } = await setup();

    await admin.mutation(api.aiSettings.save, {
      enabled: true,
      baseUrl: "https://api.deepseek.com/v1",
      visionModel: "deepseek-flash",
      chatModel: "deepseek-chat",
    });

    const view = await admin.query(api.aiSettings.settings, {});
    expect(view.hasKey).toBe(true);
    expect(view.keySource).toBe("entorno");
    expect(view.envConfigured).toBe(true);
    expect(JSON.stringify(view)).not.toContain("sk-env-1234");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"ok":true}' } }],
        }),
      })),
    );

    const probe = await admin.action(api.aiSettings.testConnection, {});
    expect(probe.ok).toBe(true);
  });

  test("permite guardar permisos por rol, módulos habilitados, cuota y prompts personalizados", async () => {
    const { admin } = await setup();

    const saved = await admin.mutation(api.aiSettings.save, {
      enabled: true,
      baseUrl: "https://api.deepseek.com/v1",
      visionModel: "deepseek-flash",
      chatModel: "deepseek-chat",
      tasks: {
        labelScanner: true,
        incidentQa: false,
        workshopChat: true,
      },
      rateLimitPerHour: 25,
      allowedRoles: ["admin", "manager"],
      enabledModules: ["equipment", "incidents"],
      taskParams: {
        label_scanner: { temperature: 0.1, maxTokens: 1600 },
        incident_qa: { temperature: 0.2, maxTokens: 900 },
        workshop_chat: {
          temperature: 0.3,
          maxTokens: 1400,
          customPrompt: "Responde breve a {{usuario_nombre}}.",
        },
      },
    });

    expect(saved.rateLimitPerHour).toBe(25);
    expect(saved.allowedRoles).toEqual(["admin", "manager"]);
    expect(saved.enabledModules).toEqual(["equipment", "incidents"]);
    expect(saved.tasks?.incidentQa).toBe(false);
    expect(saved.taskParams?.workshop_chat.customPrompt).toBe(
      "Responde breve a {{usuario_nombre}}.",
    );
  });

  test("cifra el token de embeddings y testEmbeddingConnection valida 1024 dimensiones", async () => {
    process.env.PULSO_SETTINGS_ENCRYPTION_KEY = "clave-maestra-ai-32-bytes-test";
    const { t, admin } = await setup();

    const saved = await admin.mutation(api.aiSettings.save, {
      enabled: true,
      baseUrl: "https://api.deepseek.com/v1",
      visionModel: "deepseek-flash",
      chatModel: "deepseek-chat",
      embeddingEnabled: true,
      embeddingBaseUrl:
        "https://api.cloudflare.com/client/v4/accounts/acc123/ai/v1",
      embeddingModel: "@cf/baai/bge-m3",
      embeddingApiKey: "cf-token-secreto-4321",
    });

    expect(saved.embeddingEnabled).toBe(true);
    expect(saved.embeddingModel).toBe("@cf/baai/bge-m3");
    expect(saved.hasEmbeddingKey).toBe(true);
    expect(saved.embeddingKeyHint).toBe("…4321");
    expect(JSON.stringify(saved)).not.toContain("cf-token-secreto-4321");

    const resolved = await t.query(internal.aiSettings.resolved, {});
    expect(resolved.embeddingApiKey).toBe("cf-token-secreto-4321");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: [{ embedding: Array.from({ length: 1024 }, () => 0.01) }],
        }),
      })),
    );
    const okRes = await admin.action(api.aiSettings.testEmbeddingConnection, {});
    expect(okRes).toEqual({ ok: true, dimensions: 1024 });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: [{ embedding: Array.from({ length: 768 }, () => 0.01) }],
        }),
      })),
    );
    const badRes = await admin.action(
      api.aiSettings.testEmbeddingConnection,
      {},
    );
    expect(badRes.ok).toBe(false);
    expect(badRes.dimensions).toBe(768);
  });
});
