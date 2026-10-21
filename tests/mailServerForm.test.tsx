// @vitest-environment jsdom
import { settle } from "./settle";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { MailServerSettingsDoc } from "@/pages/dashboard/settings/mail/types";
import { useMailServerForm } from "@/pages/dashboard/settings/mail/hooks/useMailServerForm";

const saveMock = vi.fn();

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("convex/react", () => ({
  useMutation: () => saveMock,
}));

let roots: Root[] = [];

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  document.body.innerHTML = "";
  roots = [];
  saveMock.mockReset();
});

afterEach(async () => {
  await act(async () => {
    for (const root of roots) root.unmount();
  });
  roots = [];
  document.body.innerHTML = "";
});

type HookReturn = ReturnType<typeof useMailServerForm>;

function setup(settings?: MailServerSettingsDoc) {
  let current!: HookReturn;
  function TestComp({ doc }: { doc?: MailServerSettingsDoc }) {
    current = useMailServerForm(doc);
    return null;
  }

  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);

  act(() => {
    root.render(<TestComp doc={settings} />);
  });

  return {
    get current() {
      return current;
    },
    rerender(newDoc?: MailServerSettingsDoc) {
      act(() => {
        root.render(<TestComp doc={newDoc} />);
      });
    },
  };
}

describe("useMailServerForm", () => {
  test("inicializa con valores por defecto si settings es undefined", () => {
    const { current } = setup(undefined);
    expect(current.formData.provider).toBe("vly");
    expect(current.formData.enabled).toBe(true);
    expect(current.formData.fromName).toBe("Pulso Taller");
  });

  test("se inicializa con settings guardados una sola vez", async () => {
    const mockSettings = {
      provider: "relay",
      enabled: true,
      fromName: "Taller Central",
      fromEmail: "taller@empresa.com",
      replyTo: "soporte@empresa.com",
      bcc: "copia@empresa.com",
      domain: "",
      relayUrl: "http://127.0.0.1:8080/relay",
      smtpUser: "usuario@empresa.com",
      hasKey: true,
      keyHint: "…abcd",
      keySource: "guardada",
      envVar: null,
      envConfigured: false,
      hasRelayToken: false,
      relayTokenHint: "",
      updatedAt: 123456789,
      updatedBy: "Admin",
      lastTestAt: null,
      lastTestTo: null,
      lastTestOk: null,
      lastTestError: null,
      incidentRoles: [],
    } as unknown as MailServerSettingsDoc;

    const { current } = setup(mockSettings);
    expect(current.formData.provider).toBe("relay");
    expect(current.formData.fromName).toBe("Taller Central");
    expect(current.formData.fromEmail).toBe("taller@empresa.com");
    expect(current.formData.relayUrl).toBe("http://127.0.0.1:8080/relay");
  });

  test("changeProvider resetea claves y tokens en memoria", () => {
    const hook = setup(undefined);

    act(() => {
      hook.current.updateField("apiKey", "clave-secreta");
      hook.current.updateField("relayToken", "token-secreto");
    });
    expect(hook.current.formData.apiKey).toBe("clave-secreta");
    expect(hook.current.formData.relayToken).toBe("token-secreto");

    act(() => {
      hook.current.changeProvider("resend");
    });

    expect(hook.current.formData.provider).toBe("resend");
    expect(hook.current.formData.apiKey).toBe("");
    expect(hook.current.formData.relayToken).toBe("");
  });

  test("handleSave ejecuta save de Convex cuando la validación es correcta", async () => {
    const mockSettings = {
      provider: "vly",
      enabled: true,
      fromName: "Taller Central",
      fromEmail: "taller@empresa.com",
      replyTo: "",
      bcc: "",
      domain: "",
      relayUrl: "",
      smtpUser: "",
      hasKey: false,
      keyHint: "",
      keySource: "ninguna",
      envVar: null,
      envConfigured: false,
      hasRelayToken: false,
      relayTokenHint: "",
      updatedAt: null,
      updatedBy: null,
      lastTestAt: null,
      lastTestTo: null,
      lastTestOk: null,
      lastTestError: null,
      incidentRoles: [],
    } as unknown as MailServerSettingsDoc;

    const { current } = setup(mockSettings);
    saveMock.mockResolvedValueOnce(undefined);

    let success = false;
    await act(async () => {
      success = await current.handleSave();
    });

    expect(success).toBe(true);
    expect(saveMock).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "vly",
        fromEmail: "taller@empresa.com",
      }),
    );
  });
});
