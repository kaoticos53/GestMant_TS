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
});
