import { describe, expect, test } from "vitest";
import { api } from "../src/convex/_generated/api";
import { backend } from "./backend";

describe("mailTagging (Fase 2)", () => {
  test("CRUD de reglas, vista previa, etiquetado manual y filtro por etiqueta", async () => {
    const t = backend();
    const { userId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        name: "Admin",
        email: "admin@taller.es",
        role: "admin",
        active: true,
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
        subject: "Avería en foco LED",
        fromName: "Plató 1",
        fromAddress: "plato1@empresa.es",
        date: 200,
        size: 100,
        flags: "u",
        hasAttachments: false,
        snippet: "No enciende la fuente",
        bodyState: "none",
      });
      await ctx.db.insert("mailHeaders", {
        userId,
        accountId,
        folderRemoteId: "2",
        messageId: "m-2",
        subject: "Boletín mensual",
        fromName: "News",
        fromAddress: "noreply@news.es",
        date: 100,
        size: 100,
        flags: "",
        hasAttachments: false,
        snippet: "Novedades",
        bodyState: "none",
      });
      return { userId };
    });

    const asUser = t.withIdentity({ subject: `${userId}|s-1` });

    // Vista previa antes de guardar
    const preview = await asUser.query(api.mailTagging.previewRuleMatches, {
      matchMode: "any",
      conditions: [
        { field: "subject_or_snippet", operator: "contains", value: "avería" },
      ],
      tags: ["incidents"],
    });
    expect(preview.matchCount).toBe(1);
    expect(preview.samples[0].messageId).toBe("m-1");

    // Crear y listar reglas
    const r1 = await asUser.mutation(api.mailTagging.saveRule, {
      name: "Averías",
      enabled: true,
      matchMode: "any",
      conditions: [
        { field: "subject_or_snippet", operator: "contains", value: "avería" },
      ],
      tags: ["incidents"],
    });
    const r2 = await asUser.mutation(api.mailTagging.saveRule, {
      name: "Boletines",
      enabled: true,
      matchMode: "any",
      conditions: [
        { field: "from_address", operator: "contains", value: "noreply" },
      ],
      tags: ["informative"],
    });

    await asUser.mutation(api.mailTagging.reorderRules, {
      orderedIds: [r2, r1],
    });
    await asUser.mutation(api.mailTagging.toggleRule, {
      id: r2,
      enabled: false,
    });

    const rules = await asUser.query(api.mailTagging.listRules, {});
    expect(rules.map((r) => ({ id: r._id, enabled: r.enabled }))).toEqual([
      { id: r2, enabled: false },
      { id: r1, enabled: true },
    ]);

    // Etiquetado manual y filtro por etiqueta en mailHeaders.list
    await asUser.mutation(api.mailTagging.setMessageTags, {
      messageId: "m-1",
      tags: ["incidents", "equipment"],
    });

    const filtered = await asUser.query(api.mailHeaders.list, {
      folderRemoteId: "2",
      tag: "equipment",
    });
    expect(filtered.headers.map((h) => h.messageId)).toEqual(["m-1"]);
    expect(filtered.headers[0].tagSource).toBe("manual");

    await asUser.mutation(api.mailTagging.deleteRule, { id: r2 });
    const afterDelete = await asUser.query(api.mailTagging.listRules, {});
    expect(afterDelete).toHaveLength(1);
  });
});
