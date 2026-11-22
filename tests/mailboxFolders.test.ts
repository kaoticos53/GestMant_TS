import { describe, expect, test } from "vitest";
import { api } from "../src/convex/_generated/api";
import { backend } from "./backend";

describe("mailAccounts — orden y visibilidad de carpetas", () => {
  test("permite ocultar y reordenar carpetas y excluye las ocultas por defecto", async () => {
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
      await ctx.db.insert("mailFolders", {
        userId,
        accountId,
        remoteId: "2",
        parentRemoteId: "1",
        name: "Bandeja de entrada",
        path: "/Inbox",
        kind: "inbox",
        isMail: true,
        syncEnabled: true,
        unread: 3,
        total: 10,
        size: 100,
        sortOrder: 0,
      });
      await ctx.db.insert("mailFolders", {
        userId,
        accountId,
        remoteId: "5",
        parentRemoteId: "1",
        name: "Enviados",
        path: "/Sent",
        kind: "sent",
        isMail: true,
        syncEnabled: true,
        unread: 0,
        total: 4,
        size: 50,
        sortOrder: 1,
      });
      await ctx.db.insert("mailFolders", {
        userId,
        accountId,
        remoteId: "4",
        parentRemoteId: "1",
        name: "Spam",
        path: "/Junk",
        kind: "junk",
        isMail: true,
        syncEnabled: true,
        unread: 1,
        total: 2,
        size: 20,
        sortOrder: 2,
      });
      return { userId };
    });

    const asUser = t.withIdentity({ subject: `${userId}|s-1` });

    // Ocultar "Enviados" (remoteId "5")
    await asUser.mutation(api.mailAccounts.setFolderVisibility, {
      remoteId: "5",
      hidden: true,
    });

    // Reordenar: Spam ("4") primero, luego Bandeja ("2")
    await asUser.mutation(api.mailAccounts.reorderFolders, {
      orderedRemoteIds: ["4", "2", "5"],
    });

    // En la ficha de correo (sin includeHidden): solo visibles y en el nuevo orden
    const visible = await asUser.query(api.mailAccounts.folders, {});
    expect(visible.map((f) => f.remoteId)).toEqual(["4", "2"]);

    // En ajustes (includeHidden: true): salen todas en el nuevo orden con su estado hidden
    const all = await asUser.query(api.mailAccounts.folders, {
      includeHidden: true,
    });
    expect(all.map((f) => ({ id: f.remoteId, hidden: f.hidden }))).toEqual([
      { id: "4", hidden: false },
      { id: "2", hidden: false },
      { id: "5", hidden: true },
    ]);
  });
});
