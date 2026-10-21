// @vitest-environment jsdom
import { settle } from "./settle";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MAIL_PROVIDER_META } from "@/lib/mail";
import { MailProviderSettingsFields } from "@/pages/dashboard/settings/mail/components/MailProviderSettingsFields";
import { MailRelayCheckSection } from "@/pages/dashboard/settings/mail/components/MailRelayCheckSection";
import { MailLogViewer } from "@/pages/dashboard/settings/mail/components/MailLogViewer";
import type { MailFormData, MailServerSettingsDoc } from "@/pages/dashboard/settings/mail/types";

let roots: Root[] = [];

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  document.body.innerHTML = "";
  roots = [];
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

const mockSettings = {
  provider: "relay",
  enabled: true,
  fromName: "Taller Central",
  fromEmail: "taller@empresa.com",
  replyTo: "",
  bcc: "",
  domain: "",
  relayUrl: "http://localhost:8080",
  smtpUser: "usuario@empresa.com",
  hasKey: true,
  keyHint: "…1234",
  keySource: "guardada",
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

const mockFormData: MailFormData = {
  provider: "relay",
  enabled: true,
  fromName: "Taller Central",
  fromEmail: "taller@empresa.com",
  replyTo: "",
  bcc: "",
  domain: "",
  relayUrl: "http://localhost:8080",
  smtpUser: "usuario@empresa.com",
  apiKey: "",
  relayToken: "",
  clearApiKey: false,
  clearRelayToken: false,
};

describe("MailProviderSettingsFields", () => {
  test("renderiza selector de proveedores y dispara onChangeProvider al pulsar", async () => {
    const onChangeProvider = vi.fn();
    const container = await mount(
      <MailProviderSettingsFields
        formData={mockFormData}
        settings={mockSettings}
        meta={MAIL_PROVIDER_META.relay}
        needsKey={true}
        needsDomain={false}
        needsRelay={true}
        needsToken={true}
        needsAccount={false}
        smtp={null}
        saving={false}
        validation={{ ok: true }}
        insecureRelay={null}
        relayHint={null}
        accountHelp={null}
        keyStatus={() => "Clave guardada"}
        onChangeProvider={onChangeProvider}
        onFieldChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    const inputName = container.querySelector(
      "#ajustes-correo-remitente-nombre",
    ) as HTMLInputElement;
    expect(inputName.value).toBe("Taller Central");

    const resendButton = container.querySelector(
      'button[role="radio"][aria-checked="false"]',
    ) as HTMLButtonElement;
    expect(resendButton).toBeTruthy();

    act(() => {
      resendButton.click();
    });

    expect(onChangeProvider).toHaveBeenCalled();
  });
});

describe("MailRelayCheckSection", () => {
  test("muestra botón de comprobación y llama a onCheck al pulsar", async () => {
    const onCheck = vi.fn();
    const container = await mount(
      <MailRelayCheckSection
        checking={false}
        saving={false}
        checkState={null}
        onCheck={onCheck}
      />,
    );

    const button = container.querySelector("button") as HTMLButtonElement;
    expect(button.textContent).toContain("Comprobar ahora");

    act(() => {
      button.click();
    });

    expect(onCheck).toHaveBeenCalled();
  });
});

describe("MailLogViewer", () => {
  test("muestra mensaje vacío cuando no hay historial", async () => {
    const container = await mount(<MailLogViewer history={[]} />);
    expect(container.textContent).toContain(
      "Todavía no ha salido ningún correo.",
    );
  });

  test("renderiza entradas del historial de envíos", async () => {
    const entries = [
      {
        _id: "log1",
        at: Date.parse("2026-10-21T09:00:00.000Z"),
        origin: "manual",
        what: "Prueba técnica",
        ok: true,
        to: ["admin@taller.es"],
        bcc: [],
        subject: "Prueba de correo",
      },
      {
        _id: "log2",
        at: Date.parse("2026-10-21T09:05:00.000Z"),
        origin: "incidencia",
        what: "Aviso de avería",
        ok: false,
        to: ["tecnico@taller.es"],
        bcc: ["copia@taller.es"],
        subject: "Incidencia INC-001",
        error: "SMTP Error 550",
      },
    ];

    const container = await mount(<MailLogViewer history={entries} />);
    expect(container.textContent).toContain("Salió");
    expect(container.textContent).toContain("No salió");
    expect(container.textContent).toContain("SMTP Error 550");
    expect(container.textContent).toContain("Copia oculta: copia@taller.es");
  });
});
