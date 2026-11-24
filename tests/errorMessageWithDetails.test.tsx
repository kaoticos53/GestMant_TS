// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { settle } from "./settle";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { mockUseAuth } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: mockUseAuth,
}));

import { ErrorMessageWithDetails } from "@/components/ErrorMessageWithDetails";

describe("ErrorMessageWithDetails", () => {
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

  const rawRelayError =
    "No se pudo hablar con el relevo: error sending request for url (http://127.0.0.1:8788/enviar/comprobar): tcp connect error: Connection refused (os error 111)";

  it("oculta detalles técnicos y no muestra el botón a usuarios no administradores", async () => {
    mockUseAuth.mockReturnValue({ user: { role: "technician" } });

    await act(async () => {
      root.render(<ErrorMessageWithDetails error={rawRelayError} />);
      await settle();
    });

    const text = container.textContent ?? "";
    expect(text).toContain("No se pudo conectar con el servicio externo");
    expect(text).not.toContain("127.0.0.1:8788");
    expect(text).not.toContain("Ver detalle técnico");
  });

  it("permite al administrador desplegar los detalles técnicos con el botón estándar", async () => {
    mockUseAuth.mockReturnValue({ user: { role: "admin" } });

    await act(async () => {
      root.render(<ErrorMessageWithDetails error={rawRelayError} />);
      await settle();
    });

    expect(container.textContent).not.toContain("127.0.0.1:8788");
    const button = container.querySelector("button");
    expect(button?.textContent).toContain("Ver detalle técnico");

    await act(async () => {
      button?.click();
      await settle();
    });

    expect(container.textContent).toContain("127.0.0.1:8788");
    expect(button?.textContent).toContain("Ocultar detalle técnico");
  });
});
