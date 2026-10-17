// @vitest-environment jsdom
// Se sustituyen los hooks de Convex *antes* de que la ficha los importe: aquí se
// comprueba la pantalla —el botón, el diálogo y lo que se manda al guardar—, no
// la conversación con el servidor (esa está en tests/incidents.test.ts).
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

const { CORRECCIONES, COLA } = vi.hoisted(() => ({
  CORRECCIONES: [] as Record<string, unknown>[],
  // La cola que sirve el backend de mentira: la vista la carga por su cuenta.
  COLA: { incidents: [] as unknown[] },
}));

vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  return {
    // La cola la carga la propia vista (el armazón no le pasa datos): se le
    // sirve lo que la prueba haya puesto, siempre el mismo array para no
    // provocar renders en bucle.
    useQuery: (query: unknown) => {
      const nombre = getFunctionName(query as never);
      return nombre === "incidents:list" ? COLA.incidents : undefined;
    },
    useMutation: (mutation: unknown) => async (args: unknown) => {
      // Lo que se anota es el guardado que se está probando. Se nombra la
      // función en vez de compararla: cada acceso a `api` devuelve un objeto
      // nuevo, así que la referencia no se puede comparar consigo misma.
      if (getFunctionName(mutation as never) === "incidents:updateEquipment") {
        CORRECCIONES.push(args as Record<string, unknown>);
      }
      return undefined;
    },
  };
});

import { MemoryRouter } from "react-router";

import type { Doc, Id } from "@/convex/_generated/dataModel";
import { IncidentsView } from "@/pages/dashboard/IncidentsView";

const TECNICO = "user-tec" as Id<"users">;
const OTRO = "user-otro" as Id<"users">;
const AYER = Date.parse("2026-10-01T09:00:00.000Z");

/**
 * La incidencia tal y como la sirve la cola. Se notificó con el modelo escrito
 * de memoria y, por defecto, con el nº de serie en blanco: es el caso que este
 * arreglo existe para cubrir.
 */
function incidencia(extra: Partial<Doc<"incidents">> = {}): Doc<"incidents"> {
  return {
    _id: "inc-4",
    _creationTime: AYER,
    reference: "INC-0004",
    reporterName: "Laura Peña",
    reporterRole: "Realización",
    location: "Plató 1",
    equipmentKind: "Cámara de estudio",
    model: "HDC 350",
    description: "La cámara se apaga sola en directo cuando se mueve el cable.",
    reportedAt: AYER,
    status: "assigned",
    assigneeId: TECNICO,
    assigneeName: "Iván Torres",
    history: [
      { status: "reported", at: AYER, by: "Laura Peña" },
      { status: "assigned", at: AYER + 60 * 60 * 1000, by: "Iván Torres" },
    ],
    createdAt: AYER,
    updatedAt: AYER,
    ...extra,
  } as unknown as Doc<"incidents">;
}

/** Lo que jsdom no trae y Radix da por hecho al abrir la ficha y sus diálogos. */
function installMissingDomApis() {
  if (typeof window.matchMedia !== "function") {
    window.matchMedia = (query: string) =>
      ({
        media: query,
        matches: false,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList;
  }
  if (!("ResizeObserver" in window)) {
    (window as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  const proto = Element.prototype as unknown as Record<string, unknown>;
  proto.hasPointerCapture ??= () => false;
  proto.setPointerCapture ??= () => {};
  proto.releasePointerCapture ??= () => {};
  proto.scrollIntoView ??= () => {};
}

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  installMissingDomApis();
  // Sin esto React avisa en cada `act`: jsdom no es un navegador y hay que
  // decirle que las actualizaciones son las de una prueba.
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  CORRECCIONES.length = 0;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  // El diálogo y la ficha se pintan en un portal colgado del cuerpo: se limpia
  // para que la prueba siguiente no lea lo de esta.
  document.body.innerHTML = "";
});

/** Deja pasar un turno: Radix engancha sus escuchas en un temporizador. */

/** Monta la cola con esas incidencias y abre la ficha de la primera. */
async function abrirFicha(
  incidents: Doc<"incidents">[],
  currentUserId: Id<"users"> | null = TECNICO,
) {
  // La cola que va a leer la vista es la que se le sirve al backend de mentira.
  COLA.incidents = incidents;
  await act(async () => {
    // La cola trae sus enlaces al formulario público: sin router no se pinta
    root.render(
      <MemoryRouter>
        <IncidentsView currentUserId={currentUserId} />
      </MemoryRouter>,
    );
  });
  await settle();
  act(() => {
    container
      .querySelector<HTMLButtonElement>("[data-row] button")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await settle();
}

/** Un botón por su texto exacto, esté donde esté (la ficha va en un portal). */
function boton(texto: string): HTMLButtonElement | undefined {
  return [...document.querySelectorAll("button")].find(
    (candidate) => (candidate.textContent ?? "").trim() === texto,
  );
}

/** Escribe en un campo como si se tecleara, para que React lo note. */
function escribir(campo: HTMLInputElement, texto: string) {
  act(() => {
    const escribirValor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    escribirValor?.call(campo, texto);
    campo.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("ficha de la incidencia — corregir los datos del equipo", () => {
  test("el técnico asignado pone el modelo correcto y el nº de serie que faltaba", async () => {
    await abrirFicha([incidencia()]);

    // La ficha enseña el modelo tal y como llegó, y con él el nº de serie vacío
    const ficha = document.body.textContent ?? "";
    expect(ficha).toContain("Datos de la notificación");
    expect(ficha).toContain("Modelo");
    expect(ficha).toContain("HDC 350");

    act(() => boton("Corregir datos del equipo")!.click());
    await settle();

    // El diálogo abre con lo que llegó con la notificación puesto en el campo
    const modelo =
      document.querySelector<HTMLInputElement>("#equipment-model")!;
    const serie =
      document.querySelector<HTMLInputElement>("#equipment-serial")!;
    expect(modelo.value).toBe("HDC 350");
    expect(serie.value).toBe("");
    // Y sin cambiar nada no se deja guardar: corregir el dato no es un trámite
    expect(boton("Guardar")!.disabled).toBe(true);

    escribir(modelo, "HDC-3500");
    escribir(serie, " HDC3500-2505-0147 ");
    act(() => boton("Guardar")!.click());
    await settle();

    expect(CORRECCIONES).toEqual([
      {
        incidentId: "inc-4",
        model: "HDC-3500",
        // Los espacios de más no se guardan: el dato se limpia al entrar
        serialNumber: "HDC3500-2505-0147",
      },
    ]);
  });

  test("el modelo no puede quedarse en blanco y el guardado lo dice", async () => {
    await abrirFicha([incidencia({ serialNumber: "HDC3500-2505-0147" })]);
    act(() => boton("Corregir datos del equipo")!.click());
    await settle();

    const modelo =
      document.querySelector<HTMLInputElement>("#equipment-model")!;
    escribir(modelo, "   ");

    expect(document.body.textContent).toContain(
      "El modelo identifica la máquina",
    );
    expect(boton("Guardar")!.disabled).toBe(true);
    expect(CORRECCIONES).toEqual([]);
  });

  test("quien no lleva la incidencia no ve la corrección", async () => {
    await abrirFicha([
      incidencia({ assigneeId: OTRO, assigneeName: "Nuria Cano" }),
    ]);

    expect(boton("Corregir datos del equipo")).toBeUndefined();
    expect(document.body.textContent).toContain(
      "Solo el técnico asignado o el coordinador pueden actuar",
    );
  });
});
