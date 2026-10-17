// @vitest-environment jsdom
import { settle } from "./settle";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { SortableTableHead, TableSortBar } from "@/components/TableSort";
import { Table, TableHeader, TableRow } from "@/components/ui/table";
import { useTableSort } from "@/hooks/use-table-sort";

/**
 * El orden de una tabla se recuerda para la próxima visita: montar la cabecera
 * con el mismo enganche que usan las vistas, pulsarla, desmontarla —que es
 * «irse»— y volver a montarla es exactamente la visita siguiente. Aquí se
 * comprueba lo que no se puede comprobar sin navegador: que el orden vuelve, que
 * cada persona tiene el suyo y que el de una tabla no se cuela en otra.
 *
 * Se monta a mano con React y jsdom, como el resto de pruebas de componente del
 * taller, y con el `localStorage` de verdad del navegador simulado.
 */

/** Las columnas de la tabla de mentira: sus claves son las que se ordenan. */
const COLUMNS = {
  code: { label: "Código" },
  stock: { label: "Stock" },
} as const;

let roots: Root[] = [];

/** Monta la tabla con el enganche de verdad, como la monta una vista. */
async function mount({
  table = "inventory",
  userId = "u-1",
}: { table?: string; userId?: string | null } = {}) {
  function Harness() {
    const [sort, setSort] = useTableSort({ table, columns: COLUMNS, userId });
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

/** Cerrar la vista (cambiar de módulo, recargar): lo que se lleva el estado. */
async function leave() {
  await act(async () => {
    for (const root of roots) root.unmount();
  });
  roots = [];
  document.body.innerHTML = "";
}

/** El botón de una cabecera, buscado por lo que dice su etiqueta accesible. */
function headerButton(container: Element, label: string): HTMLButtonElement {
  const button = [...container.querySelectorAll("th button")].find((node) =>
    (node.getAttribute("aria-label") ?? "").startsWith(`Ordenar por ${label}:`),
  );
  if (!button) throw new Error(`No hay cabecera de «${label}».`);
  return button as HTMLButtonElement;
}

/** El `aria-sort` de una columna, tal y como lo ve un lector de pantalla. */
function sortOf(container: Element, label: string): string | null {
  const head = [...container.querySelectorAll("th")].find((node) =>
    (node.textContent ?? "").includes(label),
  );
  return head?.getAttribute("aria-sort") ?? null;
}

async function press(button: HTMLButtonElement) {
  await act(async () => {
    button.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }),
    );
  });
  await settle();
}

/** El botón de «volver al orden original» del aviso —el del aviso, no el del
 * selector, que también se lee así cuando la tabla no está ordenada. */
async function pressReset(container: Element) {
  const reset = [...container.querySelectorAll("button")].find(
    (node) =>
      node.getAttribute("role") !== "combobox" &&
      (node.textContent ?? "").trim() === "Orden original",
  );
  if (!reset) throw new Error("El aviso no ofrece volver al orden original.");
  await press(reset as HTMLButtonElement);
}

/**
 * Ordena eligiendo en el selector, que es el camino de las columnas ocultas: se
 * abre con el teclado y se elige por lo que se lee en la opción.
 */
async function chooseOption(container: Element, option: string) {
  const combobox = container.querySelector('[role="combobox"]');
  if (!combobox) throw new Error("No hay selector de orden.");
  await act(async () => {
    (combobox as HTMLElement).focus();
    combobox.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowDown",
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await settle();
  const node = [...document.querySelectorAll('[role="option"]')].find(
    (candidate) => candidate.textContent === option,
  );
  if (!node) throw new Error(`El selector no ofrece «${option}».`);
  await act(async () => {
    (node as HTMLElement).focus();
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
  window.localStorage.clear();
});

afterEach(async () => {
  await leave();
  window.localStorage.clear();
});

describe("el orden de una tabla, recordado entre visitas", () => {
  test("la próxima visita abre la tabla por donde la dejó", async () => {
    const first = await mount();
    await press(headerButton(first, "Stock"));
    await press(headerButton(first, "Stock"));
    expect(sortOf(first, "Stock")).toBe("descending");

    // Se cierra la vista y se vuelve a abrir: el orden sigue siendo suyo.
    await leave();
    const second = await mount();
    expect(sortOf(second, "Stock")).toBe("descending");
    expect(second.textContent).toContain("Ordenada por");
    expect(second.textContent).toContain("Stock");
  });

  test("volver al orden original también se recuerda", async () => {
    const first = await mount();
    await press(headerButton(first, "Código"));
    await pressReset(first);

    await leave();
    const second = await mount();
    expect(sortOf(second, "Código")).toBe("none");
    expect(second.textContent).not.toContain("Ordenada por");
  });

  test("cada persona tiene su orden, no el del último que miró", async () => {
    const deUno = await mount({ userId: "u-1" });
    await press(headerButton(deUno, "Stock"));

    await leave();
    const deOtra = await mount({ userId: "u-2" });
    expect(sortOf(deOtra, "Stock")).toBe("none");
    await press(headerButton(deOtra, "Código"));
    await press(headerButton(deOtra, "Código"));

    await leave();
    const otraVezUno = await mount({ userId: "u-1" });
    expect(sortOf(otraVezUno, "Stock")).toBe("ascending");
    expect(sortOf(otraVezUno, "Código")).toBe("none");
  });

  test("el orden de una tabla no se cuela en otra", async () => {
    const repuestos = await mount({ table: "inventory" });
    await press(headerButton(repuestos, "Stock"));

    await leave();
    const equipos = await mount({ table: "equipment" });
    expect(sortOf(equipos, "Stock")).toBe("none");
    expect(equipos.textContent).not.toContain("Ordenada por");
  });

  test("lo elegido en el selector también vuelve la próxima vez", async () => {
    const primera = await mount();
    await chooseOption(primera, "Stock");
    expect(sortOf(primera, "Stock")).toBe("ascending");

    await leave();
    const segunda = await mount();
    expect(sortOf(segunda, "Stock")).toBe("ascending");
  });

  test("sin sesión que valga, se recuerda igual", async () => {
    const anonima = await mount({ userId: null });
    await press(headerButton(anonima, "Código"));

    await leave();
    const otraVez = await mount({ userId: null });
    expect(sortOf(otraVez, "Código")).toBe("ascending");
  });

  test("lo guardado que apunta a una columna de otra versión se descarta", async () => {
    // Como si la columna se hubiera renombrado desde la última visita.
    window.localStorage.setItem(
      "pulso:table-sort:inventory:u-1",
      JSON.stringify({ column: "price", direction: "asc" }),
    );
    const container = await mount();
    expect(sortOf(container, "Código")).toBe("none");
    expect(container.textContent).not.toContain("Ordenada por");
  });
});
