import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ConvexError } from "convex/values";
import type { Id } from "../src/convex/_generated/dataModel";
import { api, internal } from "../src/convex/_generated/api";
import { backend } from "./backend";

function fixture(name: string): string {
  return readFileSync(
    new URL(`./fixtures/mail/${name}`, import.meta.url),
    "utf8",
  );
}

function soap(body: string): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">' +
    `<soap:Body>${body}</soap:Body>` +
    "</soap:Envelope>"
  );
}

function syncResponse({
  token,
  deletedIds = [],
  more = false,
}: {
  token: string;
  deletedIds?: string[];
  more?: boolean;
}): string {
  const deleted =
    deletedIds.length > 0
      ? `<deleted><m ids="${deletedIds.join(",")}"/></deleted>`
      : "";
  return soap(
    `<SyncResponse xmlns="urn:zimbraMail" token="${token}" more="${more ? "1" : "0"}">` +
      `<folder id="2" name="Inbox" absFolderPath="/Inbox" view="message" n="2" u="1" s="10"/>` +
      deleted +
      "</SyncResponse>",
  );
}

function searchResponse({
  messageIds,
  more = false,
  folderId = "2",
}: {
  messageIds: string[];
  more?: boolean;
  folderId?: string;
}): string {
  const rows = messageIds
    .map((id) =>
      id === "17438"
        ? `<m id="17438" s="2625302" d="1795179963000" f="an" l="${folderId}" cid="17206"><e t="f" p="JAVIER LOBO CASTRO" a="jlobo@rtva.es"/><su>Re: Afectación de apagado</su><fr>Buenos días. Revisamos el equipo.</fr></m>`
        : `<m id="17436" s="1536" d="1795179000000" f="u" l="${folderId}"><e t="f" a="sat@proveedor.es"/><su>Presupuesto de reparación</su><fr>Adjuntamos el presupuesto.</fr></m>`,
    )
    .join("");
  return soap(
    `<SearchResponse xmlns="urn:zimbraMail" offset="0" more="${more ? "1" : "0"}" sortBy="dateAsc">${rows}</SearchResponse>`,
  );
}

interface MailboxStub {
  searchPages: string[];
  syncPages: string[];
}

function stubMailbox({
  searchPages,
  syncPages,
}: MailboxStub): ReturnType<typeof vi.fn> {
  const searchQueue = [...searchPages];
  const syncQueue = [...syncPages];
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const body = String(init?.body ?? "");
    if (body.includes("<AuthRequest")) {
      return new Response(fixture("auth.xml"));
    }
    if (body.includes("<GetFolderRequest")) {
      return new Response(fixture("folders.xml"));
    }
    if (body.includes("<SyncRequest")) {
      return new Response(
        syncQueue.shift() ?? syncResponse({ token: "tok-1" }),
      );
    }
    if (body.includes("<SearchRequest")) {
      return new Response(
        searchQueue.shift() ?? searchResponse({ messageIds: [] }),
      );
    }
    throw new Error(`Petición SOAP inesperada: ${body.slice(0, 80)}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function createUser(
  t: ReturnType<typeof backend>,
  email: string,
  role: "admin" | "technician" = "technician",
): Promise<Id<"users">> {
  return await t.run((ctx) =>
    ctx.db.insert("users", {
      name: email,
      email,
      role,
    }),
  );
}

async function setup() {
  const t = backend();
  const firstId = await createUser(t, "tecnica@taller.es");
  const secondId = await createUser(t, "tecnico2@taller.es");
  const inactiveId = await createUser(t, "baja@taller.es");
  const first = t.withIdentity({ subject: `${firstId}|s-first` });
  const second = t.withIdentity({ subject: `${secondId}|s-second` });
  const inactive = t.withIdentity({ subject: `${inactiveId}|s-baja` });
  const draft = {
    email: "tecnica@rtva.es",
    password: "app-password-1234",
    enabled: true,
    cacheLimitBytes: 512 * 1024 * 1024,
    cacheRetentionDays: 30,
  };
  await first.mutation(api.mailAccounts.save, draft);
  await second.mutation(api.mailAccounts.save, {
    ...draft,
    email: "tecnico2@rtva.es",
  });
  return { t, first, second, inactive, firstId, secondId, inactiveId };
}

async function accountFor(t: ReturnType<typeof backend>, userId: Id<"users">) {
  return await t.run((ctx) =>
    ctx.db
      .query("mailAccounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first(),
  );
}

async function expectConvexError(promise: Promise<unknown>, fragment: string) {
  const error = await promise.then(
    () => null,
    (err: unknown) => err,
  );
  expect(error, `Se esperaba un error con: ${fragment}`).not.toBeNull();
  const message =
    error instanceof ConvexError ? String(error.data) : String(error);
  expect(message).toContain(fragment);
}

beforeEach(() => {
  process.env.PULSO_SETTINGS_ENCRYPTION_KEY = "clave-de-prueba-f3";
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.PULSO_SETTINGS_ENCRYPTION_KEY;
});

describe("sincronización de cabeceras", () => {
  test("importa sin cuerpos, pagina, guarda token y no duplica", async () => {
    const { first, t, firstId } = await setup();
    const fetchMock = stubMailbox({
      searchPages: [
        searchResponse({ messageIds: ["17438", "17436"], more: true }),
        searchResponse({ messageIds: [] }),
        searchResponse({ messageIds: ["17438", "17436"] }),
      ],
      syncPages: [
        syncResponse({ token: "tok-1" }),
        syncResponse({ token: "tok-2" }),
      ],
    });

    const firstResult = await first.action(api.mailSync.syncNow, {
      folderRemoteId: "2",
    });
    expect(firstResult).toEqual({ ok: true, folders: 1, headers: 2 });

    const list = await first.query(api.mailHeaders.list, {
      folderRemoteId: "2",
    });
    expect(list.total).toBe(2);
    expect(list.unread).toBe(1);
    expect(list.headers.map((header) => header.messageId)).toEqual([
      "17438",
      "17436",
    ]);
    expect(list.headers[0]).toMatchObject({
      subject: "Re: Afectación de apagado",
      fromName: "JAVIER LOBO CASTRO",
      hasAttachments: true,
      bodyState: "none",
    });
    expect(
      fetchMock.mock.calls.some(([, init]) =>
        String((init as RequestInit | undefined)?.body ?? "").includes(
          "<GetMsgRequest",
        ),
      ),
    ).toBe(false);

    const account = await accountFor(t, firstId);
    expect(account?.status).toBe("connected");
    expect(account?.lastSyncOkAt).toBeGreaterThan(0);
    expect(account?.syncLeaseUntil).toBeUndefined();
    const folder = account
      ? await t.run((ctx) =>
          ctx.db
            .query("mailFolders")
            .withIndex("by_account", (q) => q.eq("accountId", account._id))
            .first(),
        )
      : null;
    expect(folder?.syncToken).toBe("tok-1");

    const secondResult = await first.action(api.mailSync.syncNow, {
      folderRemoteId: "2",
    });
    expect(secondResult).toEqual({ ok: true, folders: 1, headers: 2 });
    expect(
      await t.run((ctx) => ctx.db.query("mailHeaders").collect()),
    ).toHaveLength(2);
  });

  test("una desaparición marca tumba y una reaparición la limpia", async () => {
    const { first, t } = await setup();
    stubMailbox({
      searchPages: [
        searchResponse({ messageIds: ["17438", "17436"] }),
        searchResponse({ messageIds: ["17438"] }),
        searchResponse({ messageIds: ["17438", "17436"] }),
      ],
      syncPages: [
        syncResponse({ token: "tok-1" }),
        syncResponse({ token: "tok-2", deletedIds: ["17436"] }),
        syncResponse({ token: "tok-3" }),
      ],
    });

    await first.action(api.mailSync.syncNow, { folderRemoteId: "2" });
    await first.action(api.mailSync.syncNow, { folderRemoteId: "2" });

    const afterDelete = await t.run((ctx) =>
      ctx.db.query("mailHeaders").collect(),
    );
    const removed = afterDelete.find((header) => header.messageId === "17436");
    expect(removed?.deletedRemoteAt).toBeGreaterThan(0);
    expect(
      (
        await first.query(api.mailHeaders.list, { folderRemoteId: "2" })
      ).headers.map((header) => header.messageId),
    ).toEqual(["17438"]);

    await first.action(api.mailSync.syncNow, { folderRemoteId: "2" });
    const afterReturn = await t.run((ctx) =>
      ctx.db.query("mailHeaders").collect(),
    );
    expect(
      afterReturn.find((header) => header.messageId === "17436")
        ?.deletedRemoteAt,
    ).toBeUndefined();
    expect(
      (await first.query(api.mailHeaders.list, { folderRemoteId: "2" })).total,
    ).toBe(2);
  });

  test("una página vacía con more=1 no marca ausentes ni avanza el token", async () => {
    const { first, t, firstId } = await setup();
    stubMailbox({
      searchPages: [
        searchResponse({ messageIds: ["17438", "17436"] }),
        searchResponse({ messageIds: ["17438"], more: true }),
        searchResponse({ messageIds: [], more: true }),
      ],
      syncPages: [
        syncResponse({ token: "tok-1" }),
        syncResponse({ token: "tok-2", deletedIds: ["17436"] }),
      ],
    });

    await first.action(api.mailSync.syncNow, { folderRemoteId: "2" });
    await expectConvexError(
      first.action(api.mailSync.syncNow, { folderRemoteId: "2" }),
      "no terminó",
    );

    const rows = await t.run((ctx) => ctx.db.query("mailHeaders").collect());
    expect(
      rows.find((row) => row.messageId === "17436")?.deletedRemoteAt,
    ).toBeUndefined();
    const folder = await t.run((ctx) =>
      ctx.db.query("mailFolders").withIndex("by_account").first(),
    );
    expect(folder?.syncToken).toBe("tok-1");
    expect((await accountFor(t, firstId))?.status).toBe("error");
  });

  test("un corte por MAX_PAGES no marca ausentes ni avanza el token", async () => {
    const { first, t, firstId } = await setup();
    stubMailbox({
      searchPages: [
        searchResponse({ messageIds: ["17438", "17436"] }),
        ...Array.from({ length: 100 }, () =>
          searchResponse({ messageIds: ["17438"], more: true }),
        ),
      ],
      syncPages: [
        syncResponse({ token: "tok-1" }),
        syncResponse({ token: "tok-2", deletedIds: ["17436"] }),
      ],
    });

    await first.action(api.mailSync.syncNow, { folderRemoteId: "2" });
    await expectConvexError(
      first.action(api.mailSync.syncNow, { folderRemoteId: "2" }),
      "no terminó",
    );

    const rows = await t.run((ctx) => ctx.db.query("mailHeaders").collect());
    expect(
      rows.find((row) => row.messageId === "17436")?.deletedRemoteAt,
    ).toBeUndefined();
    const folder = await t.run((ctx) =>
      ctx.db.query("mailFolders").withIndex("by_account").first(),
    );
    expect(folder?.syncToken).toBe("tok-1");
    expect((await accountFor(t, firstId))?.status).toBe("error");
  });

  test("un corte por MAX_PAGES en Sync tampoco guarda la carpeta", async () => {
    const { first, t, firstId } = await setup();
    stubMailbox({
      searchPages: [searchResponse({ messageIds: ["17438", "17436"] })],
      syncPages: [
        syncResponse({ token: "tok-1" }),
        ...Array.from({ length: 100 }, () =>
          syncResponse({ token: "tok-2", deletedIds: ["17436"], more: true }),
        ),
      ],
    });

    await first.action(api.mailSync.syncNow, { folderRemoteId: "2" });
    await expectConvexError(
      first.action(api.mailSync.syncNow, { folderRemoteId: "2" }),
      "no terminó",
    );

    const rows = await t.run((ctx) => ctx.db.query("mailHeaders").collect());
    expect(
      rows.find((row) => row.messageId === "17436")?.deletedRemoteAt,
    ).toBeUndefined();
    const folder = await t.run((ctx) =>
      ctx.db.query("mailFolders").withIndex("by_account").first(),
    );
    expect(folder?.syncToken).toBe("tok-1");
    expect((await accountFor(t, firstId))?.status).toBe("error");
  });

  test("un mensaje que cambia de carpeta se mueve sin duplicarse ni quedar oculto", async () => {
    const { first, t, firstId } = await setup();
    stubMailbox({
      searchPages: [
        searchResponse({ messageIds: ["17438"], folderId: "2" }),
        searchResponse({ messageIds: ["17438"], folderId: "5" }),
        searchResponse({ messageIds: [] }),
      ],
      syncPages: [
        syncResponse({ token: "tok-1" }),
        syncResponse({ token: "tok-2" }),
        syncResponse({ token: "tok-3" }),
      ],
    });

    await first.action(api.mailSync.syncNow, { folderRemoteId: "2" });
    await first.action(api.mailSync.syncNow, { folderRemoteId: "5" });

    expect(
      (await first.query(api.mailHeaders.list, { folderRemoteId: "2" })).total,
    ).toBe(0);
    expect(
      (await first.query(api.mailHeaders.list, { folderRemoteId: "5" })).total,
    ).toBe(1);
    const moved = await t.run((ctx) =>
      ctx.db.query("mailHeaders").withIndex("by_account").first(),
    );
    expect(moved?.folderRemoteId).toBe("5");
    expect(moved?.deletedRemoteAt).toBeUndefined();

    // La pasada de la carpeta vieja ya no lo encuentra; no debe ocultarlo.
    await first.action(api.mailSync.syncNow, { folderRemoteId: "2" });
    expect(
      (await first.query(api.mailHeaders.list, { folderRemoteId: "5" })).total,
    ).toBe(1);
    expect((await accountFor(t, firstId))?.status).toBe("connected");
  });

  test("la búsqueda local no cruza usuarios y no pide al servidor", async () => {
    const { first, t } = await setup();
    await t.run(async (ctx) => {
      const accounts = await ctx.db.query("mailAccounts").collect();
      for (const account of accounts) {
        await ctx.db.insert("mailHeaders", {
          userId: account.userId,
          accountId: account._id,
          folderRemoteId: "2",
          messageId: account.email === "tecnica@rtva.es" ? "1" : "2",
          subject:
            account.email === "tecnica@rtva.es"
              ? "Afectación de apagado"
              : "Presupuesto ajeno",
          fromName:
            account.email === "tecnica@rtva.es" ? "Javier Lobo" : "Proveedor",
          fromAddress:
            account.email === "tecnica@rtva.es"
              ? "jlobo@rtva.es"
              : "sat@proveedor.es",
          date: Date.now(),
          size: 10,
          flags: "u",
          hasAttachments: false,
          snippet: "",
          bodyState: "none",
        });
      }
    });

    const own = await first.query(api.mailHeaders.list, {
      folderRemoteId: "2",
      search: "afectacion",
    });
    expect(own.total).toBe(1);
    expect(own.headers[0]?.subject).toBe("Afectación de apagado");
    expect(
      (
        await first.query(api.mailHeaders.list, {
          folderRemoteId: "2",
          search: "ajeno",
        })
      ).total,
    ).toBe(0);
  });

  test("la baja de usuario salta la cuenta sin tocar ni pedir nada", async () => {
    const { t, firstId } = await setup();
    const account = await accountFor(t, firstId);
    if (!account) throw new Error("falta la cuenta");
    await t.run((ctx) => ctx.db.patch(firstId, { active: false }));
    const fetchMock = stubMailbox({ searchPages: [], syncPages: [] });

    expect(await t.query(internal.mailSync.dueAccounts, {})).not.toContain(
      account._id,
    );
    expect(
      await t.action(internal.mailSync.syncAccount, {
        accountId: account._id,
      }),
    ).toEqual({ ok: false, reason: "skipped" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await accountFor(t, firstId))?.lastSyncAt).toBeUndefined();
  });

  test("un fallo de credenciales deja reauthRequired y ninguna cabecera", async () => {
    const { first, t, firstId } = await setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(fixture("fault.xml"))),
    );

    await expectConvexError(
      first.action(api.mailSync.syncNow, { folderRemoteId: "2" }),
      "credenciales",
    );
    const account = await accountFor(t, firstId);
    expect(account?.status).toBe("reauthRequired");
    expect(account?.authToken).toBeUndefined();
    expect(account?.syncLeaseUntil).toBeUndefined();
    expect(await t.run((ctx) => ctx.db.query("mailHeaders").collect())).toEqual(
      [],
    );
  });

  test("un lease vivo devuelve ocupado sin hacer peticiones", async () => {
    const { first, t, firstId } = await setup();
    const account = await accountFor(t, firstId);
    if (!account) throw new Error("falta la cuenta");
    await t.run((ctx) =>
      ctx.db.patch(account._id, {
        syncLeaseUntil: Date.now() + 60_000,
      }),
    );
    const fetchMock = stubMailbox({ searchPages: [], syncPages: [] });

    expect(
      await first.action(api.mailSync.syncNow, { folderRemoteId: "2" }),
    ).toEqual({ ok: false, reason: "busy" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
