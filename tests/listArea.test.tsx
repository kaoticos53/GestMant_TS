// @vitest-environment jsdom
import { settle } from "./settle";
import { act, useState, type RefObject } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { ListArea } from "@/components/ListArea";

/**
 * El área de una lista larga: el alto acotado a la ventana, la caja que deja
 * medir y el regreso arriba al cambiar de tanda. Se monta a mano con React y
 * jsdom, como el resto de pruebas de componente del taller.
 *
 * El alto lo hace el CSS —lo acota `max-h-[calc(100dvh-18rem)]`, que jsdom no
 * calcula—, así que de eso se comprueba que las clases estén puestas; lo que sí
 * se puede comprobar de verdad es el desplazamiento: que al cambiar de tanda se
 * vuelve arriba y que, mientras la tanda no cambie, el desplazamiento de quien
 * mira se respeta —también cuando la lista se vuelve a pintar por cualquier otro
 * motivo (los datos que llegan, alguien que ordena)—. Y que la caja se deja
 * medir: sin su referencia, `useRowsThatFit` no tendría de dónde sacar cuántas
 * filas caben.
 */

let roots: Root[] = [];

/**
 * El área montada, con un botón por el que la prueba mueve lo que se está
 * mirando: la página de una tabla (un número) o lo que se busca y cómo se ordena
 * en una cola de fichas (una clave de texto).
 */
async function mountArea(
  initial: number | string,
  moved: number | string = initial,
  /** La referencia de fuera: la que usaría `useRowsThatFit` para medir. */
  outsideRef?: RefObject<HTMLDivElement | null>,
) {
  function Harness() {
    const [tanda, setTanda] = useState<number | string>(initial);
    return (
      <>
        <button type="button" onClick={() => setTanda(moved)}>
          Siguiente
        </button>
        <ListArea ref={outsideRef} resetKey={tanda}>
          <table>
            <tbody>
              <tr>
                <td>Fila</td>
              </tr>
            </tbody>
          </table>
        </ListArea>
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
  return {
    container,
    next: () => container.querySelector("button")!,
    // Volver a pintar por cualquier otro motivo: los datos que llegan o alguien
    // que ordena. La tanda que se está mirando no ha cambiado.
    repaint: async () => {
      await act(async () => {
        root.render(<Harness />);
      });
      await settle();
    },
  };
}

/** El área: el div que envuelve a la lista. */
function areaOf(container: Element): HTMLDivElement {
  const area = container.querySelector("table")?.parentElement;
  if (!area) throw new Error("No hay área de lista.");
  return area as HTMLDivElement;
}

async function press(button: HTMLButtonElement) {
  await act(async () => {
    button.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }),
    );
  });
  await settle();
}

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(async () => {
  await act(async () => {
    for (const root of roots) root.unmount();
  });
  roots = [];
  document.body.innerHTML = "";
});

describe("el área de la lista", () => {
  test("acota el alto a la ventana y desplaza lo que no cabe", async () => {
    const { container } = await mountArea(1);
    const classes = areaOf(container).className;

    // El alto sale de la ventana menos el marco de la ficha, y nunca baja del
    // mínimo legible; lo que no cabe se desplaza dentro. En la medida, los
    // signos van con guiones bajos: así es como Tailwind escribe los espacios
    // que `calc()` necesita para entender la resta.
    expect(classes).toContain("max-h-[calc(100dvh_-_18rem)]");
    expect(classes).toContain("min-h-[12rem]");
    expect(classes).toContain("overflow-auto");
    // El único que desplaza es el área: al contenedor que trae la tabla de la
    // biblioteca se le quita el suyo, que si no se queda con la cabecera pegada.
    expect(classes).toContain("[&>div]:overflow-visible");
  });

  test("deja su caja a quien tenga que medirla", async () => {
    // El enganche que cuenta las filas que caben mira por esta referencia: si el
    // área no la rellenara, no habría alto del que contar nada.
    const outside = { current: null as HTMLDivElement | null };
    const { container } = await mountArea(1, 1, outside);

    expect(outside.current).toBeTruthy();
    expect(outside.current).toBe(areaOf(container));
  });

  test("al cambiar de página vuelve arriba", async () => {
    const { container, next } = await mountArea(1, 2);
    const area = areaOf(container);

    // Quien mira se ha desplazado hasta el final de la página.
    area.scrollTop = 320;
    await press(next());

    expect(area.scrollTop).toBe(0);
  });

  test("al cambiar lo que se busca o cómo se ordena vuelve arriba", async () => {
    const { container, next } = await mountArea(
      "averías|recientes",
      "averías|antiguas",
    );
    const area = areaOf(container);

    area.scrollTop = 640;
    await press(next());

    expect(area.scrollTop).toBe(0);
  });

  test("sin cambiar de tanda no se toca el desplazamiento de quien mira", async () => {
    const { container, repaint } = await mountArea(1);
    const area = areaOf(container);

    area.scrollTop = 320;
    // Una vuelta a pintar cualquiera —los datos que llegan, alguien que
    // ordena— no puede devolver a nadie al principio de la lista.
    await repaint();

    expect(area.scrollTop).toBe(320);
  });
});
