// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAILBOX_PAGE_SIZE } from "@/pages/dashboard/mailbox/helpers";
import { settle } from "./settle";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const { mockUseQuery, mockUseAction, mockUseMutation } = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
  mockUseAction: vi.fn(),
  mockUseMutation: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useQuery: mockUseQuery,
  useAction: mockUseAction,
  useMutation: mockUseMutation,
}));

import { MailboxView } from "@/pages/dashboard/MailboxView";

const ACCOUNT = {
  email: "tecnico@rtva.es",
  serverUrl: "https://correo.rtva.es",
  status: "connected",
  enabled: true,
  cacheLimitBytes: 512 * 1024 * 1024,
  cacheRetentionDays: 30,
  cacheBytes: 1024,
  hasPassword: true,
  passwordHint: "••••1234",
  lastSyncAt: Date.UTC(2026, 10, 21, 9, 30),
  lastSyncError: null,
  updatedAt: Date.UTC(2026, 10, 21, 9, 30),
};

const FOLDERS = [
  {
    remoteId: "inbox",
    parentRemoteId: null,
    name: "Bandeja de entrada",
    path: "/Inbox",
    kind: "inbox",
    isMail: true,
    unread: 2,
    total: 10,
    size: 4096,
  },
  {
    remoteId: "sent",
    parentRemoteId: null,
    name: "Enviados",
    path: "/Sent",
    kind: "sent",
    isMail: true,
    unread: 0,
    total: 4,
    size: 1024,
  },
];

const HEADERS = [
  {
    messageId: "m-2",
    folderRemoteId: "inbox",
    conversationId: null,
    subject: "Cambio de filtro en la línea 3",
    fromName: "Taller Central",
    fromAddress: "taller@rtva.es",
    date: Date.UTC(2026, 10, 21, 8, 0),
    size: 2048,
    flags: "u",
    hasAttachments: true,
    snippet: "Adjuntamos la ficha del filtro que hay que sustituir.",
    bodyState: "notCached",
    cachedAt: null,
    lastOpenedAt: null,
  },
  {
    messageId: "m-1",
    folderRemoteId: "inbox",
    conversationId: null,
    subject: "Revisión del compresor",
    fromName: "Mantenimiento",
    fromAddress: "mantenimiento@rtva.es",
    date: Date.UTC(2026, 10, 20, 15, 0),
    size: 1024,
    flags: "",
    hasAttachments: false,
    snippet: "Queda revisada la presión del compresor.",
    bodyState: "notCached",
    cachedAt: null,
    lastOpenedAt: null,
  },
];

type HeadersResult = {
  headers: typeof HEADERS;
  total: number;
  unread: number;
};

function makeHeaders(
  offset: number,
  count: number,
  folderRemoteId = "inbox",
): typeof HEADERS {
  return Array.from({ length: count }, (_, index) => ({
    ...HEADERS[index % HEADERS.length],
    messageId: `${folderRemoteId}-${offset + index}`,
    folderRemoteId,
    subject: `Asunto ${offset + index + 1}`,
    flags: "",
    hasAttachments: false,
    snippet: `Fragmento ${offset + index + 1}`,
  }));
}

function setupQueries({
  account = ACCOUNT,
  folders = FOLDERS,
  headers = { headers: HEADERS, total: HEADERS.length, unread: 1 },
  headersForArgs,
  actions,
}: {
  account?: typeof ACCOUNT | null;
  folders?: typeof FOLDERS | undefined;
  headers?: HeadersResult;
  headersForArgs?: (args: Record<string, unknown>) => HeadersResult;
  actions?: {
    sync?: ReturnType<typeof vi.fn>;
    open?: ReturnType<typeof vi.fn>;
    download?: ReturnType<typeof vi.fn>;
  };
} = {}) {
  let callsWithoutArgs = 0;
  // `MailboxView` llama a:
  //   1) `account` (sin args),
  //   2) `folders` (`{}`),
  //   3) `backgroundJobs.listMine` (`{}`),
  //   4) `mailHeaders.list` (`{ folderRemoteId, ... }`).
  mockUseQuery.mockImplementation(
    (_query: unknown, args?: Record<string, unknown> | "skip") => {
      if (args === "skip") return undefined;
      if (args && typeof args === "object" && "folderRemoteId" in args) {
        return headersForArgs ? headersForArgs(args) : headers;
      }
      if (args && typeof args === "object") {
        // `folders` tiene 0 keys y se llama antes que `backgroundJobs.listMine`
        callsWithoutArgs += 1;
        return callsWithoutArgs % 2 === 1 ? folders : [];
      }
      return account;
    },
  );
  mockUseMutation.mockReturnValue(
    vi.fn().mockResolvedValue({ jobId: "j1", reused: false }),
  );
  const sync =
    actions?.sync ??
    vi.fn().mockResolvedValue({ ok: true, folders: 1, headers: 2 });
  const open =
    actions?.open ??
    vi.fn().mockResolvedValue({
      cached: false,
      text: "",
      textTruncated: false,
      html: null,
      htmlTruncated: false,
      bodyBytes: 0,
      attachments: [],
    });
  const download =
    actions?.download ??
    vi
      .fn()
      .mockResolvedValue({
        url: "https://storage.example/a",
        filename: "a.pdf",
      });
  const dispatch = vi.fn((args: Record<string, unknown> = {}) => {
    if ("messageId" in args) return open(args);
    if ("attachmentId" in args) return download(args);
    return sync(args);
  });
  mockUseAction.mockReturnValue(dispatch);
}

describe("MailboxView", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("pide configurar la cuenta cuando todavía no hay buzón", async () => {
    setupQueries({ account: null });
    const onOpenSettings = vi.fn();

    await act(async () => {
      root.render(<MailboxView onOpenSettings={onOpenSettings} />);
      await settle();
    });

    expect(container.textContent).toContain("Configura tu buzón de correo");
    const button = Array.from(container.querySelectorAll("button")).find(
      (candidate) =>
        candidate.textContent?.includes("Abrir ajustes del taller"),
    );
    expect(button).not.toBeNull();
    await act(async () => {
      button?.click();
      await settle();
    });
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it("muestra carpetas y cabeceras con su remitente y asunto", async () => {
    setupQueries();

    await act(async () => {
      root.render(<MailboxView onOpenSettings={vi.fn()} />);
      await settle();
    });

    const text = container.textContent ?? "";
    expect(text).toContain("Bandeja de entrada");
    expect(text).toContain("Enviados");
    expect(text).toContain("Taller Central");
    expect(text).toContain("Cambio de filtro en la línea 3");
    expect(text).toContain("2 mensajes");
  });

  it("explica que la carpeta está vacía cuando no hay cabeceras", async () => {
    setupQueries({ headers: { headers: [], total: 0, unread: 0 } });

    await act(async () => {
      root.render(<MailboxView onOpenSettings={vi.fn()} />);
      await settle();
    });

    expect(container.textContent).toContain("Esta carpeta está vacía");
  });

  it("pagina por offset y vuelve a la primera página al cambiar carpeta o búsqueda", async () => {
    setupQueries({
      headersForArgs: (args) => {
        if (args.folderRemoteId === "sent") {
          return { headers: makeHeaders(0, 4, "sent"), total: 4, unread: 0 };
        }
        if (typeof args.search === "string" && args.search !== "") {
          return {
            headers: makeHeaders(0, 1, "inbox"),
            total: 1,
            unread: 0,
          };
        }
        const offset = typeof args.offset === "number" ? args.offset : 0;
        return {
          headers: makeHeaders(
            offset,
            Math.min(MAILBOX_PAGE_SIZE, 250 - offset),
            "inbox",
          ),
          total: 250,
          unread: 0,
        };
      },
    });

    await act(async () => {
      root.render(<MailboxView onOpenSettings={vi.fn()} />);
      await settle();
    });

    const listCalls = () =>
      mockUseQuery.mock.calls
        .map(([, args]) => args)
        .filter(
          (args): args is Record<string, unknown> =>
            args !== null && typeof args === "object",
        );

    expect(listCalls().at(-1)).toMatchObject({
      folderRemoteId: "inbox",
      offset: 0,
    });
    expect(container.textContent).toContain("Asunto 1");

    const next = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Página siguiente"]',
    );
    expect(next).not.toBeNull();
    await act(async () => {
      next?.click();
      await settle();
    });

    expect(listCalls().at(-1)).toMatchObject({
      folderRemoteId: "inbox",
      offset: 100,
    });
    expect(container.textContent).toContain("Asunto 101");

    const search = container.querySelector<HTMLInputElement>(
      'input[aria-label="Buscar en esta carpeta"]',
    );
    expect(search).not.toBeNull();
    vi.useFakeTimers();
    try {
      await act(async () => {
        const setValue = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        )?.set;
        setValue?.call(search, "filtro");
        search?.dispatchEvent(new Event("input", { bubbles: true }));
        await vi.advanceTimersByTimeAsync(0);
      });

      // El buscador aplica debounce de 200 ms: no dispara la búsqueda de inmediato
      expect(listCalls().at(-1)?.search).toBeUndefined();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(230);
      });
    } finally {
      vi.useRealTimers();
    }
    await act(async () => {
      await settle();
    });

    expect(listCalls().at(-1)).toMatchObject({
      folderRemoteId: "inbox",
      offset: 0,
      search: "filtro",
    });

    const sent = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Enviados",
    );
    expect(sent).not.toBeNull();
    await act(async () => {
      sent?.click();
      await settle();
    });

    const last = listCalls().at(-1);
    expect(last).toMatchObject({ folderRemoteId: "sent", offset: 0 });
    expect(last?.search).toBeUndefined();
  });

  it("corrige la página cuando el total encoge y deja de pedir un offset vacío", async () => {
    let total = 250;
    setupQueries({
      headersForArgs: (args) => {
        const offset = typeof args.offset === "number" ? args.offset : 0;
        return {
          headers: makeHeaders(
            offset,
            Math.max(0, Math.min(MAILBOX_PAGE_SIZE, total - offset)),
          ),
          total,
          unread: 0,
        };
      },
    });

    await act(async () => {
      root.render(<MailboxView onOpenSettings={vi.fn()} />);
      await settle();
    });

    const lastPage = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Última página"]',
    );
    expect(lastPage).not.toBeNull();
    await act(async () => {
      lastPage?.click();
      await settle();
    });

    const listCalls = () =>
      mockUseQuery.mock.calls
        .map(([, args]) => args)
        .filter(
          (args): args is Record<string, unknown> =>
            args !== null && typeof args === "object",
        );
    expect(listCalls().at(-1)).toMatchObject({ offset: 2 * MAILBOX_PAGE_SIZE });

    total = 20;
    await act(async () => {
      root.render(<MailboxView onOpenSettings={vi.fn()} />);
      await settle();
    });

    expect(listCalls().at(-1)).toMatchObject({ offset: 0 });
    expect(container.textContent).toContain("Asunto 1");
    expect(container.textContent).not.toContain("Esta carpeta está vacía");
  });

  it("abre el mensaje seleccionado en el visor sin pedir cuerpo al listar", async () => {
    const open = vi.fn().mockResolvedValue({
      cached: false,
      text: "Cuerpo del mensaje seleccionado.",
      textTruncated: false,
      html: null,
      htmlTruncated: false,
      bodyBytes: 29,
      attachments: [],
    });
    setupQueries({ actions: { open } });

    await act(async () => {
      root.render(<MailboxView onOpenSettings={vi.fn()} />);
      await settle();
    });
    expect(open).not.toHaveBeenCalled();

    const firstRow = container.querySelector<HTMLElement>('li[role="button"]');
    expect(firstRow).not.toBeNull();
    await act(async () => {
      firstRow?.click();
      await settle();
    });

    expect(open).toHaveBeenCalledWith({ messageId: "m-2" });
    expect(container.textContent).toContain("Cuerpo del mensaje seleccionado.");
    expect(
      container.querySelector('[aria-label="Volver a la lista"]'),
    ).not.toBeNull();
  });

  it("guarda el adjunto traído de _storage en vez de abrir su URL", async () => {
    // La URL del adjunto vive en la API: si el visor se la pone a un <a download>
    // cross-origin, el navegador abre el .eml en la pestaña y se lleva por delante
    // el buzón. El camino bueno pasa por el helper: se trae el contenido y se
    // descarga como blob desde el origen de la app.
    const open = vi.fn().mockResolvedValue({
      cached: false,
      text: "Cuerpo con un adjunto.",
      textTruncated: false,
      html: null,
      htmlTruncated: false,
      bodyBytes: 22,
      attachments: [
        { id: "att-1", filename: "Parte: revisión/2026.eml", size: 2048 },
      ],
    });
    const download = vi.fn().mockResolvedValue({
      url: "https://storage.example/api/storage/eml-uno",
      filename: null,
    });
    setupQueries({ actions: { open, download } });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => new Blob(["contenido"], { type: "message/rfc822" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    let received: Blob | null = null;
    vi.spyOn(URL, "createObjectURL").mockImplementation((value) => {
      received = value as Blob;
      return "blob:adjunto";
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const append = vi.spyOn(document.body, "append");

    try {
      await act(async () => {
        root.render(<MailboxView onOpenSettings={vi.fn()} />);
        await settle();
      });
      const firstRow = container.querySelector<HTMLElement>(
        'li[role="button"]',
      );
      await act(async () => {
        firstRow?.click();
        await settle();
      });

      const save = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Descargar Parte: revisión/2026.eml"]',
      );
      expect(save, "tiene que estar el botón del adjunto").not.toBeNull();
      await act(async () => {
        save?.click();
        await settle();
      });

      expect(download).toHaveBeenCalledWith({ attachmentId: "att-1" });
      expect(fetchMock).toHaveBeenCalledWith(
        "https://storage.example/api/storage/eml-uno",
      );
      const anchor = append.mock.calls.at(-1)?.[0] as HTMLAnchorElement;
      expect(anchor.href).toBe("blob:adjunto");
      expect(anchor.download).toBe("Parte_ revisión_2026.eml");
      expect(anchor.target).toBe("_blank");
      expect(received?.type).toBe("application/octet-stream");
    } finally {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    }
  });

  it("avisa cuando las credenciales necesitan reautenticación", async () => {
    setupQueries({
      account: { ...ACCOUNT, status: "reauthRequired" },
    });

    await act(async () => {
      root.render(<MailboxView onOpenSettings={vi.fn()} />);
      await settle();
    });

    expect(container.textContent).toContain(
      "credenciales del buzón han caducado",
    );
    expect(container.textContent).toContain("Revisar cuenta");
  });
});
