// @vitest-environment jsdom
// Se sustituyen el backend y los hooks de Convex *antes* de que el componente los
// importe: aquí se comprueba la pantalla de consulta del invitado —que enseña lo
// que le llega y calla lo que le falta—, no la consulta en sí (esa está en
// tests/incidents.test.ts y tests/guestAccess.test.ts).
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

const estado = vi.hoisted(() => ({
  /** Las consultas que la pantalla ha pedido, ya en su forma canónica. */
  consultas: [] as string[],
  /** Lo que el backend contesta a la última: el seguimiento, `null` o nada aún. */
  respuesta: undefined as unknown,
}));

vi.mock("@/convex/_generated/api", () => ({
  api: { incidents: { byReference: { nombre: "incidents.byReference" } } },
}));

vi.mock("convex/react", () => ({
  useQuery: (_query: unknown, args: unknown) => {
    if (args === "skip") return undefined;
    // Como la suscripción de verdad: se anota la consulta, no cada repintado.
    const clave = JSON.stringify(args);
    if (!estado.consultas.includes(clave)) estado.consultas.push(clave);
    return estado.respuesta;
  },
}));

import { IncidentLookup } from "@/pages/dashboard/IncidentLookup";

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  // Sin esto React avisa en cada `act`: jsdom no es un navegador y hay que
  // decirle que las actualizaciones son las de una prueba.
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  estado.consultas.length = 0;
  estado.respuesta = undefined;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(<IncidentLookup />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/** Reportar algo guardado en el editor: el texto tal y como se lee. */
function escribir(texto: string) {
  const campo = container.querySelector("input") as HTMLInputElement;
  act(() => {
    const escribirValor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    escribirValor?.call(campo, texto);
    campo.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** Escribe la referencia y pulsa «Consultar», como quien tiene el papel delante. */
function consultar(texto: string) {
  escribir(texto);
  act(() => {
    container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

const texto = () => container.textContent ?? "";

/** El seguimiento que devuelve el backend para una incidencia en curso. */
const seguimiento = {
  reference: "INC-0004",
  status: "assigned" as const,
  equipmentKind: "Cámara de estudio",
  model: "HDC-3500",
  serialNumber: "HDC3500-2505-0147",
  location: "Plató 1",
  description: "La cámara se apaga sola en directo cuando se mueve el cable.",
  reportedAt: Date.parse("2026-10-01T09:00:00.000Z"),
  closedAt: null,
  assigneeName: "Iván Torres",
  workshopAssigneeName: null,
  history: [
    { status: "reported" as const, at: Date.parse("2026-10-01T09:00:00.000Z") },
    { status: "assigned" as const, at: Date.parse("2026-10-01T10:00:00.000Z") },
  ],
};

describe("IncidentLookup — seguir una incidencia por su referencia", () => {
  test("la referencia se teclee como se teclee, se consulta en su forma canónica", () => {
    for (const typed of ["INC-0004", "inc-4", "4", " la 4 "]) {
      estado.consultas.length = 0;
      consultar(typed);
      expect(estado.consultas, `«${typed}»`).toEqual([
        '{"reference":"INC-0004"}',
      ]);
    }
  });

  test("el seguimiento llega a la pantalla con su paso a paso", () => {
    estado.respuesta = seguimiento;
    consultar("4");

    expect(texto()).toContain("INC-0004");
    expect(texto()).toContain("Asignada");
    expect(texto()).toContain("Cámara de estudio · HDC-3500");
    expect(texto()).toContain("Plató 1");
    expect(texto()).toContain("HDC3500-2505-0147");
    expect(texto()).toContain("Iván Torres");
    expect(texto()).toContain("La cámara se apaga sola en directo");
    // El paso a paso: lo que ha pasado y cuándo, sin quién lo dio.
    expect(texto()).toContain("Nueva");
    expect(texto()).toContain("INC-0004");
  });

  test("algo sin número no se pregunta: se dice lo que falta", () => {
    consultar("la de la cámara");

    expect(estado.consultas).toEqual([]);
    expect(texto()).toContain("Escribe el número de la incidencia");
  });

  test("si no hay ninguna con esa referencia, se dice cuál se buscó", () => {
    estado.respuesta = null;
    consultar("7");

    expect(texto()).toContain("No encontramos ninguna incidencia");
    expect(texto()).toContain("INC-0007");
  });

  test("seguir escribiendo no cambia lo que se está leyendo", () => {
    estado.respuesta = seguimiento;
    consultar("INC-0004");
    expect(texto()).toContain("Cámara de estudio · HDC-3500");

    // Lo tecleado después no es una consulta nueva: el resultado sigue siendo el
    // de la referencia que se pidió.
    escribir("INC-0004 y algo más");

    expect(estado.consultas).toEqual(['{"reference":"INC-0004"}']);
    expect(texto()).toContain("Cámara de estudio · HDC-3500");
    expect(texto()).not.toContain("No encontramos ninguna incidencia");
  });
});
