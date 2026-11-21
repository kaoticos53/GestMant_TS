import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  buildAuthRequest,
  buildGetFolderRequest,
  buildGetMessageRequest,
  buildSearchRequest,
  buildSyncRequest,
} from "../src/lib/mailClient/soap";
import {
  isMailFolder,
  parseFolderTree,
  parseMailFolders,
} from "../src/lib/mailClient/folders";
import {
  formatSearchDate,
  hasMoreSearchResults,
  nextSearchOffset,
  parseSearchResponse,
  sortHeadersByDateDesc,
} from "../src/lib/mailClient/search";
import {
  parseSyncResponse,
  shouldContinueSync,
} from "../src/lib/mailClient/sync";
import {
  parseGetMessageResponse,
  resolveContentUrl,
} from "../src/lib/mailClient/getMessage";
import {
  classifyHttpFailure,
  parseSoapFault,
  type MailFault,
} from "../src/lib/mailClient/errors";

function fixture(name: string): string {
  return readFileSync(
    new URL(`./fixtures/mail/${name}`, import.meta.url),
    "utf8",
  );
}

function soap(body: string): string {
  return `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"><soap:Body>${body}</soap:Body></soap:Envelope>`;
}

describe("constructores SOAP — el contrato que no se negocia", () => {
  test("AuthRequest lleva el buzón completo y escapea credenciales", () => {
    const xml = buildAuthRequest({
      account: "a&b@rtva.es",
      password: "p<w>",
    });

    expect(xml).toContain('<AuthRequest xmlns="urn:zimbraAccount">');
    expect(xml).toContain('<account by="name">a&amp;b@rtva.es</account>');
    expect(xml).toContain("<password>p&lt;w&gt;</password>");
    expect(xml).toContain("<soap:Header/>");
    expect(xml).not.toContain("authToken");
  });

  test("GetFolder lleva el token en el contexto SOAP", () => {
    const xml = buildGetFolderRequest({ authToken: "token-1" });

    expect(xml).toContain('<context xmlns="urn:zimbra">');
    expect(xml).toContain("<authToken>token-1</authToken>");
    expect(xml).toContain('<GetFolderRequest xmlns="urn:zimbraMail">');
  });

  test("Search pagina con dateAsc y escapa las comillas de in: sin usar total", () => {
    const xml = buildSearchRequest({
      authToken: "token-1",
      folderPath: "/Inbox",
      offset: 500,
      limit: 500,
      after: "11/19/2026",
    });

    expect(xml).toContain('types="message"');
    expect(xml).toContain('sortBy="dateAsc"');
    expect(xml).toContain('offset="500"');
    expect(xml).toContain('limit="500"');
    expect(xml).toContain('query="in:&quot;/Inbox&quot; after:11/19/2026"');
    expect(xml).not.toContain("total=");
  });

  test("Sync omite el token inicial y lo incluye cuando existe", () => {
    const initial = buildSyncRequest({ authToken: "token-1", folderId: "2" });
    const incremental = buildSyncRequest({
      authToken: "token-1",
      folderId: "2",
      token: "138933",
    });

    expect(initial).toContain('l="2"');
    expect(initial).toContain('msgCutoff="0"');
    expect(initial).toContain('changeLimit="1000"');
    expect(initial).toContain('deleteLimit="1000"');
    expect(initial).not.toContain("token=");
    expect(incremental).toContain('token="138933"');
  });

  test("GetMsg siempre pide lectura sin marcar y contenido por URL", () => {
    const xml = buildGetMessageRequest({
      authToken: "token-1",
      messageId: "17438",
    });

    expect(xml).toContain('<m id="17438" read="0" raw="1" useContentUrl="1"/>');
    expect(xml).not.toContain('read="1"');
  });
});

describe("GetFolder — carpetas de correo sin depender de ids", () => {
  test("parsea el árbol y conserva la jerarquía", () => {
    const folders = parseFolderTree(fixture("folders.xml"));

    expect(folders).toHaveLength(9);
    expect(folders[0]).toMatchObject({
      remoteId: "1",
      name: "USER_ROOT",
      parentRemoteId: null,
      path: "/",
      isMail: false,
    });

    const archive = folders.find((folder) => folder.name === "Archive");
    const nested = folders.find((folder) => folder.name === "2026");
    expect(archive).toMatchObject({
      remoteId: "4820",
      kind: "message",
      total: 41,
      isMail: true,
    });
    expect(nested).toMatchObject({
      remoteId: "4821",
      parentRemoteId: "4820",
      path: "/Archive/2026",
      total: 10,
      unread: 1,
      isMail: true,
    });
  });

  test("filtra solo correo y acepta view ausente en Trash/Personales", () => {
    const mail = parseMailFolders(fixture("folders.xml"));

    expect(mail.map((folder) => folder.name)).toEqual([
      "Inbox",
      "Sent",
      "Trash",
      "Personales",
      "Archive",
      "2026",
    ]);
    expect(mail.find((folder) => folder.name === "Trash")?.kind).toBeNull();
    expect(mail.some((folder) => folder.name === "Fuentes RSS")).toBe(false);
    expect(mail.some((folder) => folder.name === "Calendar")).toBe(false);
  });

  test("la regla de correo no confunde tipos no-mensaje con correo", () => {
    expect(isMailFolder({ name: "Trash", kind: null })).toBe(true);
    expect(isMailFolder({ name: "Personales", kind: null })).toBe(true);
    expect(isMailFolder({ name: "Fuentes RSS", kind: null })).toBe(false);
    expect(isMailFolder({ name: "RSS del taller", kind: null })).toBe(false);
    expect(isMailFolder({ name: "Calendar", kind: "appointment" })).toBe(false);
    expect(isMailFolder({ name: "Inbox", kind: "message" })).toBe(true);
  });
});

describe("Search — cabeceras, flags y paginación por more", () => {
  test("mapea remitente, flags, adjuntos y snippet", () => {
    const page = parseSearchResponse(fixture("search.xml"));

    expect(page.offset).toBe(0);
    expect(page.more).toBe(true);
    expect(page.sortBy).toBe("dateAsc");
    expect(page.headers).toHaveLength(2);

    expect(page.headers[0]).toMatchObject({
      messageId: "17438",
      folderRemoteId: "2",
      conversationId: "17206",
      subject: "Re: Afectación de apagado",
      fromName: "JAVIER LOBO CASTRO",
      fromAddress: "jlobo@rtva.es",
      date: 1795179963000,
      size: 2625302,
      flags: "an",
      hasAttachments: true,
    });
    expect(page.headers[0].snippet).toContain("Buenos días");

    expect(page.headers[1]).toMatchObject({
      messageId: "17436",
      folderRemoteId: "5",
      conversationId: null,
      fromName: "sat@proveedor.es",
      fromAddress: "sat@proveedor.es",
      flags: "u",
      hasAttachments: false,
    });
  });

  test("ordena el listado local por fecha descendente", () => {
    const page = parseSearchResponse(fixture("search.xml"));

    expect(sortHeadersByDateDesc(page.headers).map((h) => h.messageId)).toEqual(
      ["17438", "17436"],
    );
  });

  test("una página llena sigue aunque more venga apagado", () => {
    expect(hasMoreSearchResults({ more: false, count: 500, limit: 500 })).toBe(
      true,
    );
    expect(hasMoreSearchResults({ more: false, count: 499, limit: 500 })).toBe(
      false,
    );
    expect(hasMoreSearchResults({ more: true, count: 1, limit: 500 })).toBe(
      true,
    );
    expect(nextSearchOffset(500, 500)).toBe(1000);
  });

  test("la fecha de after usa M/D/AAAA", () => {
    expect(formatSearchDate(new Date(Date.UTC(2026, 10, 19, 12)))).toBe(
      "11/19/2026",
    );
  });
});

describe("Sync — ids anidados, borrados y token", () => {
  test("lee los ids de folder/m y los borrados de deleted/m", () => {
    const page = parseSyncResponse(fixture("sync.xml"));

    expect(page.changedIds).toEqual(["17438", "17436", "17435"]);
    expect(page.deletedIds).toEqual(["17001", "17002"]);
    expect(page.token).toBe("138933");
    expect(page.more).toBe(true);
    expect(shouldContinueSync(page.more)).toBe(true);
  });

  test("acepta ids directos en deleted", () => {
    const page = parseSyncResponse(
      soap(
        '<SyncResponse xmlns="urn:zimbraMail" token="9"><deleted ids="1,2"/></SyncResponse>',
      ),
    );

    expect(page.deletedIds).toEqual(["1", "2"]);
    expect(page.changedIds).toEqual([]);
    expect(page.token).toBe("9");
    expect(page.more).toBe(false);
  });
});

describe("GetMsg y content servlet", () => {
  test("extrae id, tamaño y URL de contenido", () => {
    const message = parseGetMessageResponse(fixture("getMessage.xml"));

    expect(message).toEqual({
      messageId: "17438",
      size: 2625302,
      contentUrl: "/service/content/get?id=17438",
    });
  });

  test("resuelve la URL relativa contra el servidor fijo y rechaza otro origen", () => {
    expect(
      resolveContentUrl(
        "https://hermes.rtva.es",
        "/service/content/get?id=17438",
      ),
    ).toBe("https://hermes.rtva.es/service/content/get?id=17438");
    expect(() =>
      resolveContentUrl(
        "https://hermes.rtva.es",
        "https://evil.example/service/content/get?id=17438",
      ),
    ).toThrow();
  });
});

describe("faults y clasificación de reintentos", () => {
  test("extrae código, mensaje y Trace del fault", () => {
    const fault = parseSoapFault(fixture("fault.xml"));

    expect(fault).toEqual({
      code: "account.AUTH_FAILED",
      message: "invalid credentials",
      trace: "trace-abc-123",
    });
    expect(parseSoapFault(soap("<SearchResponse/>"))).toBeNull();
  });

  test("AUTH_FAILED pide credenciales y no se reintenta", () => {
    const fault: MailFault = {
      code: "account.AUTH_FAILED",
      message: "invalid credentials",
      trace: null,
    };
    const result = classifyHttpFailure({ status: 200, fault });

    expect(result.requiresCredentials).toBe(true);
    expect(result.retryable).toBe(false);
    expect(result.code).toBe("account.AUTH_FAILED");
  });

  test("timeouts, 429 y 5xx sin fault son reintentables", () => {
    const unavailable = classifyHttpFailure({ status: 503 });
    const limited = classifyHttpFailure({
      status: 429,
      retryAfterSeconds: 7,
    });

    expect(unavailable.retryable).toBe(true);
    expect(limited.retryable).toBe(true);
    expect(limited.retryAfterSeconds).toBe(7);
  });

  test("un fault de negocio en un 500 no se reintenta", () => {
    const result = classifyHttpFailure({
      status: 500,
      fault: {
        code: "service.INVALID_REQUEST",
        message: "bad request",
        trace: null,
      },
    });

    expect(result.retryable).toBe(false);
  });

  test("401 renueva token una vez; 403 no se reintenta", () => {
    const unauthorized = classifyHttpFailure({ status: 401 });
    const forbidden = classifyHttpFailure({ status: 403 });

    expect(unauthorized.requiresTokenRefresh).toBe(true);
    expect(unauthorized.retryable).toBe(false);
    expect(forbidden.retryable).toBe(false);
  });
});
