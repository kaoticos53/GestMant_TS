import { readFileSync } from "node:fs";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ConvexError } from "convex/values";
import { api } from "../src/convex/_generated/api";
import {
  MAIL_CACHE_DEFAULT_LIMIT_BYTES,
  MAIL_CACHE_DEFAULT_RETENTION_DAYS,
  MAIL_CACHE_MAX_LIMIT_BYTES,
  MAIL_CACHE_MIN_LIMIT_BYTES,
  MAIL_SERVER_URL,
  clampCacheLimit,
  clampCacheRetention,
  normalizeMailAddress,
} from "../src/lib/mailClient/account";
import { parseAuthResponse } from "../src/lib/mailClient/auth";
import { backend } from "./backend";

function fixture(name: string): string {
  return readFileSync(
    new URL(`./fixtures/mail/${name}`, import.meta.url),
    "utf8",
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

const draft = {
  email: "tecnico@rtva.es",
  password: "app-password-1234",
  enabled: true,
  cacheLimitBytes: MAIL_CACHE_DEFAULT_LIMIT_BYTES,
  cacheRetentionDays: MAIL_CACHE_DEFAULT_RETENTION_DAYS,
};

async function setup() {
  const t = backend();
  const adminId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Ana Ferrer",
      email: "admin@taller.es",
      role: "admin",
    }),
  );
  const firstId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Técnica Uno",
      email: "tecnica@taller.es",
      role: "technician",
    }),
  );
  const secondId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Técnico Dos",
      email: "tecnico2@taller.es",
      role: "technician",
    }),
  );
  const guestId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Invitada",
      email: "invitada@taller.es",
      role: "guest",
      isAnonymous: true,
    }),
  );
  const inactiveId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Baja",
      email: "baja@taller.es",
      role: "technician",
      active: false,
    }),
  );

  return {
    t,
    adminId,
    firstId,
    secondId,
    guestId,
    inactiveId,
    admin: t.withIdentity({ subject: `${adminId}|s-admin` }),
    first: t.withIdentity({ subject: `${firstId}|s-first` }),
    second: t.withIdentity({ subject: `${secondId}|s-second` }),
    guest: t.withIdentity({ subject: `${guestId}|s-guest` }),
    inactive: t.withIdentity({ subject: `${inactiveId}|s-baja` }),
  };
}

function stubConnection({
  auth = fixture("auth.xml"),
  folders = fixture("folders.xml"),
  authStatus = 200,
  foldersStatus = 200,
}: {
  auth?: string;
  folders?: string;
  authStatus?: number;
  foldersStatus?: number;
} = {}) {
  const fetchMock = vi.fn(async () => {
    const call = fetchMock.mock.calls.length;
    return call === 1
      ? new Response(auth, { status: authStatus })
      : new Response(folders, { status: foldersStatus });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.PULSO_SETTINGS_ENCRYPTION_KEY;
});

describe("cuenta de correo — reglas puras", () => {
  test("AuthResponse da token y vida en milisegundos", () => {
    expect(parseAuthResponse(fixture("auth.xml"))).toEqual({
      authToken: "zm_token_fixture_123",
      lifetimeMs: 43199999,
    });
  });

  test("el buzón se normaliza y exige dirección completa", () => {
    expect(normalizeMailAddress("  Tecnico@RTVA.es ")).toBe("tecnico@rtva.es");
    expect(normalizeMailAddress("tecnico")).toBeNull();
    expect(normalizeMailAddress("tecnico@")).toBeNull();
    expect(normalizeMailAddress("tecnico @rtva.es")).toBeNull();
    expect(normalizeMailAddress("a@b@rtva.es")).toBeNull();
  });

  test("los límites de caché se quedan dentro de lo permitido", () => {
    expect(clampCacheLimit(1)).toBe(MAIL_CACHE_MIN_LIMIT_BYTES);
    expect(clampCacheLimit(Number.MAX_SAFE_INTEGER)).toBe(
      MAIL_CACHE_MAX_LIMIT_BYTES,
    );
    expect(clampCacheLimit(Number.NaN)).toBe(MAIL_CACHE_DEFAULT_LIMIT_BYTES);
    expect(clampCacheRetention(1)).toBe(7);
    expect(clampCacheRetention(9999)).toBe(365);
    expect(clampCacheRetention(Number.NaN)).toBe(
      MAIL_CACHE_DEFAULT_RETENTION_DAYS,
    );
  });
});

describe("cuenta de correo — backend aislado", () => {
  test("cada persona guarda su cuenta, con contraseña cifrada y sin secretos en la vista", async () => {
    process.env.PULSO_SETTINGS_ENCRYPTION_KEY = "clave-de-prueba-f2";
    const { first, t } = await setup();

    const saved = await first.mutation(api.mailAccounts.save, draft);

    expect(saved.email).toBe("tecnico@rtva.es");
    expect(saved.serverUrl).toBe(MAIL_SERVER_URL);
    expect(saved.status).toBe("disconnected");
    expect(saved.hasPassword).toBe(true);
    expect(saved.passwordHint).toBe("…1234");
    expect(JSON.stringify(saved)).not.toContain(draft.password);

    const row = await t.run((ctx) =>
      ctx.db.query("mailAccounts").withIndex("by_user").first(),
    );
    expect(row?.password).toMatch(/^enc:v1:/);
    expect(row?.password).not.toContain(draft.password);

    const view = await first.query(api.mailAccounts.account, {});
    expect(view).toMatchObject({
      email: "tecnico@rtva.es",
      status: "disconnected",
      hasPassword: true,
    });
    expect(JSON.stringify(view)).not.toContain(draft.password);
  });

  test("el administrador no puede leer ni probar el buzón de otra persona", async () => {
    const { first, admin, t } = await setup();
    await first.mutation(api.mailAccounts.save, draft);

    expect(await admin.query(api.mailAccounts.account, {})).toBeNull();
    await expectConvexError(
      admin.action(api.mailAccounts.testConnection, {}),
      "buzón",
    );
    const rows = await t.run((ctx) => ctx.db.query("mailAccounts").collect());
    expect(rows).toHaveLength(1);
  });

  test("el invitado y la cuenta de baja no pueden configurar nada", async () => {
    const { guest, inactive } = await setup();

    await expectConvexError(
      guest.mutation(api.mailAccounts.save, draft),
      "sesión",
    );
    await expectConvexError(
      inactive.mutation(api.mailAccounts.save, draft),
      "baja",
    );
    await expectConvexError(
      guest.query(api.mailAccounts.account, {}),
      "sesión",
    );
  });

  test("una dirección incompleta no se guarda", async () => {
    const { first, t } = await setup();

    await expectConvexError(
      first.mutation(api.mailAccounts.save, { ...draft, email: "tecnico" }),
      "dirección",
    );
    expect(
      await t.run((ctx) => ctx.db.query("mailAccounts").collect()),
    ).toEqual([]);
  });

  test("probar conexión guarda token, estado y carpetas de correo", async () => {
    process.env.PULSO_SETTINGS_ENCRYPTION_KEY = "clave-de-prueba-f2";
    const { first, t } = await setup();
    await first.mutation(api.mailAccounts.save, draft);
    const fetchMock = stubConnection();

    const result = await first.action(api.mailAccounts.testConnection, {});

    expect(result).toMatchObject({
      ok: true,
      email: "tecnico@rtva.es",
      folderCount: 6,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [authUrl, authInit] = fetchMock.mock.calls[0] as unknown as [
      string,
      { body: string },
    ];
    expect(authUrl).toBe(`${MAIL_SERVER_URL}/service/soap`);
    expect(authInit.body).toContain("<AuthRequest");
    const [, folderInit] = fetchMock.mock.calls[1] as unknown as [
      string,
      { body: string },
    ];
    expect(folderInit.body).toContain("<GetFolderRequest");

    const account = await t.run((ctx) =>
      ctx.db.query("mailAccounts").withIndex("by_user").first(),
    );
    expect(account?.status).toBe("connected");
    expect(account?.authToken).toMatch(/^enc:v1:/);
    expect(account?.tokenExpiresAt).toBeGreaterThan(Date.now());
    expect(account?.password).toMatch(/^enc:v1:/);

    const folders = await first.query(api.mailAccounts.folders, {});
    expect(folders.map((folder) => folder.name)).toEqual([
      "Inbox",
      "Sent",
      "Trash",
      "Personales",
      "Archive",
      "2026",
    ]);
    expect(folders.every((folder) => folder.isMail)).toBe(true);
  });

  test("un fallo de credenciales deja la cuenta en reauthRequired y no guarda token", async () => {
    const { first, t } = await setup();
    await first.mutation(api.mailAccounts.save, draft);
    stubConnection({ auth: fixture("fault.xml"), authStatus: 200 });

    await expectConvexError(
      first.action(api.mailAccounts.testConnection, {}),
      "credenciales",
    );

    const account = await t.run((ctx) =>
      ctx.db.query("mailAccounts").withIndex("by_user").first(),
    );
    expect(account?.status).toBe("reauthRequired");
    expect(account?.authToken).toBeUndefined();
    expect(account?.lastSyncError).toContain("AUTH_FAILED");
  });

  test("dos técnicos solo ven su cuenta y sus carpetas", async () => {
    const { first, second, t } = await setup();
    await first.mutation(api.mailAccounts.save, draft);
    await second.mutation(api.mailAccounts.save, {
      ...draft,
      email: "tecnico2@rtva.es",
    });
    const rows = await t.run((ctx) => ctx.db.query("mailAccounts").collect());
    expect(rows).toHaveLength(2);

    await t.run(async (ctx) => {
      const firstRow = rows.find((row) => row.email === "tecnico@rtva.es");
      const secondRow = rows.find((row) => row.email === "tecnico2@rtva.es");
      if (!firstRow || !secondRow) throw new Error("faltan cuentas");
      await ctx.db.insert("mailFolders", {
        userId: firstRow.userId,
        accountId: firstRow._id,
        remoteId: "2",
        parentRemoteId: null,
        name: "Inbox",
        path: "/Inbox",
        kind: "message",
        isMail: true,
        syncEnabled: true,
        unread: 1,
        total: 2,
        size: 3,
        sortOrder: 0,
      });
      await ctx.db.insert("mailFolders", {
        userId: secondRow.userId,
        accountId: secondRow._id,
        remoteId: "5",
        parentRemoteId: null,
        name: "Sent",
        path: "/Sent",
        kind: "message",
        isMail: true,
        syncEnabled: true,
        unread: 0,
        total: 4,
        size: 5,
        sortOrder: 0,
      });
    });

    expect(
      (await first.query(api.mailAccounts.folders, {})).map((f) => f.name),
    ).toEqual(["Inbox"]);
    expect(
      (await second.query(api.mailAccounts.folders, {})).map((f) => f.name),
    ).toEqual(["Sent"]);
  });

  test("desconectar borra credenciales y, si se pide, también las carpetas", async () => {
    const { first, t } = await setup();
    await first.mutation(api.mailAccounts.save, draft);
    stubConnection();
    await first.action(api.mailAccounts.testConnection, {});

    await first.mutation(api.mailAccounts.disconnect, { deleteCache: true });

    const account = await t.run((ctx) =>
      ctx.db.query("mailAccounts").withIndex("by_user").first(),
    );
    expect(account?.status).toBe("disconnected");
    expect(account?.password).toBeUndefined();
    expect(account?.authToken).toBeUndefined();
    expect(account?.cacheBytes).toBe(0);
    expect(await t.run((ctx) => ctx.db.query("mailFolders").collect())).toEqual(
      [],
    );
    expect(await first.query(api.mailAccounts.account, {})).toMatchObject({
      hasPassword: false,
      status: "disconnected",
    });
  });

  test("borrar la cuenta se lleva sus carpetas y deja auditoría sin contenido", async () => {
    const { first, t } = await setup();
    await first.mutation(api.mailAccounts.save, draft);
    stubConnection();
    await first.action(api.mailAccounts.testConnection, {});

    await first.mutation(api.mailAccounts.remove, {});

    expect(
      await t.run((ctx) => ctx.db.query("mailAccounts").collect()),
    ).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("mailFolders").collect())).toEqual(
      [],
    );
    const logs = await t.run((ctx) =>
      ctx.db
        .query("securityAuditLog")
        .withIndex("by_action", (q) => q.eq("action", "mail_account_change"))
        .collect(),
    );
    expect(logs.length).toBeGreaterThan(0);
    expect(JSON.stringify(logs)).not.toContain(draft.password);
    expect(JSON.stringify(logs)).not.toContain("Inbox");
  });
});
