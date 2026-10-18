// @vitest-environment jsdom
// La matriz de avisos por correo: qué columnas tiene y si cada interruptor cae
// debajo de su encabezado. Se sustituyen los hooks de Convex antes de que la
// tarjeta los importe; lo que se mira es lo que ve quien reparte los avisos, no
// la conversación con el backend (esa está en tests/mailSettings.test.ts).
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
    // Lo que contesta cada consulta (o `undefined` mientras carga).
    settings: null as Record<string, unknown> | null,
    report: null as Record<string, unknown> | null,
    roles: [] as Record<string, unknown>[],
    // Las escrituras que pide la tarjeta, en orden.
    calls: [] as { name: string; args: unknown }[],
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() },
}));

vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  return {
    // Se nombra la función en vez de compararla: cada acceso a `api` devuelve un
    // objeto nuevo, así que la referencia no se puede comparar consigo misma.
    useQuery: (query: unknown) => {
      const name = getFunctionName(query as never);
      if (name === "mailSettings:settings") return STATE.settings ?? undefined;
      if (name === "weeklyReport:settings") return STATE.report ?? undefined;
      if (name === "mailSettings:roleOptions") return STATE.roles;
      return undefined;
    },
    useMutation: (mutation: unknown) => async (args: unknown) => {
      STATE.calls.push({ name: getFunctionName(mutation as never), args });
      return undefined;
    },
  };
});

import { MailAudienceCard } from "@/pages/dashboard/settings/MailAudienceCard";
import { MAIL_ORIGINS } from "@/lib/mail";

/**
 * La tarjeta de avisos por correo, con lo que decide el administrador:
 *
 *  - la matriz **no deja ningún correo fuera**: una columna por cada origen del
 *    catálogo (`MAIL_ORIGINS`), también los dos que no se reparten por rol —el
 *    aviso a quien notificó y la prueba de envío—, que antes solo se nombraban
 *    en la letra pequeña;
 *  - solo los correos que van por rol son un interruptor: las otras dos columnas
 *    dicen su destino y no se pueden apagar desde aquí;
 *  - la cabecera y las filas comparten **la misma rejilla**. Antes eran un `flex`
 *    con dos etiquetas de texto y otro con dos interruptores, y el encabezado
 *    acababa donde le dejaba el ancho de su palabra: no apuntaba a nada.
 */

/** Los tres roles del taller, como los devuelve `settingsRoleOptions`. */
const ROLES = [
  {
    key: "admin",
    label: "Administrador",
    description: "Gestiona usuarios y roles, además de todo lo del responsable",
  },
  {
    key: "manager",
    label: "Responsable de repuestos",
    description: "Aprueba peticiones y gestiona repuestos y equipos",
  },
  {
    key: "technician",
    label: "Técnico",
    description: "Crea peticiones de repuestos y consulta su estado",
  },
];

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  STATE.settings = { incidentRoles: ["admin"] };
  STATE.report = { enabled: true, weekday: 1, roleKeys: ["manager"] };
  STATE.roles = ROLES;
  STATE.calls = [];
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
  act(() => root.render(<MailAudienceCard />));
  // Las dos listas se rellenan en un efecto: se le dejan correr sus vueltas.
  await settle();
}

/** La cabecera de la matriz: la fila que empieza con «Rol». */
function cabecera(): Element | null {
  const rotulo = [...container.querySelectorAll("span")].find(
    (span) => span.textContent?.trim() === "Rol",
  );
  return rotulo?.parentElement ?? null;
}

/** Las filas de roles, en el orden en que se pintan. */
function filas(): Element[] {
  return [...container.querySelectorAll("li")];
}

/** Las celdas de una fila, después del bloque del rol. */
function celdas(fila: Element): Element[] {
  const reparto = fila.children[1];
  return reparto === undefined ? [] : [...reparto.children];
}

/** Las clases de rejilla de un elemento, sin las demás. */
function rejilla(elemento: Element): string[] {
  return [...elemento.classList].filter((clase) =>
    clase.includes("grid-cols-"),
  );
}

const texto = () => container.textContent ?? "";

describe("las columnas de la matriz", () => {
  test("hay una por cada tipo de correo del taller, también los fijos", async () => {
    await mount();

    const titulos = [...(cabecera()?.children ?? [])].slice(1);

    // El catálogo y la pantalla no se separan: si mañana `lib/mail` estrena un
    // origen, esta tarjeta tiene que enseñarlo.
    expect(titulos).toHaveLength(MAIL_ORIGINS.length);
    expect(
      titulos.map((titulo) => titulo.textContent?.replace(/fijo$/, "").trim()),
    ).toEqual([
      "Aviso a quien notificó",
      "Aviso interno de incidencia",
      "Resumen semanal",
      "Prueba de envío",
    ]);
    // Los dos extremos no van por rol, y la cabecera lo dice.
    expect(
      titulos.map((titulo) => (titulo.textContent ?? "").includes("fijo")),
    ).toEqual([true, false, false, true]);
  });

  test("las columnas que no van por rol no tienen interruptor", async () => {
    await mount();

    const todo = filas();
    expect(todo).toHaveLength(ROLES.length);

    for (const fila of todo) {
      // Solo el aviso interno y el resumen se reparten entre los roles.
      const interruptores = fila.querySelectorAll("button[role='switch']");
      expect(interruptores).toHaveLength(2);

      const celdasDeLaFila = celdas(fila);
      expect(celdasDeLaFila).toHaveLength(4);
      // En el mismo orden que la cabecera: primero el destino fijo, luego los
      // dos interruptores y al final la prueba.
      expect(celdasDeLaFila[0].textContent).toContain("Siempre");
      expect(celdasDeLaFila[3].textContent).toContain("A demanda");
    }

    // Y cada interruptor dice a qué correo pertenece, que es lo único que oye
    // quien no ve la cabecera.
    const etiquetas = [
      ...container.querySelectorAll<HTMLButtonElement>("button[role='switch']"),
    ].map((interruptor) => interruptor.getAttribute("aria-label") ?? "");
    expect(etiquetas[0]).toBe("Aviso interno de incidencia a Administrador");
    expect(etiquetas[1]).toBe("Resumen semanal a Administrador");
  });

  test("la cabecera y las filas comparten la misma rejilla", async () => {
    await mount();

    const cabeceraReal = cabecera();
    expect(cabeceraReal).not.toBeNull();

    const [rejillaDeLaCabecera] = rejilla(cabeceraReal as Element);
    // Sin rejilla propia no hay nada que alinear: es el fallo de antes.
    expect(rejillaDeLaCabecera).toBeDefined();

    for (const fila of filas()) {
      expect(rejilla(fila)).toEqual([rejillaDeLaCabecera]);
    }
  });

  test("guardar escribe las dos listas con lo que se haya tocado", async () => {
    await mount();

    // Se le da el resumen al técnico, además del responsable que ya lo tenía.
    const resumenTecnico = container.querySelector<HTMLButtonElement>(
      "button[aria-label='Resumen semanal a Técnico']",
    );
    expect(resumenTecnico).not.toBeNull();
    await act(async () => {
      resumenTecnico?.click();
    });
    await settle();

    const guardar = [...container.querySelectorAll("button")].find((boton) =>
      (boton.textContent ?? "").includes("Guardar avisos"),
    );
    expect(guardar).not.toBeNull();
    await act(async () => {
      guardar?.click();
    });
    await settle(3);

    expect(STATE.calls).toEqual([
      {
        name: "mailSettings:setIncidentRoles",
        args: { roleKeys: ["admin"] },
      },
      {
        name: "weeklyReport:setSettings",
        args: {
          enabled: true,
          weekday: 1,
          roleKeys: ["manager", "technician"],
        },
      },
    ]);
    expect(texto()).toContain("Resumen semanal: le llega a 2 roles");
  });
});
