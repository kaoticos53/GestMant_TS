// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { SortableTableHead, TableSortBar } from "@/components/TableSort";
import { Table, TableHeader, TableRow } from "@/components/ui/table";
import type { TableSort } from "@/lib/tableSort";

/**
 * La barra de orden —el selector de columna y el aviso de por dónde va la tabla—
 * y la cabecera que se pulsa. Se montan de verdad, con su estado, como en las
 * tablas del taller: lo que hay que comprobar es el ciclo completo, tanto
 * pulsando una cabecera como eligiendo en el selector.
 *
 * La tabla de mentira copia lo que hacen las de verdad: la columna «Precio» va
 * escondida en pantallas estrechas (`hidden md:table-cell`), así que su cabecera
 * no se puede pulsar. El selector tiene que llegar a ella igualmente.
 */

/** Las columnas de la tabla de mentira: sus claves son las que se ordenan. */
const COLUMNS = {
  code: { label: "Código" },
  stock: { label: "Stock" },
  price: { label: "Precio" },
} as const;

/** Lo que la tabla esconde mientras no se vea ancha. */
const HIDDEN = "hidden md:table-cell";

let roots: Root[] = [];

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/** Monta la barra y las cabeceras con el mismo estado que llevan las vistas. */
async function mountTable() {
  function Harness() {
    const [sort, setSort] = useState<TableSort<keyof typeof COLUMNS> | null>(
      null,
    );
    return (
      <>
        <TableSortBar columns={COLUMNS} sort={sort} onSortChange={setSort} />
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead
                column="code"
                label="Código"
                sort={sort}
                onSortChange={setSort}
              />
              <SortableTableHead
                column="stock"
                label="Stock"
                sort={sort}
                onSortChange={setSort}
                align="right"
              />
              <SortableTableHead
                column="price"
                label="Precio"
                sort={sort}
                onSortChange={setSort}
                className={HIDDEN}
              />
            </TableRow>
          </TableHeader>
        </Table>
      </>
    );
  }

  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(<Harness />);
  });
  await settle();
  return container;
}

/** El botón de una cabecera, buscado por lo que dice su etiqueta accesible. */
function headerButton(container: Element, label: string): HTMLButtonElement {
  const button = [...container.querySelectorAll("th button")].find((node) =>
    (node.getAttribute("aria-label") ?? "").startsWith(`Ordenar por ${label}:`),
  );
  if (!button) throw new Error(`No hay cabecera de «${label}».`);
  return button as HTMLButtonElement;
}

/** La cabecera de una columna, para poder mirar su `aria-sort` y sus clases. */
function headerCell(container: Element, label: string): Element {
  const head = [...container.querySelectorAll("th")].find((node) =>
    (node.textContent ?? "").includes(label),
  );
  if (!head) throw new Error(`No hay columna de «${label}».`);
  return head;
}

/** El `aria-sort` de una columna, tal y como lo ve un lector de pantalla. */
function sortOf(container: Element, label: string): string | null {
  return headerCell(container, label).getAttribute("aria-sort") ?? null;
}

/** El disparador del selector de orden. */
function trigger(container: Element): HTMLButtonElement {
  const button = container.querySelector('[role="combobox"]');
  if (!button) throw new Error("No hay selector de orden.");
  return button as HTMLButtonElement;
}

/** El botón que mueve el sentido, buscado por lo que dice su etiqueta accesible. */
function flipButton(container: Element): HTMLButtonElement {
  const button = [...container.querySelectorAll("button")].find((node) =>
    (node.getAttribute("aria-label") ?? "").startsWith("Ordenar de"),
  );
  if (!button) throw new Error("No hay botón de invertir el sentido.");
  return button as HTMLButtonElement;
}

async function press(button: HTMLButtonElement) {
  await act(async () => {
    button.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }),
    );
  });
  await settle();
}

/**
 * Abre el selector y devuelve sus opciones. Se abre con el teclado, que es el
 * camino que no depende de dónde acabe el desplegable en la pantalla: el foco va
 * al disparador y la flecha hacia abajo despliega la lista.
 */
async function openPicker(container: Element): Promise<HTMLElement[]> {
  const combobox = trigger(container);
  await act(async () => {
    combobox.focus();
    combobox.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowDown",
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await settle();
  return [...document.querySelectorAll<HTMLElement>('[role="option"]')];
}

/** Elige una opción del selector por lo que se lee en ella. */
async function chooseOption(container: Element, option: string) {
  const options = await openPicker(container);
  const node = options.find(
    (candidate) =>
      candidate.textContent === option ||
      (candidate.textContent ?? "").startsWith(`${option} ·`),
  );
  if (!node) throw new Error(`El selector no ofrece «${option}».`);
  await act(async () => {
    node.focus();
    node.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await settle();
}

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  // Sin maquetación no hay desplazamientos que hacer, pero Radix los pide.
  Element.prototype.scrollIntoView = () => {};
});

afterEach(async () => {
  await act(async () => {
    for (const root of roots) root.unmount();
  });
  roots = [];
  document.body.innerHTML = "";
});

describe("la cabecera que ordena", () => {
  test("pulsarla ordena de menor a mayor, invierte el sentido y vuelve al original", async () => {
    const container = await mountTable();
    expect(sortOf(container, "Código")).toBe("none");

    await press(headerButton(container, "Código"));
    expect(sortOf(container, "Código")).toBe("ascending");

    await press(headerButton(container, "Código"));
    expect(sortOf(container, "Código")).toBe("descending");

    await press(headerButton(container, "Código"));
    expect(sortOf(container, "Código")).toBe("none");
  });

  test("la etiqueta accesible dice qué hará la próxima pulsación", async () => {
    const container = await mountTable();
    expect(
      headerButton(container, "Código").getAttribute("aria-label"),
    ).toContain("de menor a mayor");
    await press(headerButton(container, "Código"));
    expect(
      headerButton(container, "Código").getAttribute("aria-label"),
    ).toContain("de mayor a menor");
    await press(headerButton(container, "Código"));
    expect(
      headerButton(container, "Código").getAttribute("aria-label"),
    ).toContain("volver al orden original");
  });

  test("dos columnas no se ordenan a la vez", async () => {
    const container = await mountTable();
    await press(headerButton(container, "Código"));
    await press(headerButton(container, "Stock"));

    expect(sortOf(container, "Código")).toBe("none");
    expect(sortOf(container, "Stock")).toBe("ascending");
  });
});

describe("el selector de orden", () => {
  test("llega a las columnas que la tabla esconde en pantalla estrecha", async () => {
    const container = await mountTable();
    // La cabecera que no se ve: no hay forma de pulsarla en un móvil.
    expect(headerCell(container, "Precio").className).toContain(HIDDEN);

    const options = await openPicker(container);
    expect(options.map((node) => node.textContent)).toEqual([
      "Orden original",
      "Código",
      "Stock",
      "Precio",
    ]);
  });

  test("elegir una columna oculta ordena la tabla por ella", async () => {
    const container = await mountTable();
    await chooseOption(container, "Precio");

    expect(sortOf(container, "Precio")).toBe("ascending");
    expect(container.textContent).toContain("Ordenada por");
    expect(container.textContent).toContain("Precio");
    expect(container.textContent).toContain("de menor a mayor");
    // El disparador se queda diciendo lo que se ha elegido.
    expect(trigger(container).textContent).toContain("Precio");
  });

  test("el botón de al lado invierte el sentido de esa columna", async () => {
    const container = await mountTable();
    await chooseOption(container, "Precio");
    expect(sortOf(container, "Precio")).toBe("ascending");

    await press(flipButton(container));
    expect(sortOf(container, "Precio")).toBe("descending");
    expect(container.textContent).toContain("de mayor a menor");
    expect(trigger(container).textContent).toContain("Precio");

    await press(flipButton(container));
    expect(sortOf(container, "Precio")).toBe("ascending");
    expect(container.textContent).toContain("de menor a mayor");
  });

  test("sin columna elegida no hay sentido que invertir", async () => {
    const container = await mountTable();
    const flip = [...container.querySelectorAll("button")].find((node) =>
      (node.getAttribute("aria-label") ?? "").startsWith("Invertir el sentido"),
    );
    if (!flip) throw new Error("No hay botón de invertir el sentido.");
    expect((flip as HTMLButtonElement).disabled).toBe(true);
  });

  test("«Orden original» devuelve la tabla a como llega", async () => {
    const container = await mountTable();
    await chooseOption(container, "Stock");
    expect(sortOf(container, "Stock")).toBe("ascending");

    await chooseOption(container, "Orden original");
    expect(sortOf(container, "Stock")).toBe("none");
    expect(container.textContent).not.toContain("Ordenada por");
  });

  test("el selector dice por dónde va la tabla se ordene como se ordene", async () => {
    const container = await mountTable();
    expect(trigger(container).textContent).toBe("Orden original");
    expect(trigger(container).getAttribute("aria-label")).toBe(
      "Ordenar por columna",
    );

    // Ordenada desde la cabecera: el selector se entera igual.
    await press(headerButton(container, "Stock"));
    expect(trigger(container).textContent).toContain("Stock");
  });
});

describe("el aviso de por dónde va la tabla", () => {
  test("sin ordenar no se enseña", async () => {
    const container = await mountTable();
    expect(container.textContent ?? "").not.toContain("Ordenada por");
  });

  test("con la tabla ordenada dice por dónde y ofrece volver", async () => {
    const container = await mountTable();
    await press(headerButton(container, "Stock"));

    expect(container.textContent).toContain("Ordenada por");
    expect(container.textContent).toContain("Stock");
    expect(container.textContent).toContain("de menor a mayor");

    const reset = [...container.querySelectorAll("button")].find(
      (node) =>
        node.getAttribute("role") !== "combobox" &&
        (node.textContent ?? "").trim() === "Orden original",
    );
    if (!reset) throw new Error("El aviso no ofrece volver al orden original.");
    await press(reset as HTMLButtonElement);

    expect(sortOf(container, "Stock")).toBe("none");
    expect(container.textContent ?? "").not.toContain("Ordenada por");
  });
});
