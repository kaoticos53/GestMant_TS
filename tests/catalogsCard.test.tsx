// @vitest-environment jsdom
// Se sustituyen los hooks de Convex *antes* de que la tarjeta los importe: aquí
// se comprueba la pantalla —la tabla, sus páginas y el cambio de catálogo—, no
// la conversación con el servidor.
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

const { MARCAS, PROVEEDORES } = vi.hoisted(() => ({
  MARCAS: Array.from({ length: 45 }, (_, i) => ({
    _id: `brand-${i}`,
    _creationTime: 1,
    kind: "brand",
    name: `Marca ${i}`,
    normalized: `marca ${i}`,
  })),
  PROVEEDORES: Array.from({ length: 12 }, (_, i) => ({
    _id: `supplier-${i}`,
    _creationTime: 1,
    kind: "supplier",
    name: `Proveedor ${i}`,
    normalized: `proveedor ${i}`,
  })),
}));

vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  // Las mutaciones de la tarjeta no son lo que se prueba: se les da una que no
  // hace nada, siempre la misma para que ningún efecto se repita sin fin.
  const NOOP = async () => undefined;
  return {
    useQuery: (query: unknown, args?: { kind?: string }) => {
      if (getFunctionName(query as never) !== "catalogs:list") return undefined;
      return args?.kind === "supplier" ? PROVEEDORES : MARCAS;
    },
    useMutation: () => NOOP,
  };
});

import { CatalogsCard } from "@/pages/dashboard/settings/CatalogsCard";

/** Lo que jsdom no trae y la tabla dan por hecho para medirse. */
function installMissingDomApis() {
  if (!("ResizeObserver" in window)) {
    (window as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
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
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  document.body.innerHTML = "";
});

/** Pinta la tarjeta y espera a que la lista esté. */
async function pintar() {
  await act(async () => {
    root.render(<CatalogsCard />);
  });
  await settle();
}

/** Las cabeceras de la tabla, en orden. */
function cabeceras(): string[] {
  return [...container.querySelectorAll("[data-slot='table-head']")].map(
    (node) => (node.textContent ?? "").trim(),
  );
}

/** Las filas que se están viendo ahora mismo. */
function filas(): string[] {
  return [...container.querySelectorAll("[data-slot='table-body'] tr")].map(
    (node) => (node.textContent ?? "").trim(),
  );
}

/** El recuento del pie: por dónde va la página. */
function resumen(): string {
  const node = [...container.querySelectorAll("p")].find((candidate) =>
    (candidate.textContent ?? "").includes("Mostrando"),
  );
  return (node?.textContent ?? "").trim();
}

/** Un botón por lo que dice, para no depender del orden de los iconos. */
function boton(etiqueta: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll("button")].find(
    (candidate) => (candidate.textContent ?? "").trim() === etiqueta,
  );
}

/** El buscador de la tarjeta. */
function buscador(): HTMLInputElement {
  const campo = container.querySelector<HTMLInputElement>(
    "input[placeholder^='Buscar en']",
  );
  if (!campo) throw new Error("La tarjeta no tiene buscador.");
  return campo;
}

async function pulsar(target: Element) {
  await act(async () => {
    target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await settle();
}

/** Escribe en el buscador como si se tecleara, para que React lo note. */
async function escribir(texto: string) {
  await act(async () => {
    const escribirValor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    escribirValor?.call(buscador(), texto);
    buscador().dispatchEvent(new Event("input", { bubbles: true }));
  });
  await settle();
}

describe("los catálogos maestros, como tabla paginada", () => {
  test("las marcas se leen en una tabla con su pie de páginas", async () => {
    await pintar();

    expect(cabeceras()).toEqual(["Marca", "Normalizado", "Acciones"]);
    // Según lo que mide el área: sin medida todavía, el tamaño de siempre.
    expect(filas()).toHaveLength(10);
    expect(filas()[0]).toContain("Marca 0");
    expect(resumen()).toBe("Mostrando 1 a 10 de 45 marcas");
  });

  test("pasar de página cambia las filas que se ven", async () => {
    await pintar();

    const siguiente = container.querySelector<HTMLButtonElement>(
      "[aria-label='Página siguiente']",
    );
    await pulsar(siguiente!);

    expect(filas()[0]).toContain("Marca 10");
    expect(resumen()).toBe("Mostrando 11 a 20 de 45 marcas");
  });

  test("cambiar de catálogo vuelve a la primera página y cambia la cabecera", async () => {
    await pintar();
    await pulsar(
      container.querySelector("[aria-label='Página siguiente']")!,
    );
    expect(resumen()).toContain("Mostrando 11 a 20");

    await pulsar(boton("Proveedores")!);

    // Otra lista es otra lista: no se arrastra la página de la anterior.
    expect(cabeceras()).toEqual(["Proveedor", "Normalizado", "Acciones"]);
    expect(resumen()).toBe("Mostrando 1 a 10 de 12 proveedores");
    expect(filas()[0]).toContain("Proveedor 0");
  });

  test("buscar afina la lista y vuelve a la primera página", async () => {
    await pintar();
    await pulsar(
      container.querySelector("[aria-label='Página siguiente']")!,
    );

    await escribir("Marca 41");

    // Solo la marca buscada, y su página es la primera porque el filtro es nuevo.
    expect(filas()).toHaveLength(1);
    expect(filas()[0]).toContain("Marca 41");
    // Con el filtro puesto, el pie añade cuántos hay en el catálogo.
    expect(resumen()).toContain("Mostrando el 1 de 1 marca");
    expect(resumen()).toContain("45 en el catálogo");
  });
});
