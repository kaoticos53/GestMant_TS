// @vitest-environment jsdom
// Se sustituyen los hooks de Convex *antes* de que la tarjeta los importe: aquí
// se comprueba lo que ve el administrador —que el camino se comprueba solo y que
// un último envío fallido se avisa en rojo—, no la conversación con el backend
// (esa está en tests/mailSettings.test.ts).
import { settle } from "./settle";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

const { STATE } = vi.hoisted(() => ({
  STATE: {
    // Lo que contesta la consulta de ajustes (o `undefined` mientras carga).
    settings: null as Record<string, unknown> | null,
    // Los envíos del histórico, del más reciente al más viejo.
    history: [] as Record<string, unknown>[],
    // Lo que irá contestando la acción de comprobación, en orden.
    checks: [] as Record<string, unknown>[],
    checkCalls: 0,
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() },
}));

vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  return {
    // La tarjeta recibe lo que la prueba haya puesto: siempre el mismo objeto,
    // para no provocar renders en bucle.
    useQuery: (query: unknown) => {
      const name = getFunctionName(query as never);
      if (name === "mailSettings:settings") return STATE.settings ?? undefined;
      if (name === "mailLog:history") return STATE.history;
      return undefined;
    },
    useMutation: () => async () => undefined,
    useAction: (action: unknown) => async () => {
      // Se nombra la función en vez de compararla: cada acceso a `api` devuelve
      // un objeto nuevo, así que la referencia no se puede comparar consigo misma.
      if (getFunctionName(action as never) !== "mailSettings:check") {
        return { ok: true, provider: "relay" };
      }
      STATE.checkCalls += 1;
      return STATE.checks.shift() ?? { ok: true, provider: "relay" };
    },
  };
});

import { MailServerCard } from "@/pages/dashboard/settings/MailServerCard";

/**
 * La tarjeta del servidor de correo, con lo que puede saber un administrador:
 *
 *  - el camino se comprueba **sin pulsar nada** —al abrir el panel—, porque lo
 *    que interesa es saber si el correo de hoy va a salir, no si alguien se
 *    acordó de pulsar un botón;
 *  - un último envío fallido **se avisa en rojo** con el motivo que dejó el
 *    servicio, sin tener que abrir el histórico ni la ficha de la incidencia;
 *  - cuando el servicio tiene API propia no se inventa una comprobación que no
 *    existe: se dice que su prueba es mandar un correo.
 */

const REMITENTE = {
  enabled: true,
  fromName: "Pulso Taller",
  fromEmail: "avisos@taller.es",
  replyTo: "",
  bcc: "",
  incidentRoles: [],
  domain: "",
  smtpUser: "",
  hasKey: false,
  keyHint: "",
  keySource: "ninguna",
  envVar: null,
  envConfigured: false,
  hasRelayToken: false,
  relayTokenHint: "",
  updatedAt: Date.parse("2026-10-16T08:00:00.000Z"),
  updatedBy: "Administración",
  lastTestAt: null,
  lastTestTo: null,
  lastTestOk: null,
  lastTestError: null,
};

/** Los ajustes de un relevo propio apuntando al puente local. */
function relaySettings(over: Record<string, unknown> = {}) {
  return {
    ...REMITENTE,
    provider: "relay",
    relayUrl: "http://127.0.0.1:8788/enviar",
    ...over,
  };
}

/** Un envío del histórico; por defecto, uno que no salió. */
function sendLog(over: Record<string, unknown> = {}) {
  const at = Date.parse("2026-10-17T19:30:00.000Z");
  return {
    _id: "log-1",
    _creationTime: at,
    at,
    what: "Aviso interno de incidencia",
    origin: "equipo",
    provider: "relay",
    to: ["tecnico@taller.es"],
    bcc: [],
    subject: "INC-0001: incidencia asignada",
    ok: false,
    error: "El relevo respondió HTTP 502: SMTP 535 en AUTH PLAIN",
    ...over,
  };
}

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  STATE.settings = null;
  STATE.history = [];
  STATE.checks = [];
  STATE.checkCalls = 0;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = "";
});

async function mount(): Promise<void> {
  act(() => root.render(<MailServerCard />));
  // El efecto de la comprobación automática dispara una promesa: se le dejan
  // correr las vueltas que hagan falta, sin esperar un plazo fijo.
  await settle(3);
}

const texto = () => container.textContent ?? "";

/** El botón cuyo rótulo contiene ese texto (o nada). */
function boton(fragmento: string): HTMLButtonElement | null {
  return (
    [...container.querySelectorAll("button")].find((b) =>
      (b.textContent ?? "").includes(fragmento),
    ) ?? null
  );
}

describe("el estado del camino de envío", () => {
  test("se comprueba solo al abrir el panel y avisa del último envío fallido", async () => {
    STATE.settings = relaySettings();
    STATE.history = [sendLog()];
    STATE.checks = [
      {
        ok: true,
        provider: "relay",
        detail: "smtp.gmail.com:465 · TLS directo · AUTH PLAIN",
      },
    ];

    await mount();

    // Nadie ha pulsado nada: la comprobación la lanzó el propio panel.
    expect(STATE.checkCalls).toBe(1);
    expect(texto()).toContain("Estado del camino de envío");
    // El aviso del último envío, con el motivo que dejó el servicio.
    expect(texto()).toContain("Último envío: no salió el");
    expect(texto()).toContain("SMTP 535 en AUTH PLAIN");
    // Y el camino de ahora mismo, con lo que aceptó el relevo.
    expect(texto()).toContain("el relevo responde y acepta las credenciales");
    expect(texto()).toContain("TLS directo · AUTH PLAIN");
  });

  test("si el relevo no supera la comprobación, se dice por qué y el botón la repite", async () => {
    STATE.settings = relaySettings();
    STATE.checks = [
      {
        ok: false,
        provider: "relay",
        error: "No se pudo hablar con el relevo: conexión rechazada",
      },
      {
        ok: true,
        provider: "relay",
        detail: "smtp.taller.es:587 · STARTTLS · AUTH PLAIN",
      },
    ];

    await mount();

    expect(texto()).toContain("el relevo no supera la comprobación");
    expect(texto()).toContain("conexión rechazada");
    // Un fallo del camino no se anuncia como un envío fallido: no ha salido nada.
    expect(texto()).not.toContain("Último envío: no salió");

    const repetir = boton("Comprobar ahora");
    expect(repetir).not.toBeNull();
    await act(async () => {
      repetir?.click();
    });
    await settle(3);

    expect(STATE.checkCalls).toBe(2);
    expect(texto()).toContain("smtp.taller.es:587 · STARTTLS · AUTH PLAIN");
  });

  test("avisa si la dirección guardada no es la del relevo", async () => {
    // El error que veía el taller: el puerto del visor de Ethereal en vez del
    // puente. Se dice al abrir el panel, sin esperar a que falle un envío.
    STATE.settings = relaySettings({
      relayUrl: "https://localhost:8025/enviar",
    });

    await mount();

    expect(texto()).toContain("El puerto 8025 es el visor de mensajes");
    expect(texto()).toContain("8788");
  });

  test("con el correo apagado no se molesta al relevo", async () => {
    STATE.settings = relaySettings({ enabled: false });

    await mount();

    expect(STATE.checkCalls).toBe(0);
    expect(texto()).toContain("el correo está apagado");
  });

  test("un servicio con API propia no finge una comprobación que no tiene", async () => {
    STATE.settings = relaySettings({
      provider: "resend",
      relayUrl: "",
      hasKey: true,
      keyHint: "…123",
      keySource: "guardada",
      envVar: "RESEND_API_KEY",
    });

    await mount();

    expect(STATE.checkCalls).toBe(0);
    expect(texto()).toContain("se comprueba mandando un correo");
    // Sin relevo no hay botón que ofrezca una conexión que nadie va a abrir.
    expect(boton("Comprobar ahora")).toBeNull();
    // Y el histórico se sigue leyendo: el último envío vale para todos.
    expect(texto()).toContain("Último envío: todavía no ha salido ninguno.");
  });
});
