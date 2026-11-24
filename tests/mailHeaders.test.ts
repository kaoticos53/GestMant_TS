import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { api } from "../src/convex/_generated/api";
import { backend } from "./backend";

const DRAFT = {
  email: "tecnica@rtva.es",
  password: "app-password-1234",
  enabled: true,
  cacheLimitBytes: 512 * 1024 * 1024,
  cacheRetentionDays: 30,
};

const TOTAL = 205;
const PAGE_SIZE = 100;
const DATE_BASE = 1_700_000_000_000;

beforeEach(() => {
  process.env.PULSO_SETTINGS_ENCRYPTION_KEY = "clave-de-prueba-mailheaders";
});

afterEach(() => {
  delete process.env.PULSO_SETTINGS_ENCRYPTION_KEY;
});

async function setup() {
  const t = backend();
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Técnica de pruebas",
      email: "tecnica@taller.es",
      role: "technician",
    }),
  );
  const first = t.withIdentity({ subject: `${userId}|s-mailheaders` });
  await first.mutation(api.mailAccounts.save, DRAFT);

  const account = await t.run((ctx) =>
    ctx.db
      .query("mailAccounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first(),
  );
  if (!account) throw new Error("No se creó la cuenta del buzón");

  await t.run(async (ctx) => {
    for (let index = 1; index <= TOTAL; index += 1) {
      await ctx.db.insert("mailHeaders", {
        userId,
        accountId: account._id,
        folderRemoteId: "2",
        messageId: `m-${index}`,
        subject:
          index <= 3 ? `Presupuesto ${index}` : `Asunto de prueba ${index}`,
        fromName: index <= 3 ? "Proveedor" : "Taller",
        fromAddress: index <= 3 ? "proveedor@externo.es" : "taller@rtva.es",
        date: DATE_BASE - index * 1_000,
        size: 1_024,
        flags: index % 2 === 0 ? "u" : "",
        hasAttachments: false,
        snippet: "",
        bodyState: "none",
      });
    }
  });

  return { first };
}

describe("mailHeaders.list — límites de paginación", () => {
  test("offset fuera de rango, última página parcial y total filtrado por búsqueda", async () => {
    const { first } = await setup();

    const beyond = await first.query(api.mailHeaders.list, {
      folderRemoteId: "2",
      limit: PAGE_SIZE,
      offset: TOTAL + 100,
    });
    expect(beyond.headers).toEqual([]);
    expect(beyond.total).toBe(TOTAL);

    const lastPage = await first.query(api.mailHeaders.list, {
      folderRemoteId: "2",
      limit: PAGE_SIZE,
      offset: 200,
    });
    expect(lastPage.headers).toHaveLength(5);
    expect(lastPage.headers.map((header) => header.messageId)).toEqual([
      "m-201",
      "m-202",
      "m-203",
      "m-204",
      "m-205",
    ]);
    expect(lastPage.total).toBe(TOTAL);

    const search = await first.query(api.mailHeaders.list, {
      folderRemoteId: "2",
      search: "presupuesto",
      limit: PAGE_SIZE,
      offset: 0,
    });
    expect(search.headers).toHaveLength(3);
    expect(search.total).toBe(3);
    expect(
      search.headers.every((header) =>
        header.subject.startsWith("Presupuesto"),
      ),
    ).toBe(true);
  });

  test("vía rápida por fecha excluye tumbas deletedRemoteAt, respeta sortDir y mantiene conteos", async () => {
    const t = backend();
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Técnica rápida",
        email: "rapida@taller.es",
        role: "technician",
      }),
    );
    const first = t.withIdentity({ subject: `${userId}|s-fastpath` });
    await first.mutation(api.mailAccounts.save, DRAFT);
    const account = await t.run((ctx) =>
      ctx.db
        .query("mailAccounts")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first(),
    );
    if (!account) throw new Error("Falta cuenta");

    await t.run(async (ctx) => {
      await ctx.db.insert("mailHeaders", {
        userId,
        accountId: account._id,
        folderRemoteId: "2",
        messageId: "m-old",
        subject: "Antiguo",
        fromName: "A",
        fromAddress: "a@t.es",
        date: 1000,
        size: 100,
        flags: "u",
        hasAttachments: false,
        snippet: "",
        bodyState: "none",
      });
      await ctx.db.insert("mailHeaders", {
        userId,
        accountId: account._id,
        folderRemoteId: "2",
        messageId: "m-deleted",
        subject: "Borrado",
        fromName: "B",
        fromAddress: "b@t.es",
        date: 2000,
        size: 100,
        flags: "u",
        hasAttachments: false,
        snippet: "",
        bodyState: "none",
        deletedRemoteAt: 9999,
      });
      await ctx.db.insert("mailHeaders", {
        userId,
        accountId: account._id,
        folderRemoteId: "2",
        messageId: "m-new",
        subject: "Nuevo",
        fromName: "C",
        fromAddress: "c@t.es",
        date: 3000,
        size: 100,
        flags: "",
        hasAttachments: false,
        snippet: "",
        bodyState: "none",
      });
    });

    const asc = await first.query(api.mailHeaders.list, {
      folderRemoteId: "2",
      sortBy: "date",
      sortDir: "asc",
      limit: 1,
      offset: 0,
    });
    expect(asc.total).toBe(2);
    expect(asc.unread).toBe(1);
    expect(asc.headers.map((h) => h.messageId)).toEqual(["m-old"]);
    expect(asc.headers[0]?.threadCount).toBe(1);

    const descPage2 = await first.query(api.mailHeaders.list, {
      folderRemoteId: "2",
      sortBy: "date",
      sortDir: "desc",
      limit: 1,
      offset: 1,
    });
    expect(descPage2.total).toBe(2);
    expect(descPage2.headers.map((h) => h.messageId)).toEqual(["m-old"]);
  });
});
