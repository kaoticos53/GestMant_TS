import { describe, expect, test } from "vitest";
import { internal } from "../src/convex/_generated/api";
import { resolveAllowedAiTools } from "../src/lib/ai/tools";
import { backend } from "./backend";

describe("aiWorkshopMemoryTools (Fase 3)", () => {
  test("queryMailbox aísla por userId y filtra por etiqueta, queryMovements respeta capacidades", async () => {
    const t = backend();
    const { userAId, userBId } = await t.run(async (ctx) => {
      const userAId = await ctx.db.insert("users", {
        name: "Usuario A",
        email: "a@taller.es",
        role: "admin",
        active: true,
      });
      const userBId = await ctx.db.insert("users", {
        name: "Usuario B",
        email: "b@taller.es",
        role: "technician",
        active: true,
      });

      const accA = await ctx.db.insert("mailAccounts", {
        userId: userAId,
        email: "a@empresa.es",
        serverUrl: "https://mail.empresa.es",
        status: "connected",
        enabled: true,
        cacheLimitBytes: 1000,
        cacheRetentionDays: 30,
        cacheBytes: 0,
        cacheBodyBytes: 0,
        cacheAttachmentBytes: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("mailHeaders", {
        userId: userAId,
        accountId: accA,
        folderRemoteId: "2",
        messageId: "msg-a1",
        subject: "Pedido de filtros HF",
        fromName: "Prov",
        fromAddress: "prov@empresa.es",
        date: 200,
        size: 100,
        flags: "u",
        hasAttachments: false,
        snippet: "Se piden 4 unidades",
        bodyState: "none",
        tags: ["requests"],
      });

      const spId = await ctx.db.insert("spareParts", {
        code: "REP-01",
        name: "Filtro HF",
        category: "Filtros",
        stock: 5,
        minStock: 2,
        unit: "ud",
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("stockMovements", {
        sparePartId: spId,
        partCode: "REP-01",
        partName: "Filtro HF",
        kind: "manual_adjust",
        previousStock: 6,
        delta: -1,
        nextStock: 5,
        actorName: "Carlos",
        reason: "Mantenimiento",
        createdAt: 300,
      });
      return { userAId, userBId };
    });

    const mailA = await t.query(internal._ai.workshopTools.queryMailbox, {
      userId: userAId,
      tag: "requests",
    });
    expect(mailA).toHaveLength(1);
    expect(mailA[0]?.messageId).toBe("msg-a1");

    const mailB = await t.query(internal._ai.workshopTools.queryMailbox, {
      userId: userBId,
      query: "filtros",
    });
    expect(mailB).toHaveLength(0);

    const movAllowed = await t.query(
      internal._ai.workshopTools.queryMovements,
      { query: "Filtro", canParts: true, canEquipment: false },
    );
    expect(movAllowed.stock).toHaveLength(1);
    expect(movAllowed.equipment).toHaveLength(0);

    const movDenied = await t.query(internal._ai.workshopTools.queryMovements, {
      query: "Filtro",
      canParts: false,
      canEquipment: false,
    });
    expect(movDenied.stock).toHaveLength(0);
  });

  test("resolveAllowedAiTools incluye search_workshop_memory y search_movements en core", () => {
    const tools = resolveAllowedAiTools(["incidents"], {
      equipment: false,
      incidents: true,
      requests: false,
      purchasing: false,
      parts: false,
      manuals: false,
    });
    const names = tools.map((t) => t.function.name);
    expect(names).toContain("search_workshop_memory");
    expect(names).toContain("search_movements");
  });
});
