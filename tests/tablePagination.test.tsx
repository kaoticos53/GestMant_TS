// @vitest-environment jsdom
import { settle } from "./settle";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { TablePagination } from "@/components/TablePagination";
import { useTablePagination } from "@/hooks/use-table-pagination";

/**
 * El pie de una tabla paginada, montado de verdad con el mismo enganche que usan
 * las vistas: los botones, el recuento y lo que se ve de la lista.
 *
 * Cuántas filas se ven de una vez ya no se elige: lo dice el alto del área, que
 * aquí es el número que se pasa —`rowsFit`—. Así que lo que se comprueba es lo
 * que la pantalla no puede decidir sola: que moverse lleve donde toca, que un
 * cambio de alto no aparte lo que se estaba mirando, que afinar el filtro vuelva
 * a la primera página y que la tabla no se quede en blanco si la lista encoge.
 * Cómo se mide el alto de verdad —del navegador, con sus píxeles— se prueba en
 * `rowsThatFit.test.tsx`.
 *
 * La lista de mentira tiene 23 filas a propósito: con páginas de 10 son tres
 * páginas y la última queda a medias, que es donde una paginación se rompe.
 */

/** Las filas de la tabla de mentira, como las leería una persona. */
const LISTA = Array.from({ length: 23 }, (_, index) => `Repuesto ${index + 1}`);

interface HarnessProps {
  /** Lo que filtra la vista: al cambiar, se vuelve a la primera página. */
  resetKey?: string;
  /** Cuántas filas tiene «la lista»: bajarlo es como si el filtro recortara. */
  take?: number;
  /** Cuántas filas caben en el área: lo que mide `useRowsThatFit`. */
  rowsFit?: number;
  singular?: string;
  plural?: string;
}

/** Montar la tabla: el mismo enganche y el mismo pie que una vista. */
function Harness({
  resetKey = "",
  take = LISTA.length,
  rowsFit = 10,
  singular = "repuesto",
  plural = "repuestos",
}: HarnessProps) {
  const rows = LISTA.slice(0, take);
  const paging = useTablePagination({
    total: rows.length,
    rowsFit,
    resetKey,
  });
  const visible = rows.slice(paging.from - 1, paging.to);
  return (
    <>
      <ul>
        {visible.map((row) => (
          <li key={row}>{row}</li>
        ))}
      </ul>
      <TablePagination paging={paging} singular={singular} plural={plural} />
    </>
  );
}

interface Handle {
  container: HTMLDivElement;
  /** Volver a pintar con otros datos: es «cambiar el filtro» sin desmontar. */
  update: (props: HarnessProps) => Promise<void>;
}

let roots: Root[] = [];

async function mountTable(props: HarnessProps = {}): Promise<Handle> {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  const handle: Handle = {
    container,
    update: async (next) => {
      await act(async () => {
        root.render(<Harness {...next} />);
      });
      await settle();
    },
  };
  await handle.update(props);
  return handle;
}

/** Cerrar la vista (cambiar de módulo, recargar): lo que se lleva el estado. */
async function leave() {
  await act(async () => {
    for (const root of roots) root.unmount();
  });
  roots = [];
  document.body.innerHTML = "";
}

function button(container: Element, label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll("button")].find(
    (node) => node.getAttribute("aria-label") === label,
  );
  if (!found) throw new Error(`No hay botón «${label}».`);
  return found as HTMLButtonElement;
}

async function press(node: HTMLButtonElement) {
  await act(async () => {
    node.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }),
    );
  });
  await settle();
}

/** Las filas que se están viendo, en orden. */
function visibleRows(container: Element): string[] {
  return [...container.querySelectorAll("li")].map(
    (node) => node.textContent ?? "",
  );
}

/** ¿Se ve esa fila, la que se estaba mirando? */
function shows(container: Element, row: string): boolean {
  return visibleRows(container).includes(row);
}

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  window.localStorage.clear();
});

afterEach(async () => {
  await leave();
  window.localStorage.clear();
});

describe("el pie de la tabla paginada", () => {
  test("enseña las filas que caben y dice por dónde va", async () => {
    const { container } = await mountTable({ rowsFit: 10 });

    expect(visibleRows(container)).toEqual(LISTA.slice(0, 10));
    expect(container.textContent).toContain("Mostrando 1 a 10 de 23 repuestos");
    expect(container.textContent).toContain("Página 1 de 3");

    // En la primera página no se puede ir hacia atrás, y sí hacia delante.
    expect(button(container, "Primera página").disabled).toBe(true);
    expect(button(container, "Página anterior").disabled).toBe(true);
    expect(button(container, "Página siguiente").disabled).toBe(false);
    expect(button(container, "Última página").disabled).toBe(false);
  });

  test("con un área más alta caben más filas, y no hay página de más", async () => {
    const { container } = await mountTable({ rowsFit: 25 });

    // Las 23 entran de una vez: ni botones ni contador de página.
    expect(visibleRows(container)).toEqual(LISTA);
    expect(container.textContent).toContain("Mostrando 1 a 23 de 23 repuestos");
    expect(container.querySelector("nav")).toBeNull();
    expect(container.textContent).not.toContain("Página 1 de 1");
  });

  test("el pie ya no ofrece elegir cuántas filas se ven", async () => {
    const { container } = await mountTable({ rowsFit: 10 });

    // Sin selector: el tamaño lo pone el alto de la pantalla, no quien mira.
    expect(container.querySelector('[role="combobox"]')).toBeNull();
    expect(container.textContent).not.toContain("por página");
  });

  test("los botones llevan a la última página y de vuelta a la primera", async () => {
    const { container } = await mountTable({ rowsFit: 10 });

    await press(button(container, "Última página"));
    // La última página queda a medias: solo tres filas.
    expect(visibleRows(container)).toEqual(LISTA.slice(20));
    expect(container.textContent).toContain(
      "Mostrando 21 a 23 de 23 repuestos",
    );
    expect(container.textContent).toContain("Página 3 de 3");
    expect(button(container, "Página siguiente").disabled).toBe(true);
    expect(button(container, "Última página").disabled).toBe(true);

    await press(button(container, "Página anterior"));
    expect(visibleRows(container)).toEqual(LISTA.slice(10, 20));
    expect(container.textContent).toContain("Página 2 de 3");

    await press(button(container, "Primera página"));
    expect(visibleRows(container)).toEqual(LISTA.slice(0, 10));
    expect(container.textContent).toContain("Página 1 de 3");
  });

  test("afinar el filtro devuelve a la primera página", async () => {
    const { container, update } = await mountTable({ rowsFit: 10 });
    await press(button(container, "Última página"));
    expect(visibleRows(container)).toEqual(LISTA.slice(20));

    // El filtro cambia la firma: la página guardada ya no vale.
    await update({ resetKey: "bomba", take: 5 });
    expect(visibleRows(container)).toEqual(LISTA.slice(0, 5));
    expect(container.textContent).toContain("Mostrando 1 a 5 de 5 repuestos");
    expect(container.querySelector("nav")).toBeNull();
  });

  test("la página se corrige sola si la lista encoge mientras se mira", async () => {
    const { container, update } = await mountTable({ rowsFit: 10 });
    await press(button(container, "Última página"));
    expect(container.textContent).toContain("Página 3 de 3");

    // Otra persona borró repuestos: la página 3 ya no existe.
    await update({ take: 12 });
    expect(container.textContent).toContain("Página 2 de 2");
    expect(visibleRows(container)).toEqual(LISTA.slice(10, 12));
  });

  test("cambiar el alto no aparta la fila que se estaba mirando", async () => {
    const { container, update } = await mountTable({ rowsFit: 10 });
    await press(button(container, "Última página"));
    expect(visibleRows(container)).toEqual(LISTA.slice(20));

    // La ventana crece: caben quince. La página es otra —la 2—, pero el repuesto
    // 21, que es el que se estaba leyendo, sigue a la vista.
    await update({ rowsFit: 15 });
    expect(visibleRows(container)).toEqual(LISTA.slice(15, 23));
    expect(shows(container, "Repuesto 21")).toBe(true);
    expect(container.textContent).toContain("Página 2 de 2");

    // Y si encoge a cinco, la página se recoloca otra vez sin perderlo.
    await update({ rowsFit: 5 });
    expect(shows(container, "Repuesto 21")).toBe(true);
  });

  test("una lista con sitio para todas no se parte en páginas", async () => {
    const { container } = await mountTable({ take: 4, rowsFit: 10 });

    expect(visibleRows(container)).toEqual(LISTA.slice(0, 4));
    expect(container.textContent).toContain("Mostrando 1 a 4 de 4 repuestos");
    // No hay a dónde ir: ni contador de página ni botones.
    expect(container.querySelector("nav")).toBeNull();
    expect(container.textContent).not.toContain("Página 1 de 1");
  });

  test("las filas que se ven no se recuerdan: las pone la pantalla", async () => {
    const primera = await mountTable({ rowsFit: 10 });
    await press(button(primera.container, "Página siguiente"));
    expect(visibleRows(primera.container)).toEqual(LISTA.slice(10, 20));

    // Nada de esto depende de lo que se eligiera antes: aquí no se elige nada.
    expect(window.localStorage.length).toBe(0);

    await leave();
    // Otra pantalla, más alta: caben veinticinco y se ven las veinticinco.
    const segunda = await mountTable({ rowsFit: 25 });
    expect(visibleRows(segunda.container)).toEqual(LISTA);
  });
});
