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

const { EQUIPOS, CATALOGO, GUARDADOS } = vi.hoisted(() => ({
  /**
   * El taller con más de cien equipos. Antes se pintaba un botón por cada uno
   * —con miles, la ficha no se podía abrir—, así que esta lista es el caso que el
   * arreglo existe para cubrir. Uno de cada quince es la misma cámara: ocho
   * coincidencias para una búsqueda, más de las que se enseñan a la vez.
   *
   * Son ciento veinte y no cuatrocientos por el coste de montar la vista en
   * jsdom: el defecto que se vigila —un botón por equipo— se ve igual con la
   * lista larga, y con menos el montaje deja de rondar el límite de tiempo de la
   * prueba cuando la suite entera corre en paralelo.
   */
  EQUIPOS: Array.from({ length: 120 }, (_, index) => ({
    _id: `eq-${index}`,
    _creationTime: 1,
    code: `EQ-${String(index + 1).padStart(3, "0")}`,
    name: index % 15 === 0 ? `Cámara de estudio ${index}` : `Equipo ${index}`,
    model: index % 15 === 0 ? "HDC-3500" : `MOD-${index}`,
  })),
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

/** Los equipos que la búsqueda está ofreciendo ahora mismo. */
function resultados(): HTMLButtonElement[] {
  return [
    ...document.querySelectorAll<HTMLButtonElement>(
      "[aria-label='Equipos que coinciden'] li button",
    ),
  ];
}

/**
 * Los equipos añadidos como compatibles: las píldoras de la ficha, que se
 * reconocen por su título (el botón de la tabla que quita una unidad del stock
 * también empieza por «Quitar»).
 */
function compatibles(): HTMLButtonElement[] {
  return [
    ...document.querySelectorAll<HTMLButtonElement>(
      "button[title='Quitar de compatibles']",
    ),
  ];
}

/** El campo de búsqueda de compatibles del diálogo. */
function campoBusqueda(): HTMLInputElement {
  const campo = document.querySelector<HTMLInputElement>(
    "#part-compatible-search",
  );
  if (!campo) throw new Error("El diálogo no tiene el campo de compatibles.");
  return campo;
}

/** Abre la ficha de un repuesto nuevo, que es donde está la sección. */
async function abrirNuevoRepuesto() {
  await pintar();
  await pulsar(boton("Nuevo repuesto")!);
  // La sección está delante: su campo de búsqueda.
  expect(campoBusqueda()).not.toBeNull();
}

/** Un repuesto del catálogo, con los equipos que tiene puestos. */
function repuesto(compatibleWith: string[]) {
  return {
    _id: "part-1",
    _creationTime: 1,
    code: "ALI-24015",
    name: "Fuente de alimentación",
    category: "Alimentación",
    unit: "ud",
    stock: 3,
    minStock: 1,
    compatibleWith,
    createdAt: 1,
    updatedAt: 1,
  };
}

describe("la ficha de un repuesto — Compatible con", () => {
  test("con cientos de equipos no se pinta un botón por equipo", async () => {
    await abrirNuevoRepuesto();

    // El campo está para buscar, y de los equipos no hay ni rastro en pantalla:
    // solo se ofrece lo que se busca. Un botón por equipo serían ciento veinte.
    expect(campoBusqueda().value).toBe("");
    expect(document.body.textContent).not.toContain("MOD-3");
    expect(resultados()).toEqual([]);
    expect(compatibles()).toEqual([]);
    expect(document.querySelectorAll("button").length).toBeLessThan(30);
  });

  test("se busca, se añade de uno en uno, se quita y se guarda lo añadido", async () => {
    // Un solo montaje para el ciclo entero: añadir, quitar y guardar son pasos
    // del mismo gesto, y montar la ficha otra vez para cada uno es lo que hacía
    // que la prueba se acercara al límite de tiempo con la suite en paralelo.
    await abrirNuevoRepuesto();

    // Ocho equipos de la misma cámara: se enseñan los primeros y se dice cuántos hay.
    escribir(campoBusqueda(), "cámara");
    expect(resultados()).toHaveLength(6);
    expect(document.body.textContent).toContain("Coinciden 8 equipos");

    // Se añade el primero: pasa a la lista de compatibles…
    await pulsar(resultados()[0]);
    expect(
      compatibles().map((item) => item.getAttribute("aria-label")),
    ).toEqual(["Quitar Cámara de estudio 0 HDC-3500"]);
    // …y deja de ofrecerse en la búsqueda (queda libre el hueco que ocupaba).
    expect(resultados()).toHaveLength(6);
    expect(
      resultados().some((item) =>
        (item.textContent ?? "").trim().startsWith("Cámara de estudio 0"),
      ),
    ).toBe(false);
    expect(document.body.textContent).toContain("Coinciden 7 equipos");

    // Se añade otro, y se quita el primero: el que se quita vuelve a ofrecerse.
    await pulsar(resultados()[0]);
    expect(compatibles()).toHaveLength(2);
    await pulsar(compatibles()[0]);
    expect(
      compatibles().map((item) => item.getAttribute("aria-label")),
    ).toEqual(["Quitar Cámara de estudio 15 HDC-3500"]);
    expect(
      resultados().some((item) =>
        (item.textContent ?? "").trim().startsWith("Cámara de estudio 0"),
      ),
    ).toBe(true);

    // Lo que se ve añadido es lo que se guarda: el que se quitó no viaja.
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
    expect(GUARDADOS[0].compatibleWith).toEqual(["eq-15"]);
  });

  test("al abrir un repuesto se ven solo sus compatibles, no el inventario", async () => {
    CATALOGO.push(repuesto(["eq-0", "eq-15"]));
    await pintar();

    await pulsar(
      document.querySelector<HTMLButtonElement>(
        "button[aria-label='Editar ALI-24015']",
      )!,
    );

    // Los dos que tiene puestos, y nada más: el resto del inventario no se pinta.
    expect(
      compatibles().map((item) => item.getAttribute("aria-label")),
    ).toEqual([
      "Quitar Cámara de estudio 0 HDC-3500",
      "Quitar Cámara de estudio 15 HDC-3500",
    ]);
    expect(document.body.textContent).not.toContain("MOD-3");
    expect(document.querySelectorAll("button").length).toBeLessThan(40);
  });
});
