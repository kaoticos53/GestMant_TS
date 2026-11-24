import { describe, expect, test } from "vitest";
import { readRelayConfig } from "../scripts/mail-relay-lib.mjs";
import {
  createSandboxMailLog,
  renderSandboxPage,
} from "../scripts/mail-relay-sandbox.mjs";

describe("relevo de correo en modo pruebas (sandbox)", () => {
  test("readRelayConfig activa sandbox con MAIL_RELAY_SANDBOX o MAIL_RELAY_MODE", () => {
    expect(readRelayConfig({}).sandbox).toBe(false);
    expect(readRelayConfig({ MAIL_RELAY_SANDBOX: "true" }).sandbox).toBe(true);
    expect(readRelayConfig({ MAIL_RELAY_MODE: "sandbox" }).sandbox).toBe(true);
    expect(readRelayConfig({ MAIL_RELAY_MODE: "log" }).sandbox).toBe(true);
  });

  test("createSandboxMailLog registra, ordena del más reciente al más antiguo y limpia", () => {
    let tick = 1000;
    const store = createSandboxMailLog({
      maxEntries: 2,
      now: () => (tick += 100),
    });

    store.record({
      from: "taller@empresa.es",
      to: ["uno@empresa.es"],
      bcc: [],
      subject: "Primero",
      text: "Cuerpo 1",
      html: "<p>Cuerpo 1</p>",
    });
    store.record(
      {
        from: "taller@empresa.es",
        to: ["dos@empresa.es"],
        bcc: ["auditoria@empresa.es"],
        subject: "Segundo",
        text: "Cuerpo 2",
        html: "<p>Cuerpo 2</p>",
      },
      { host: "smtp.gmail.com", port: 587 },
    );
    store.record({
      from: "taller@empresa.es",
      to: ["tres@empresa.es"],
      bcc: [],
      subject: "Tercero",
      text: "Cuerpo 3",
      html: "<p>Cuerpo 3</p>",
    });

    const list = store.list();
    expect(list).toHaveLength(2);
    expect(list[0].subject).toBe("Tercero");
    expect(list[1].subject).toBe("Segundo");
    expect(list[1].smtpTarget).toBe("smtp.gmail.com:587");
    expect(list[1].bcc).toEqual(["auditoria@empresa.es"]);

    const cleared = store.clear();
    expect(cleared).toEqual({ cleared: 2 });
    expect(store.list()).toEqual([]);
  });

  test("renderSandboxPage genera la tabla HTML con endpoint y visor", () => {
    const html = renderSandboxPage({ relayUrl: "/enviar" });
    expect(html).toContain("Relevo de correo · Modo pruebas (solo logs)");
    expect(html).toContain("/enviar");
    expect(html).toContain("/api/logs");
    expect(html).toContain("Vaciar tabla");
  });
});
