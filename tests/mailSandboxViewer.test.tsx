// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { settle } from "./settle";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const { mockClear } = vi.hoisted(() => ({
  mockClear: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    mailSandbox: {
      clear: { name: "mailSandbox.clear" },
    },
  },
}));

vi.mock("convex/react", async () => {
  const { api } = await import("@/convex/_generated/api");
  return {
    useMutation: (ref: unknown) => {
      if (ref === api.mailSandbox.clear) return mockClear;
      return vi.fn();
    },
  };
});

import {
  MailSandboxViewer,
  type MailSandboxEntry,
} from "@/pages/dashboard/settings/mail/components/MailSandboxViewer";

describe("MailSandboxViewer", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClear.mockResolvedValue({ deleted: 2 });
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

  it("lista correos guardados, permite filtrar, ver HTML/texto y vaciar el buzón", async () => {
    const entries: MailSandboxEntry[] = [
      {
        _id: "sb-1",
        at: Date.parse("2026-11-24T18:00:00.000Z"),
        what: "el aviso de incidencia",
        origin: "incidencia",
        from: "Pulso Taller <sandbox@pulso-taller.local>",
        to: ["tecnico@taller.es"],
        bcc: ["archivo@taller.es"],
        subject: "INC-0042 · Cámara fuera de servicio",
        text: "Detalle en texto plano de INC-0042",
        html: "<p>Detalle en <strong>HTML</strong> de INC-0042</p>",
      },
      {
        _id: "sb-2",
        at: Date.parse("2026-11-24T17:00:00.000Z"),
        what: "el correo de prueba",
        origin: "prueba",
        from: "Pulso Taller <sandbox@pulso-taller.local>",
        to: ["admin@taller.es"],
        bcc: [],
        subject: "Prueba de correo · Pulso Taller",
        text: "Mensaje de prueba",
        html: "<p>Mensaje de prueba</p>",
      },
    ];

    await act(async () => {
      root.render(<MailSandboxViewer inbox={entries} />);
      await settle();
    });

    expect(document.body.textContent).toContain("Buzón interno de pruebas(2)");
    expect(document.body.textContent).toContain("INC-0042");
    expect(document.body.textContent).toContain("Prueba de correo");

    // Filtrado rápido por asunto/destinatario
    const searchInput = container.querySelector(
      'input[type="search"]',
    ) as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(searchInput, "INC-0042");
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
      await settle();
    });
    expect(document.body.textContent).toContain("INC-0042");
    expect(document.body.textContent).not.toContain("Prueba de correo");

    // Expandir contenido y alternar entre HTML (iframe sandbox) y texto plano
    const viewBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Ver contenido"),
    );
    expect(viewBtn).toBeDefined();
    await act(async () => {
      viewBtn?.click();
      await settle();
    });
    expect(container.querySelector("iframe[sandbox='']")).not.toBeNull();
    expect(document.body.textContent).toContain("archivo@taller.es");

    const textTabBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Texto plano",
    );
    await act(async () => {
      textTabBtn?.click();
      await settle();
    });
    expect(document.body.textContent).toContain(
      "Detalle en texto plano de INC-0042",
    );

    // Vaciar buzón
    const clearBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Vaciar buzón"),
    );
    expect(clearBtn).toBeDefined();
    await act(async () => {
      clearBtn?.click();
      await settle();
    });
    expect(mockClear).toHaveBeenCalledTimes(1);
  });
});
