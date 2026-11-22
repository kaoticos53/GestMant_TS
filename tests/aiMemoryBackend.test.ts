import { describe, expect, test } from "vitest";
import { api, internal } from "../src/convex/_generated/api";
import { backend } from "./backend";

describe("aiMemory (Fase 2)", () => {
  test("reindexa el taller, aisla buzones por ownerUserId y filtra por módulos permitidos", async () => {
    const t = backend();
    const { adminId, userBId } = await t.run(async (ctx) => {
      const adminId = await ctx.db.insert("users", {
        name: "Admin",
        email: "admin@taller.es",
        role: "admin",
        active: true,
      });
      const userBId = await ctx.db.insert("users", {
        name: "Usuario B",
        email: "b@taller.es",
        role: "technician",
        active: true,
      });
      await ctx.db.insert("incidents", {
        reference: "INC-0099",
        equipmentKind: "Compresor",
        model: "GA-15",
        description: "Pérdida de presión en válvula",
        severity: "high",
        status: "reported",
        reportedAt: 100,
        reporterName: "Carlos",
        history: [],
        createdAt: 100,
        updatedAt: 100,
      });
      const accB = await ctx.db.insert("mailAccounts", {
        userId: userBId,
        email: "b@empresa.es",
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
        userId: userBId,
        accountId: accB,
        folderRemoteId: "2",
        messageId: "secret-b",
        subject: "Secreto de usuario B sobre compresor",
        fromName: "B",
        fromAddress: "b@empresa.es",
        date: 100,
        size: 50,
        flags: "",
        hasAttachments: false,
        snippet: "Confidencial",
        bodyState: "none",
      });
      return { adminId, userBId };
    });

    const asAdmin = t.withIdentity({ subject: `${adminId}|s-a` });
    const asUserB = t.withIdentity({ subject: `${userBId}|s-b` });

    const resWorkshop = await asAdmin.mutation(
      api.aiMemory.rebuildWorkshopIndex,
      {},
    );
    expect(resWorkshop.indexed).toBe(1);

    const resMailB = await asUserB.mutation(
      api.aiMemory.rebuildMyMailboxIndex,
      {},
    );
    expect(resMailB.indexed).toBe(1);

    await asAdmin.mutation(api.aiMemory.saveFact, {
      title: "Mantenimiento Compresor",
      fact: "La válvula requiere junta K12 en cada revisión",
      module: "incidents",
      active: true,
    });

    // Admin busca "fuga compresor" (sinónimo de pérdida) y ve INC-0099 + Fact, pero NUNCA el correo de userB
    const adminSearch = await t.query(internal.aiMemory.searchMemory, {
      userId: adminId,
      query: "fuga compresor",
      allowedModules: ["incidents"],
      includeMailbox: true,
    });
    expect(adminSearch.chunks.map((c) => c.reference)).toEqual(["INC-0099"]);
    expect(adminSearch.facts).toHaveLength(1);
    expect(
      adminSearch.chunks.some((c) => c.reference === "secret-b"),
    ).toBe(false);

    // Usuario B sí ve su propio correo
    const userBSearch = await t.query(internal.aiMemory.searchMemory, {
      userId: userBId,
      query: "compresor",
      allowedModules: [],
      includeMailbox: true,
    });
    expect(userBSearch.chunks.map((c) => c.reference)).toEqual(["secret-b"]);
  });
});
