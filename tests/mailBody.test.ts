import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ConvexError } from "convex/values";
import { api, internal } from "../src/convex/_generated/api";
import type { Id } from "../src/convex/_generated/dataModel";
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

const RAW = new TextEncoder().encode(
  [
    "From: Taller Central <taller@rtva.es>",
    "To: tecnico@rtva.es",
    "Subject: Mensaje con adjuntos",
    "MIME-Version: 1.0",
    'Content-Type: multipart/mixed; boundary="mix"',
    "",
    "--mix",
    'Content-Type: multipart/alternative; boundary="alt"',
    "",
    "--alt",
    'Content-Type: text/plain; charset="utf-8"',
    "",
    "Hola desde el taller.",
    "--alt",
    'Content-Type: text/html; charset="utf-8"',
    "",
    '<html><body><p>Hola taller.</p><img src="cid:logo@rtva"></body></html>',
    "--alt--",
    "--mix",
    'Content-Type: image/png; name="logo.png"',
    "Content-Transfer-Encoding: base64",
    "Content-ID: <logo@rtva>",
    'Content-Disposition: inline; filename="logo.png"',
    "",
    "iVBORw0KGgo=",
    "--mix",
    'Content-Type: application/pdf; name="informe.pdf"',
    "Content-Transfer-Encoding: base64",
    'Content-Disposition: attachment; filename="informe.pdf"',
    "",
    "JVBERi0xLjQK",
    "--mix--",
  ].join("\r\n"),
);

function getMessageXml(size: number): string {
  return soap(
    `<GetMsgResponse xmlns="urn:zimbraMail"><m id="17438" s="${size}">` +
      '<content url="/service/content/get?id=17438"/></m></GetMsgResponse>',
  );
}

function responseBytes(bytes: Uint8Array): Response {
  return new Response(bytes.slice().buffer);
}

function stubMailbox(size = RAW.byteLength): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(
    async (url: string, init?: RequestInit): Promise<Response> => {
      const body = String(init?.body ?? "");
      if (body.includes("<AuthRequest")) {
        return new Response(fixture("auth.xml"));
      }
      if (body.includes("<GetMsgRequest")) {
        return new Response(getMessageXml(size));
      }
      if (url.includes("/service/content/get")) {
        return responseBytes(RAW);
      }
      throw new Error(`Petición inesperada: ${body.slice(0, 60)} ${url}`);
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function createUser(
  t: ReturnType<typeof backend>,
  email: string,
): Promise<Id<"users">> {
  return await t.run((ctx) =>
    ctx.db.insert("users", { name: email, email, role: "technician" }),
  );
}

async function setup() {
  const t = backend();
  const firstId = await createUser(t, "tecnica@taller.es");
  const secondId = await createUser(t, "tecnico2@taller.es");
  const first = t.withIdentity({ subject: `${firstId}|s-first` });
  const second = t.withIdentity({ subject: `${secondId}|s-second` });
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
  await t.run(async (ctx) => {
    const account = await ctx.db
      .query("mailAccounts")
      .withIndex("by_user")
      .filter((q) => q.eq(q.field("userId"), firstId))
      .first();
    if (!account) throw new Error("Sin cuenta");
    await ctx.db.insert("mailHeaders", {
      userId: firstId,
      accountId: account._id,
      folderRemoteId: "2",
      messageId: "17438",
      subject: "Mensaje con adjuntos",
      fromName: "Taller Central",
      fromAddress: "taller@rtva.es",
      date: 1_795_179_963_000,
      size: RAW.byteLength,
      flags: "u",
      hasAttachments: true,
      snippet: "Hola desde el taller.",
      bodyState: "none",
    });
  });
  return { t, first, second, firstId, secondId };
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
  process.env.PULSO_SETTINGS_ENCRYPTION_KEY = "clave-de-prueba-f4";
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.PULSO_SETTINGS_ENCRYPTION_KEY;
});

describe("apertura de un mensaje y caché de contenido", () => {
  test("descarga con read=0, verifica bytes y guarda una sola copia", async () => {
    const { t, first, firstId } = await setup();
    const fetchMock = stubMailbox();

    const opened = await first.action(api.mailBody.open, {
      messageId: "17438",
    });

    expect(opened.cached).toBe(false);
    expect(opened.text).toContain("Hola desde el taller.");
    expect(opened.html).toContain("cid:logo@rtva");
    expect(opened.attachments).toHaveLength(2);
    expect(
      opened.attachments.find((a) => a.filename === "informe.pdf"),
    ).toMatchObject({ contentType: "application/pdf", size: 9 });

    const getMessage = fetchMock.mock.calls.find(([, init]) =>
      String(init?.body ?? "").includes("<GetMsgRequest"),
    );
    expect(String(getMessage?.[1]?.body)).toContain(
      '<m id="17438" read="0" raw="1" useContentUrl="1"/>',
    );
    const contentCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes("/service/content/get"),
    );
    expect(contentCall?.[1]?.headers).toMatchObject({
      cookie: "ZM_AUTH_TOKEN=zm_token_fixture_123",
    });

    const rows = await t.run(async (ctx) => ({
      body: await ctx.db.query("mailBodies").collect(),
      attachments: await ctx.db.query("mailAttachments").collect(),
      files: await ctx.db.system.query("_storage").collect(),
      header: await ctx.db.query("mailHeaders").first(),
      account: await ctx.db.query("mailAccounts").first(),
    }));
    expect(rows.body).toHaveLength(1);
    expect(rows.attachments).toHaveLength(2);
    expect(rows.files).toHaveLength(2);
    expect(rows.files.every((file) => file.size !== RAW.byteLength)).toBe(true);
    expect(rows.header?.bodyState).toBe("cached");
    expect(rows.header?.flags).toBe("u");
    expect(rows.account?.cacheBytes).toBe(
      opened.bodyBytes + opened.attachments.reduce((sum, a) => sum + a.size, 0),
    );

    const before = fetchMock.mock.calls.length;
    const again = await first.action(api.mailBody.open, {
      messageId: "17438",
    });
    expect(again.cached).toBe(true);
    expect(fetchMock.mock.calls.length).toBe(before);

    const attachment = rows.attachments.find(
      (row) => row.filename === "informe.pdf",
    );
    expect(attachment).toBeDefined();
    if (!attachment) return;
    const download = await first.action(api.mailAttachments.download, {
      attachmentId: attachment._id,
    });
    expect(download.url).toBeTruthy();
    expect(download.filename).toBe("informe.pdf");

    const otherRows = await t.run((ctx) =>
      ctx.db
        .query("mailAccounts")
        .withIndex("by_user")
        .filter((q) => q.neq(q.field("userId"), firstId))
        .first(),
    );
    expect(otherRows).not.toBeNull();
  });

  test("rechaza una descarga cuyos bytes no coinciden y no deja restos", async () => {
    const { t, first } = await setup();
    await t.run(async (ctx) => {
      const header = await ctx.db.query("mailHeaders").first();
      if (!header) throw new Error("Sin cabecera");
      await ctx.db.patch(header._id, { size: RAW.byteLength + 1 });
    });
    stubMailbox(RAW.byteLength + 1);

    await expectConvexError(
      first.action(api.mailBody.open, { messageId: "17438" }),
      "no coinciden",
    );
    const rows = await t.run(async (ctx) => ({
      body: await ctx.db.query("mailBodies").collect(),
      attachments: await ctx.db.query("mailAttachments").collect(),
      files: await ctx.db.system.query("_storage").collect(),
      header: await ctx.db.query("mailHeaders").first(),
    }));
    expect(rows.body).toHaveLength(0);
    expect(rows.attachments).toHaveLength(0);
    expect(rows.files).toHaveLength(0);
    expect(rows.header?.bodyState).toBe("error");
  });

  test("marca tooLarge sin pedir el contenido", async () => {
    const { t, first } = await setup();
    await t.run(async (ctx) => {
      const header = await ctx.db.query("mailHeaders").first();
      if (!header) throw new Error("Sin cabecera");
      await ctx.db.patch(header._id, { size: 50 * 1024 * 1024 + 1 });
    });
    const fetchMock = stubMailbox();

    await expectConvexError(
      first.action(api.mailBody.open, { messageId: "17438" }),
      "50 MB",
    );
    expect(fetchMock).not.toHaveBeenCalled();
    const header = await t.run((ctx) => ctx.db.query("mailHeaders").first());
    expect(header?.bodyState).toBe("tooLarge");
  });

  test("la caché expulsa el mensaje menos usado antes de guardar otro", async () => {
    const { t, first, firstId } = await setup();
    await t.run(async (ctx) => {
      const account = await ctx.db
        .query("mailAccounts")
        .withIndex("by_user")
        .filter((q) => q.eq(q.field("userId"), firstId))
        .first();
      if (!account) throw new Error("Sin cuenta");
      await ctx.db.patch(account._id, { cacheLimitBytes: 200 });
      await ctx.db.insert("mailHeaders", {
        userId: firstId,
        accountId: account._id,
        folderRemoteId: "2",
        messageId: "17436",
        subject: "Segundo mensaje",
        fromName: "Taller Central",
        fromAddress: "taller@rtva.es",
        date: 1_795_179_964_000,
        size: RAW.byteLength,
        flags: "u",
        hasAttachments: true,
        snippet: "Segundo mensaje",
        bodyState: "none",
      });
    });
    stubMailbox();
    await first.action(api.mailBody.open, { messageId: "17438" });

    await first.action(api.mailBody.open, { messageId: "17436" });
    const rows = await t.run(async (ctx) => ({
      headers: await ctx.db.query("mailHeaders").collect(),
      body: await ctx.db.query("mailBodies").collect(),
      account: await ctx.db.query("mailAccounts").first(),
    }));
    expect(rows.headers.find((h) => h.messageId === "17438")?.bodyState).toBe(
      "none",
    );
    expect(rows.headers.find((h) => h.messageId === "17436")?.bodyState).toBe(
      "cached",
    );
    expect(rows.body.map((body) => body.messageId)).toEqual(["17436"]);
    expect(rows.account?.cacheBytes).toBeLessThanOrEqual(200);
  });

  test("storageCleanup no borra los adjuntos que cita mailAttachments", async () => {
    const { t, first } = await setup();
    stubMailbox();
    await first.action(api.mailBody.open, { messageId: "17438" });

    const before = await t.run((ctx) =>
      ctx.db.system.query("_storage").collect(),
    );
    expect(before).toHaveLength(2);
    await t.mutation(internal.storageCleanup.sweepOrphanFiles, {
      before: Date.now() + 60_000,
    });
    const after = await t.run((ctx) =>
      ctx.db.system.query("_storage").collect(),
    );
    expect(after).toHaveLength(2);
  });

  test("vaciar caché borra cuerpo, adjuntos y objetos sin tocar la cabecera", async () => {
    const { t, first } = await setup();
    stubMailbox();
    await first.action(api.mailBody.open, { messageId: "17438" });

    const result = await first.mutation(api.mailCache.empty, {});
    expect(result.messages).toBe(1);
    expect(result.bytes).toBeGreaterThan(0);
    const rows = await t.run(async (ctx) => ({
      body: await ctx.db.query("mailBodies").collect(),
      attachments: await ctx.db.query("mailAttachments").collect(),
      files: await ctx.db.system.query("_storage").collect(),
      header: await ctx.db.query("mailHeaders").first(),
      account: await ctx.db.query("mailAccounts").first(),
    }));
    expect(rows.body).toHaveLength(0);
    expect(rows.attachments).toHaveLength(0);
    expect(rows.files).toHaveLength(0);
    expect(rows.header?.bodyState).toBe("none");
    expect(rows.account?.cacheBytes).toBe(0);
  });

  test("el barrido caduca por última apertura y reconcilia contadores", async () => {
    const { t, first } = await setup();
    stubMailbox();
    await first.action(api.mailBody.open, { messageId: "17438" });

    const old = Date.now() - 31 * 24 * 60 * 60 * 1000;
    await t.run(async (ctx) => {
      const header = await ctx.db.query("mailHeaders").first();
      if (!header) throw new Error("Sin cabecera");
      await ctx.db.patch(header._id, { lastOpenedAt: old, cachedAt: old });
    });
    const swept = await t.mutation(internal.mailCache.sweepExpired, {});
    expect(swept.messages).toBe(1);
    const rows = await t.run(async (ctx) => ({
      body: await ctx.db.query("mailBodies").collect(),
      attachments: await ctx.db.query("mailAttachments").collect(),
      header: await ctx.db.query("mailHeaders").first(),
      account: await ctx.db.query("mailAccounts").first(),
    }));
    expect(rows.body).toHaveLength(0);
    expect(rows.attachments).toHaveLength(0);
    expect(rows.header?.bodyState).toBe("none");
    expect(rows.account?.cacheBytes).toBe(0);
  });

  test("el barrido purga la caché si el dueño pierde la capacidad", async () => {
    const { t, first, firstId } = await setup();
    stubMailbox();
    await first.action(api.mailBody.open, { messageId: "17438" });

    await t.run(async (ctx) => {
      await ctx.db.patch(firstId, { active: false });
    });
    const swept = await t.mutation(internal.mailCache.sweepExpired, {});
    expect(swept.messages).toBe(1);
    const rows = await t.run(async (ctx) => ({
      body: await ctx.db.query("mailBodies").collect(),
      attachments: await ctx.db.query("mailAttachments").collect(),
      header: await ctx.db.query("mailHeaders").first(),
      account: await ctx.db.query("mailAccounts").first(),
    }));
    expect(rows.body).toHaveLength(0);
    expect(rows.attachments).toHaveLength(0);
    expect(rows.header?.bodyState).toBe("none");
    expect(rows.account?.cacheBytes).toBe(0);
  });

  test("un segundo usuario no puede abrir ni descargar el mensaje ajeno", async () => {
    const { second } = await setup();
    stubMailbox();
    await expectConvexError(
      second.action(api.mailBody.open, { messageId: "17438" }),
      "ya no está",
    );
  });
});
