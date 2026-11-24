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

  test("reindexación diferencial conserva _id/updatedAt/embedding sin cambios y limpia al modificar o borrar", async () => {
    const t = backend();
    const { adminId, incId, mailAccountId } = await t.run(async (ctx) => {
      const adminId = await ctx.db.insert("users", {
        name: "Admin",
        email: "admin-diff@taller.es",
        role: "admin",
        active: true,
      });
      const incId = await ctx.db.insert("incidents", {
        reference: "INC-0500",
        equipmentKind: "Monitor",
        model: "PVM-A250",
        description: "Parpadeo intermitente en SDI 1",
        severity: "medium",
        status: "reported",
        reportedAt: 100,
        reporterName: "Ana",
        history: [],
        createdAt: 100,
        updatedAt: 100,
      });
      const mailAccountId = await ctx.db.insert("mailAccounts", {
        userId: adminId,
        email: "admin-diff@empresa.es",
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
        userId: adminId,
        accountId: mailAccountId,
        folderRemoteId: "2",
        messageId: "msg-diff-1",
        subject: "Recambio monitor",
        fromName: "Proveedor",
        fromAddress: "ventas@prov.es",
        date: 200,
        size: 120,
        flags: "",
        hasAttachments: false,
        snippet: "Presupuesto enviado",
        bodyState: "none",
      });
      return { adminId, incId, mailAccountId };
    });

    const asAdmin = t.withIdentity({ subject: `${adminId}|s-diff` });
    expect(
      (await asAdmin.mutation(api.aiMemory.rebuildWorkshopIndex, {})).indexed,
    ).toBe(1);
    expect(
      (await asAdmin.mutation(api.aiMemory.rebuildMyMailboxIndex, {})).indexed,
    ).toBe(1);

    const vector = Array.from({ length: 768 }, () => 0.125);
    const initialChunks = await t.run(async (ctx) => {
      const rows = await ctx.db.query("aiKnowledgeChunks").collect();
      for (const row of rows) {
        await ctx.db.patch(row._id, { embedding: vector });
      }
      return await ctx.db.query("aiKnowledgeChunks").collect();
    });
    const workshopChunk0 = initialChunks.find((c) => c.scope === "shared")!;
    const mailChunk0 = initialChunks.find((c) => c.scope === "mailbox")!;
    expect(workshopChunk0.embedding).toEqual(vector);
    expect(mailChunk0.embedding).toEqual(vector);

    // Segunda ejecución sin cambios: no debe borrar ni reinsertar ni pisar updatedAt/embedding
    await asAdmin.mutation(api.aiMemory.rebuildWorkshopIndex, {});
    await asAdmin.mutation(api.aiMemory.rebuildMyMailboxIndex, {});

    const afterNoop = await t.run((ctx) =>
      ctx.db.query("aiKnowledgeChunks").collect(),
    );
    const workshopChunk1 = afterNoop.find((c) => c.scope === "shared")!;
    const mailChunk1 = afterNoop.find((c) => c.scope === "mailbox")!;
    expect(workshopChunk1._id).toBe(workshopChunk0._id);
    expect(workshopChunk1.updatedAt).toBe(workshopChunk0.updatedAt);
    expect(workshopChunk1.embedding).toEqual(vector);
    expect(mailChunk1._id).toBe(mailChunk0._id);
    expect(mailChunk1.updatedAt).toBe(mailChunk0.updatedAt);
    expect(mailChunk1.embedding).toEqual(vector);
    expect(mailAccountId).toBeDefined();

    // Modificar compactText limpia embedding pero conserva el mismo _id (patch in-place)
    await t.run((ctx) =>
      ctx.db.patch(incId, {
        description: "Fuente de alimentación quemada tras corte eléctrico",
      }),
    );
    await asAdmin.mutation(api.aiMemory.rebuildWorkshopIndex, {});
    const afterEdit = await t.run((ctx) => ctx.db.get(workshopChunk0._id));
    expect(afterEdit).not.toBeNull();
    expect(afterEdit!.compactText).toContain("Fuente de alimentación quemada");
    expect(afterEdit!.embedding).toBeUndefined();

    // Retirar incidencia elimina su fragmento huérfano
    await t.run((ctx) => ctx.db.patch(incId, { deletedAt: Date.now() }));
    const afterDelete = await asAdmin.mutation(
      api.aiMemory.rebuildWorkshopIndex,
      {},
    );
    expect(afterDelete.indexed).toBe(0);
    expect(await t.run((ctx) => ctx.db.get(workshopChunk0._id))).toBeNull();
  });
});
