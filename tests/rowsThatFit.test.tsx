// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { useRowsThatFit } from "@/hooks/use-rows-that-fit";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";

/**
 * El enganche que mide cuántas filas caben: el alto del área, lo que ocupa la
 * cabecera de la tabla y lo que ocupan las filas, leídos del navegador.
 *
 * Se finge lo que el navegador de las pruebas no calcula: el `max-h` del área
 * —el tope del que sale el alto— y los altos de cabecera y filas. La cuenta en
 * sí (`rowsThatFit`) se prueba en `pagination.test.ts`; lo que se prueba aquí es
 * lo que solo existe con un navegador delante: de dónde salen esos números, que
 * una fila que no entra no se cuente, que se vuelva a medir cuando cambia la
 * ventana —y cuando cambia el ancho, pero no cuando cambia el número de filas—,
 * y que sin nada que medir no se pierda lo que ya se sabía.
 *
 * Lo mismo vale para las dos formas de lista: la tabla, que mide sus filas y su
 * cabecera, y la cola de fichas, que mide las fichas marcadas con `data-row` y el
 * rótulo del grupo marcado con `data-row-header`.
 */

/** El tope de alto que finge el navegador: el `max-h` del área, ya resuelto. */
let cap = "480px";
/** El alto del área cuando el tope no se puede leer. */
let box = 0;
/** Y su ancho, que es lo que hace envolver un texto de una línea a dos. */
let boxWidth = 800;
/** Lo que ocupa cada fila, por orden; sin nada, todas lo mismo. */
let rowHeights: number[] = [];
/** Lo que ocupa una fila de mentira. */
const ROW = 60;
/** Y lo que ocupa la cabecera. */
const HEAD = 40;

/** El descriptor que trae jsdom, para devolverlo tal cual al terminar. */
const originalClientHeight = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "clientHeight",
);
const originalClientWidth = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "clientWidth",
);

/**
 * El número de fila de ese elemento dentro de su lista, o -1 si no es una fila:
 * un `tr` del cuerpo de una tabla, o una ficha de una cola (`data-row`).
 */
function rowIndex(node: Element): number {
  if (node.tagName === "TR" && node.parentElement?.tagName === "TBODY") {
    return [...node.parentElement.children].indexOf(node);
  }
  if (node.hasAttribute("data-row")) {
    return [...document.querySelectorAll("[data-row]")].indexOf(node);
  }
  return -1;
}

/** El alto de la fila número `index`. */
function heightOfRow(index: number): number {
  return rowHeights[index] ?? ROW;
}

/** Lo que suman las filas que van antes de esa: su borde de abajo. */
function topOfRow(index: number): number {
  let top = 0;
  for (let i = 0; i < index; i += 1) top += heightOfRow(i);
  return top;
}

/** Un observador de tamaño de mentira, al que la prueba le puede dar el aviso. */
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  callback: () => void;
  observed: Element[] = [];

  constructor(callback: () => void) {
    this.callback = callback;
    FakeResizeObserver.instances.push(this);
  }

  observe(node: Element) {
    this.observed.push(node);
  }

  unobserve() {}

  disconnect() {}

  fire() {
    this.callback();
  }
}

interface Handle {
  container: HTMLDivElement;
  /** Volver a pintar: es como si la lista se quedara sin filas de repente. */
  update: (props: { rows?: number }) => Promise<void>;
  /** Cuántas filas dice el enganche que caben. */
  fit: () => number;
  /** El área montada. */
  area: () => HTMLElement;
  /** El observador que mira al área, si lo hay. */
  areaObserver: () => FakeResizeObserver | undefined;
}

let roots: Root[] = [];

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/**
 * El área y una lista de mentira, con el enganche midiéndola: la tabla de
 * siempre, o —con `cards`— una cola de fichas con su rótulo de grupo.
 */
function Harness({
  rows = 1,
  cards = 0,
  remeasure,
}: {
  rows?: number;
  cards?: number;
  remeasure?: unknown;
}) {
  const asCards = cards > 0;
  const { areaRef, rowsFit } = useRowsThatFit({
    shape: asCards ? "cards" : "table",
    remeasureKey: remeasure,
  });
  return (
    <div data-area="" ref={areaRef}>
      {asCards ? (
        <>
          <h2 data-row-header>Hoy</h2>
          <div>
            {Array.from({ length: cards }, (_, index) => (
              <article key={index} data-row>
                Ficha {index + 1}
              </article>
            ))}
          </div>
        </>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Cabecera</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, index) => (
              <tr key={index}>
                <td>Fila {index + 1}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p data-fit>{rowsFit}</p>
    </div>
  );
}

async function mountArea(
  props: { rows?: number; cards?: number; remeasure?: unknown } = {},
): Promise<Handle> {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  const area = () => {
    const node = container.querySelector("[data-area]");
    if (!node) throw new Error("No hay área.");
    return node as HTMLElement;
  };
  const handle: Handle = {
    container,
    area,
    update: async (next) => {
      await act(async () => {
        root.render(<Harness {...next} />);
      });
      await settle();
    },
    fit: () =>
      Number(container.querySelector("[data-fit]")?.textContent ?? Number.NaN),
    areaObserver: () =>
      FakeResizeObserver.instances.find((candidate) =>
        candidate.observed.includes(area()),
      ),
  };
  await handle.update(props);
  return handle;
}

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  cap = "480px";
  box = 0;
  boxWidth = 800;
  rowHeights = [];
  FakeResizeObserver.instances = [];

  // Los altos, que jsdom no calcula: la cabecera —o el rótulo del grupo— mide lo
  // suyo, cada fila lo suyo y cada una empieza donde acabó la anterior —que es lo
  // que deja contar cuántas entran de verdad—.
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      const index = rowIndex(this);
      const height =
        this.tagName === "THEAD" || this.hasAttribute("data-row-header")
          ? HEAD
          : index >= 0
            ? heightOfRow(index)
            : 0;
      const top = index >= 0 ? topOfRow(index) : 0;
      return {
        x: 0,
        y: top,
        top,
        left: 0,
        right: 0,
        bottom: top + height,
        width: 0,
        height,
        toJSON: () => ({}),
      } as DOMRect;
    },
  );

  // El `max-h` del área y su relleno: lo único que el enganche le pregunta a la
  // hoja de estilos.
  vi.spyOn(window, "getComputedStyle").mockImplementation((() => ({
    maxHeight: cap,
    paddingTop: "0px",
    paddingBottom: "0px",
    borderTopWidth: "0px",
    borderBottomWidth: "0px",
  })) as typeof window.getComputedStyle);

  // El alto y el ancho interiores del área, que en jsdom son cero.
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get: () => box,
  });
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => boxWidth,
  });
});

afterEach(async () => {
  await act(async () => {
    for (const root of roots) root.unmount();
  });
  roots = [];
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  if (originalClientHeight) {
    Object.defineProperty(
      HTMLElement.prototype,
      "clientHeight",
      originalClientHeight,
    );
  }
  if (originalClientWidth) {
    Object.defineProperty(
      HTMLElement.prototype,
      "clientWidth",
      originalClientWidth,
    );
  }
  delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
});

describe("las filas que caben, medidas", () => {
  test("del tope del área se descuentan la cabecera y las filas", async () => {
    // 480 px de tope, 40 de cabecera: 440 entre filas de 60 son siete enteras.
    const area = await mountArea();
    expect(area.fit()).toBe(7);
  });

  test("lo que se pasa del alto se recorta: ninguna fila cortada", async () => {
    // Cinco filas pintadas, tres cortas y dos altas: de 440 px de hueco caben
    // tres —la cuarta termina en 520— y el promedio pediría solo dos.
    rowHeights = [60, 60, 60, 300, 300];

    const area = await mountArea({ rows: 5 });
    expect(area.fit()).toBe(3);
  });

  test("si lo pintado entra, se cuenta con lo que ocupa una por medio", async () => {
    // Cinco filas de 60 caben de sobra y aún hay hueco para dos más: la medida
    // no se queda en las que están pintadas, dice cuántas cabrían.
    const area = await mountArea({ rows: 5 });
    expect(area.fit()).toBe(7);
  });

  test("cuando cambia la ventana se vuelve a medir", async () => {
    const area = await mountArea();
    expect(area.fit()).toBe(7);

    // La ventana se estira: el tope del área sale de ella y ahora cabe más.
    cap = "1440px";
    await act(async () => {
      window.dispatchEvent(new Event("resize"));
    });
    await settle();

    expect(area.fit()).toBe(23);
  });

  test("el tamaño del documento también manda", async () => {
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver =
      FakeResizeObserver;
    const area = await mountArea();
    expect(area.fit()).toBe(7);

    // Uno mira al documento, que es quien sigue a la ventana; el otro, al área,
    // que es la que cambia cuando se pliega la barra lateral.
    const observer = FakeResizeObserver.instances.find((candidate) =>
      candidate.observed.includes(document.documentElement),
    );
    expect(observer).toBeTruthy();
    expect(area.areaObserver()).toBeTruthy();

    cap = "900px";
    await act(async () => {
      observer!.fire();
    });
    await settle();

    expect(area.fit()).toBe(14);
  });

  test("el aviso del documento no vuelve a medir si el tope del área no cambia", async () => {
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver =
      FakeResizeObserver;
    const area = await mountArea({ cards: 4 });
    expect(area.fit()).toBe(7);

    const observer = FakeResizeObserver.instances.find((candidate) =>
      candidate.observed.includes(document.documentElement),
    );
    expect(observer).toBeTruthy();

    // La página cambia de alto porque acaba de cambiar de página —una ficha con
    // foto no mide lo que una sin ella—: volver a medir por eso dejaría la lista
    // saltando de página sola, así que la medida se queda donde estaba.
    rowHeights = [120, 120, 120, 120];
    await act(async () => {
      observer!.fire();
    });
    await settle();

    expect(area.fit()).toBe(7);
  });

  test("el ancho vuelve a medir, el alto de las filas no", async () => {
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver =
      FakeResizeObserver;
    const area = await mountArea();
    expect(area.fit()).toBe(7);

    const observer = area.areaObserver();
    expect(observer).toBeTruthy();

    // Lo que hay dentro crece sin que el área se estreche: eso es que se pintan
    // más filas, y el tamaño de página no puede cambiar de página en página.
    cap = "900px";
    await act(async () => {
      observer!.fire();
    });
    await settle();
    expect(area.fit()).toBe(7);

    // El área se estrecha —la barra lateral plegada—: las columnas se reparten
    // de otra manera y un texto puede ocupar dos líneas en vez de una.
    boxWidth = 500;
    await act(async () => {
      observer!.fire();
    });
    await settle();

    expect(area.fit()).toBe(14);
  });

  test("sin filas que medir se queda con lo que ya sabía", async () => {
    const area = await mountArea();
    expect(area.fit()).toBe(7);

    // Un filtro que no encuentra nada: no hay fila que medir, pero el tamaño no
    // puede caer a cero —la tabla se quedaría en blanco— ni volver al de siempre
    // en cuanto alguien mueve la ventana.
    await area.update({ rows: 0 });
    await act(async () => {
      window.dispatchEvent(new Event("resize"));
    });
    await settle();

    expect(area.fit()).toBe(7);
  });

  test("si el tope no se puede leer, queda el alto del área", async () => {
    // Un navegador que no sabe resolver el `calc()` del `max-h`.
    cap = "none";
    box = 320;

    const area = await mountArea();
    expect(area.fit()).toBe(4);
  });

  test("sin nada que medir, el tamaño de siempre", async () => {
    cap = "none";
    box = 0;

    const area = await mountArea();
    expect(area.fit()).toBe(DEFAULT_PAGE_SIZE);
  });

  test("una cola de fichas se mide por sus fichas, no por las filas de una tabla", async () => {
    // 480 px de tope y 40 del rótulo del grupo: 440 entre fichas de 60 son siete.
    const area = await mountArea({ cards: 4 });
    expect(area.fit()).toBe(7);
  });

  test("la vista compacta vuelve a medir; el alto de las fichas, por sí solo, no", async () => {
    rowHeights = [120, 120, 120, 120];
    const area = await mountArea({ cards: 4 });
    // Fichas cómodas: de 440 px de hueco entran tres y la cuarta se corta.
    expect(area.fit()).toBe(3);

    // La vista compacta encoge cada ficha sin que la pantalla cambie: si no se
    // volviera a medir, la página seguiría partida por las fichas de antes.
    rowHeights = [60, 60, 60, 60];
    await area.update({ cards: 4 });
    expect(area.fit()).toBe(3);

    await area.update({ cards: 4, remeasure: "compacta" });
    expect(area.fit()).toBe(7);
  });
});
