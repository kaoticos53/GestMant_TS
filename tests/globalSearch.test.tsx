// @vitest-environment jsdom
// Se sustituyen los hooks de Convex *antes* de que el buscador los importe: lo
// que se comprueba es el buscador —que una incidencia se encuentre por su
// referencia y que elegirla devuelva la ficha—, no la conversación con el
// servidor. Las listas las carga él (vive en la cabecera y no se las puede
// pedir a la pestaña que haya abierta), así que aquí se le sirven puestas.
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

const { LISTAS } = vi.hoisted(() => ({
  LISTAS: { incidents: [] as unknown[], requests: [] as unknown[] },
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    incidents: { list: { nombre: "incidents.list" } },
    partRequests: { list: { nombre: "partRequests.list" } },
    spareParts: { list: { nombre: "spareParts.list" } },
    equipment: { list: { nombre: "equipment.list" } },
  },
}));

vi.mock("convex/react", async () => {
  const { api } = await import("@/convex/_generated/api");
  return {
    useQuery: (query: unknown) => {
      if (query === api.incidents.list) return LISTAS.incidents;
      if (query === api.partRequests.list) return LISTAS.requests;
      if (query === api.spareParts.list || query === api.equipment.list) {
        return [];
      }
      return undefined;
    },
  };
});

import { GlobalSearch, type SearchHit } from "@/pages/dashboard/GlobalSearch";

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const texto = () => container.textContent ?? "";

/** Lo que el buscador contesta a cada elección. */
const elegidas: SearchHit[][] = [];

function pintar(props: Partial<Parameters<typeof GlobalSearch>[0]> = {}): void {
  LISTAS.incidents = [incidencia];
  LISTAS.requests = [peticion];
  act(() => {
    root.render(
      <GlobalSearch onSelect={(hit) => elegidas.push([hit])} {...props} />,
    );
  });
}

const incidencia = {
  _id: "inc-1",
  reference: "INC-0004",
  status: "assigned" as const,
  equipmentKind: "Cámara de estudio",
  model: "HDC-3500",
  serialNumber: "HDC3500-2505-0147",
  location: "Plató 1",
  reporterName: "Laura Peña",
  description: "La cámara se apaga sola en directo cuando se mueve el cable.",
};

const peticion = {
  _id: "req-1",
  reference: "PET-0007",
  requesterName: "Iván Torres",
  requesterTeam: "Realización",
  equipment: "Cámara de estudio",
  description: "Fuente de alimentación de repuesto.",
  lines: [{ code: "ALI-24015", name: "Fuente de alimentación" }],
  status: "pending" as const,
};

/** Escribe en el buscador, como quien lo usa desde la cabecera. */
function buscar(consulta: string) {
  const campo = container.querySelector("input") as HTMLInputElement;
  act(() => {
    const escribirValor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    escribirValor?.call(campo, consulta);
    campo.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** Los resultados que se ofrecen, con el grupo al que pertenecen. */
function resultados(): string[] {
  return [...container.querySelectorAll("button")].map(
    (button) => button.textContent?.trim() ?? "",
  );
}

describe("GlobalSearch — las incidencias en el buscador del taller", () => {
  beforeEach(() => {
    elegidas.length = 0;
  });

  test("una incidencia se encuentra por su referencia, escrita como sea", () => {
    pintar();

    // Las tres formas que alguien teclea en la cabecera: la copiada, sin el
    // prefijo y con el prefijo en minúsculas.
    for (const consulta of ["INC-0004", "inc-4", "4"]) {
      buscar(consulta);
      expect(texto(), `«${consulta}»`).toContain("Incidencias");
      expect(resultados(), `«${consulta}»`).toContain(
        "INC-0004Asignada · Cámara de estudio HDC-3500 · Plató 1",
      );
    }
  });

  test("elegir la incidencia devuelve su ficha al panel", () => {
    pintar();
    buscar("inc-4");

    const resultado = [...container.querySelectorAll("button")].find((boton) =>
      boton.textContent?.includes("INC-0004"),
    );
    expect(
      resultado,
      "la incidencia no está entre los resultados",
    ).not.toBeUndefined();
    act(() => {
      resultado!.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }),
      );
    });

    expect(elegidas).toHaveLength(1);
    expect(elegidas[0][0]).toMatchObject({
      kind: "incident",
      id: "inc-1",
      title: "INC-0004",
    });
    // Al elegir, la consulta se limpia y el desplegable se cierra.
    expect(texto()).not.toContain("Asignada ·");
  });

  test("también se encuentra por su texto, no solo por el número", () => {
    pintar();

    buscar("pierde la señal");
    expect(resultados()).toEqual([]);

    buscar("se apaga sola");
    expect(resultados()).toContain(
      "INC-0004Asignada · Cámara de estudio HDC-3500 · Plató 1",
    );
  });

  test("buscar por la referencia de la incidencia no esconde las peticiones", () => {
    pintar();

    // El número de una incidencia trae su grupo…
    buscar("4");
    expect(texto()).toContain("Incidencias");
    // …y la petición sigue encontrándose por la suya, cada una en su grupo.
    buscar("PET-0007");
    expect(texto()).toContain("Peticiones");
    expect(resultados()).toContain(
      "PET-0007Pendiente · Iván Torres · Cámara de estudio",
    );
  });
});
