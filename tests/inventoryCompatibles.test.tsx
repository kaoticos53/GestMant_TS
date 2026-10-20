// @vitest-environment jsdom
// Se sustituyen los hooks de Convex *antes* de que la vista los importe: aquí se
// comprueba la pantalla —la búsqueda, lo que se añade y lo que se manda al
// guardar—, no la conversación con el servidor (esa está en tests/repuestos.test.ts).
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

const { EQUIPOS, MODELOS, CATALOGO, GUARDADOS } = vi.hoisted(() => ({
  EQUIPOS: Array.from({ length: 120 }, (_, index) => ({
    _id: `eq-${index}`,
    _creationTime: 1,
    code: `EQ-${String(index + 1).padStart(3, "0")}`,
    name: index % 15 === 0 ? `Cámara de estudio ${index}` : `Equipo ${index}`,
    model: index % 15 === 0 ? "HDC-3500" : `MOD-${index}`,
    modelId: index % 15 === 0 ? "mod-hdc3500" : `mod-${index}`,
  })),
  MODELOS: [
    {
      _id: "mod-hdc3500",
      _creationTime: 1,
      model: "HDC-3500",
      name: "Cámara de estudio",
      // La marca es el nombre del catálogo maestro guardado en el modelo: no hay
      // tabla de marcas que consultar aparte.
      brand: "Sony",
    },
    ...Array.from({ length: 20 }, (_, i) => ({
      _id: `mod-${i}`,
      _creationTime: 1,
      model: `MOD-${i}`,
      name: `Equipo Modelo ${i}`,
    })),
  ],
  /** El catálogo que sirve el backend de mentira: lo pone cada prueba. */
  CATALOGO: [] as unknown[],
  /** Lo que la pantalla manda guardar. */
  GUARDADOS: [] as Record<string, unknown>[],
}));

vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  return {
    // El catálogo y los equipos los carga la vista por su cuenta: se le sirve lo
    // que la prueba haya puesto, siempre el mismo array para no renderizar en bucle.
    useQuery: (query: unknown) => {
      const nombre = getFunctionName(query as never);
      if (nombre === "equipment:list") return EQUIPOS;
      if (nombre === "equipmentModels:list") return MODELOS;
      if (nombre === "spareParts:list") return CATALOGO;
      return undefined;
    },
    useMutation: (mutation: unknown) => async (args: unknown) => {
      // Se nombra la función en vez de compararla: cada acceso a `api` devuelve
      // un objeto nuevo, así que la referencia no se puede comparar consigo misma.
      if (getFunctionName(mutation as never) === "spareParts:create") {
        GUARDADOS.push(args as Record<string, unknown>);
      }
      return undefined;
    },
    // El editor de la ficha sube sus imágenes por una acción; aquí no se sube nada.
    useAction: () => async () => undefined,
  };
});

import { InventoryView } from "@/pages/dashboard/InventoryView";

/** Lo que jsdom no trae y Radix (diálogos) y la tabla (alto) dan por hecho. */
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
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  installMissingDomApis();
  CATALOGO.length = 0;
  GUARDADOS.length = 0;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = "";
});

/** Pinta la vista con el catálogo puesto. */
async function pintar() {
  await act(async () => {
    root.render(<InventoryView canManage />);
  });
  await settle();
}

/** Pulsa como el navegador: Radix mira los cuatro eventos del puntero. */
async function pulsar(target: Element) {
  await act(async () => {
    target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await settle();
}

/** Un botón por su texto exacto, esté donde esté (el diálogo va en un portal). */
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

/** Los modelos que la búsqueda está ofreciendo ahora mismo. */
function resultados(): HTMLButtonElement[] {
  return [
    ...document.querySelectorAll<HTMLButtonElement>(
      "[aria-label='Modelos que coinciden'] li button",
    ),
  ];
}

/**
 * Los modelos añadidos como compatibles: las píldoras de la ficha, que se
 * reconocen por su título.
 */
function compatibles(): HTMLButtonElement[] {
  return [
    ...document.querySelectorAll<HTMLButtonElement>(
      "button[title='Quitar modelo compatible']",
    ),
  ];
}

/** El campo de búsqueda de modelos compatibles del diálogo. */
function campoBusqueda(): HTMLInputElement {
  const campo = document.querySelector<HTMLInputElement>(
    "#part-model-search",
  );
  if (!campo) throw new Error("El diálogo no tiene el campo de modelos compatibles.");
  return campo;
}

/** Abre la ficha de un repuesto nuevo, que es donde está la sección. */
async function abrirNuevoRepuesto() {
  await pintar();
  await pulsar(boton("Nuevo repuesto")!);
  // La sección está delante: su campo de búsqueda.
  expect(campoBusqueda()).not.toBeNull();
}

/** Un repuesto del catálogo, con los modelos que tiene puestos. */
function repuesto(compatibleModels: string[]) {
  return {
    _id: "part-1",
    _creationTime: 1,
    code: "ALI-24015",
    name: "Fuente de alimentación",
    category: "Alimentación",
    unit: "ud",
    stock: 3,
    minStock: 1,
    compatibleModels,
    createdAt: 1,
    updatedAt: 1,
  };
}

describe("la ficha de un repuesto — Compatible con modelos", () => {
  test("con modelos de catálogo no se pinta un botón por modelo", async () => {
    await abrirNuevoRepuesto();

    // El campo está para buscar, y de los modelos no hay lista plana inicial
    expect(campoBusqueda().value).toBe("");
    expect(resultados()).toEqual([]);
    expect(compatibles()).toEqual([]);
  });

  test("se busca, se añade de uno en uno, se quita y se guarda lo añadido", async () => {
    await abrirNuevoRepuesto();

    // Buscar modelo por marca
    escribir(campoBusqueda(), "Sony");
    expect(resultados()).toHaveLength(1);

    // La sugerencia nombra el modelo por su código —lo que lo distingue— y deja
    // la designación debajo, como ayuda para reconocerlo.
    expect(resultados()[0].textContent).toContain("Sony HDC-3500");
    expect(resultados()[0].textContent).toContain("Cámara de estudio");

    // Se añade el modelo encontrado
    await pulsar(resultados()[0]);
    expect(
      compatibles().map((item) => item.getAttribute("aria-label")),
    ).toEqual(["Quitar Sony HDC-3500"]);

    // Escribir datos obligatorios y guardar
    escribir(
      document.querySelector<HTMLInputElement>("#part-code")!,
      "ALI-24015",
    );
    escribir(
      document.querySelector<HTMLInputElement>("#part-name")!,
      "Fuente de alimentación 24 V",
    );
    await pulsar(boton("Añadir repuesto")!);

    expect(GUARDADOS).toHaveLength(1);
    expect(GUARDADOS[0].code).toBe("ALI-24015");
    expect(GUARDADOS[0].compatibleModels).toEqual(["mod-hdc3500"]);
  });

  test("al abrir un repuesto se ven solo sus modelos compatibles", async () => {
    CATALOGO.push(repuesto(["mod-hdc3500"]));
    await pintar();

    await pulsar(
      document.querySelector<HTMLButtonElement>(
        "button[aria-label='Editar ALI-24015']",
      )!,
    );

    // El modelo asignado aparece en sus compatibles, por su código: la
    // designación («Cámara de estudio») no dice qué modelo es.
    expect(
      compatibles().map((item) => item.getAttribute("aria-label")),
    ).toEqual(["Quitar Sony HDC-3500"]);
  });
});
