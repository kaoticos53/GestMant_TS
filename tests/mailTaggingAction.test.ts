import { describe, expect, test, vi } from "vitest";
import { api } from "../src/convex/_generated/api";
import { backend } from "./backend";

const { mockCallDeepSeekJson } = vi.hoisted(() => ({
  mockCallDeepSeekJson: vi.fn(),
}));

vi.mock("../src/convex/_ai/client", () => ({
  callDeepSeekJson: mockCallDeepSeekJson,
}));

describe("mailTaggingActions — motor híbrido 2 etapas (Fase 3)", () => {
  test("aplica reglas rápidas sin IA, usa DeepSeek en cabeceras y solo lee cuerpo cuando baja la certidumbre", async () => {
    process.env.DEEPSEEK_API_KEY = "sk-test-1234";
    mockCallDeepSeekJson.mockReset();

    // Primera llamada: lote de cabeceras (m-2 alta certidumbre, m-3 baja certidumbre)
    mockCallDeepSeekJson.mockResolvedValueOnce(
      JSON.stringify({
        items: [
          {
            messageId: "m-2",
            tags: ["requests"],
            confidence: 0.92,
            needsBody: false,
            reason: "Pide repuesto concreto",
          },
          {
            messageId: "m-3",
            tags: [],
            confidence: 0.45,
            needsBody: true,
            reason: "Asunto genérico",
          },
        ],
      }),
    );

    // Segunda llamada: análisis con cuerpo cacheado para m-3
    mockCallDeepSeekJson.mockResolvedValueOnce(
      JSON.stringify({
        tags: ["equipment"],
        confidence: 0.89,
        needsBody: false,
        reason: "Contiene S/N de equipo nuevo",
      }),
    );

    const t = backend();
    const { userId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        name: "Admin",
        email: "admin@taller.es",
        role: "admin",
        active: true,
      });
      await ctx.db.insert("aiSettings", {
        key: "default",
        enabled: true,
        baseUrl: "https://api.deepseek.com",
        visionModel: "deepseek-chat",
        chatModel: "deepseek-chat",
        updatedAt: 1,
      });
      await ctx.db.insert("mailTagRules", {
        userId,
        name: "Boletines",
        enabled: true,
        priority: 0,
        matchMode: "any",
        conditions: [
          { field: "from_address", operator: "contains", value: "noreply" },
        ],
        tags: ["informative"],
        createdAt: 1,
        updatedAt: 1,
      });
      const accountId = await ctx.db.insert("mailAccounts", {
        userId,
        email: "taller@empresa.es",
        serverUrl: "https://mail.empresa.es",
        status: "connected",
        enabled: true,
        cacheLimitBytes: 50 * 1024 * 1024,
        cacheRetentionDays: 30,
        cacheBytes: 0,
        cacheBodyBytes: 0,
        cacheAttachmentBytes: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("mailHeaders", {
        userId,
        accountId,
        folderRemoteId: "2",
        messageId: "m-1",
        subject: "Boletín semanal",
        fromName: "News",
        fromAddress: "noreply@news.es",
        date: 300,
        size: 100,
        flags: "",
        hasAttachments: false,
        snippet: "Resumen",
        bodyState: "none",
      });
      await ctx.db.insert("mailHeaders", {
        userId,
        accountId,
        folderRemoteId: "2",
        messageId: "m-2",
        subject: "Necesito 3 correas 4PK-850",
        fromName: "Juan",
        fromAddress: "juan@taller.es",
        date: 200,
        size: 100,
        flags: "u",
        hasAttachments: false,
        snippet: "Para el compresor",
        bodyState: "none",
      });
      await ctx.db.insert("mailHeaders", {
        userId,
        accountId,
        folderRemoteId: "2",
        messageId: "m-3",
        subject: "Fwd: revisar",
        fromName: "Proveedor",
        fromAddress: "ventas@prov.es",
        date: 100,
        size: 100,
        flags: "u",
        hasAttachments: false,
        snippet: "Adjunto datos",
        bodyState: "cached",
      });
      await ctx.db.insert("mailBodies", {
        userId,
        accountId,
        messageId: "m-3",
        text: "Equipo nuevo Sony HDC-3500 con S/N 8899123 para inventario.",
        textTruncated: false,
        htmlTruncated: false,
        bodyBytes: 64,
        parsedAt: 1,
      });
      return { userId };
    });

    const asUser = t.withIdentity({ subject: `${userId}|s-1` });
    const summary = await asUser.action(api.mailTaggingActions.autoTagFolder, {
      folderRemoteId: "2",
    });

    expect(summary).toEqual({
      processed: 3,
      byRule: 1,
      byAiHeaders: 1,
      byAiBody: 1,
    });
    expect(mockCallDeepSeekJson).toHaveBeenCalledTimes(2);

    const listed = await asUser.query(api.mailHeaders.list, {
      folderRemoteId: "2",
    });
    const byMsg = new Map(listed.headers.map((h) => [h.messageId, h]));
    expect(byMsg.get("m-1")?.tagSource).toBe("rule");
    expect(byMsg.get("m-1")?.tags).toEqual(["informative"]);
    expect(byMsg.get("m-2")?.tagSource).toBe("ai_headers");
    expect(byMsg.get("m-2")?.tags).toEqual(["requests"]);
    expect(byMsg.get("m-3")?.tagSource).toBe("ai_body");
    expect(byMsg.get("m-3")?.tags).toEqual(["equipment"]);
  });
});
