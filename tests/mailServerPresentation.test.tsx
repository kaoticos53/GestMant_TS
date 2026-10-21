// @vitest-environment jsdom
import { settle } from "./settle";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MailPathStatusBanner } from "@/pages/dashboard/settings/mail/components/MailPathStatusBanner";
import { MailTestSendSection } from "@/pages/dashboard/settings/mail/components/MailTestSendSection";

const sendTestMock = vi.fn();

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("convex/react", () => ({
  useAction: () => sendTestMock,
}));

let roots: Root[] = [];

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  document.body.innerHTML = "";
  roots = [];
  sendTestMock.mockReset();
});

afterEach(async () => {
  await act(async () => {
    for (const root of roots) root.unmount();
  });
  roots = [];
  document.body.innerHTML = "";
});

async function mount(node: React.ReactNode): Promise<HTMLElement> {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(<>{node}</>);
  });
  await settle();
  return container;
}

describe("MailPathStatusBanner", () => {
  test("muestra advertencia en rojo si el último envío falló", async () => {
    const container = await mount(
      <MailPathStatusBanner
        lastSend={{
          ok: false,
          at: Date.parse("2026-10-21T10:00:00.000Z"),
          origin: "manual",
          what: "Prueba",
          error: "Credenciales inválidas",
        }}
        lastSendFailed={true}
        pathFailed={false}
        pathCheckable={true}
        checkState={null}
        pathLine="Camino de envío: comprobando…"
      />,
    );

    const banner = container.querySelector('[aria-live="polite"]');
    expect(banner?.className).toContain("border-destructive");
    expect(container.textContent).toContain("Credenciales inválidas");
    expect(container.textContent).toContain("no salió");
  });

  test("muestra estilo normal y mensaje de éxito si todo está correcto", async () => {
    const container = await mount(
      <MailPathStatusBanner
        lastSend={{
          ok: true,
          at: Date.parse("2026-10-21T10:00:00.000Z"),
          origin: "manual",
          what: "Prueba",
        }}
        lastSendFailed={false}
        pathFailed={false}
        pathCheckable={true}
        checkState={{ ok: true, detail: "Conexión OK", at: Date.now() }}
        pathLine="Camino de envío: el relevo responde"
      />,
    );

    const banner = container.querySelector('[aria-live="polite"]');
    expect(banner?.className).not.toContain("border-destructive");
    expect(container.textContent).toContain("salió");
    expect(container.textContent).toContain("el relevo responde");
  });
});

describe("MailTestSendSection", () => {
  test("inicializa con el email por defecto y permite enviar prueba", async () => {
    sendTestMock.mockResolvedValueOnce({ ok: true });

    const container = await mount(
      <MailTestSendSection
        defaultToEmail="admin@taller.es"
        lastTestAt={null}
        lastTestOk={null}
        lastTestTo={null}
        lastTestError={null}
      />,
    );

    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.value).toBe("admin@taller.es");

    const button = container.querySelector("button") as HTMLButtonElement;
    expect(button.disabled).toBe(false);

    await act(async () => {
      button.click();
    });
    await settle();

    expect(sendTestMock).toHaveBeenCalledWith({ to: "admin@taller.es" });
  });
});
