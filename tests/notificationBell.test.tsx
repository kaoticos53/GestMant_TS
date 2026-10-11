// @vitest-environment jsdom
// mocking de convex/react *antes* de que el componente lo importe
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("convex/react", () => ({
  useQuery: () => undefined,
  useMutation: () => async () => {},
}));

import {
  NotificationBell,
  type NotificationRow,
} from "@/components/NotificationBell";
import { formatRelativeTime } from "@/lib/workshop";

/**
 * La campana de avisos del taller. Dos cosas se comprueban por su cuenta:
 *
 *  1. **Al elegir un aviso se va a verlo.** El `onOpen` de la campana recibe el
 *     aviso elegido —con su `incidentId` si lo lleva—, así que quien monta la
 *     campana decide abrir la ficha de esa incidencia en vez de solo su cola.
 *     El salto en sí lo hace el Dashboard (con una incidencia real de verdad);
 *     aquí se comprueba que el aviso llega entero y que se marca como leído.
 *  2. **El desplegable cabe en pantallas estrechas.** Va anclado a la ventana
 *     (posición `fixed`), de manera que quien lo rodea —un panel lateral que
 *     recorta con `overflow-hidden`, una cabecera pegajosa— no puede ocultarlo:
 *     su rectángulo sale de medir el botón, no de su contenedor.
 *
 * Se monta a mano con React y jsdom, como el resto de pruebas de componente;
 * los avisos y su lectura/escritura se le dan hechos porque lo que importa aquí
 * es lo que queda en pantalla, no cómo conversa con el backend.
 */

let roots: Root[] = [];

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  document.body.innerHTML = "";
  roots = [];
});

afterEach(async () => {
  await act(async () => {
    for (const root of roots) root.unmount();
  });
  roots = [];
  document.body.innerHTML = "";
});

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/** Pinta lo que se le pase y devuelve el contenedor. */
async function mount(node: ReactNode): Promise<HTMLElement> {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(<>{node}</>);
  });
  await settle();
  return container;
}

/** El aviso que llega a `onOpen`; se lee desde fuera del componente. */
type Opened = { incidentId: string | null };
async function bellWith(notifications: NotificationRow[]) {
  const opened: Opened[] = [];
  const markRead = vi.fn(async () => {});

  const container = await mount(
    <NotificationBell
      notifications={notifications}
      onOpen={(notification) => {
        opened.push({ incidentId: notification.incidentId ?? null });
      }}
      markRead={markRead}
    />,
  );
  return { container, opened, markRead };
}

/** Abre el desplegable pulsando la campana. */
async function openBell(container: HTMLElement) {
  const button = container.querySelector<HTMLButtonElement>("button");
  expect(button, "no hay campana que pulsar").not.toBeNull();
  await act(async () => {
    button!.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }),
    );
  });
  await settle();
}

const UNREAD = "2026-10-11T09:00:00.000Z";

describe("NotificationBell", () => {
  test("elaviso que lleva incidentId llega a onOpen para abrir su ficha", async () => {
    const { container, opened, markRead } = await bellWith([
      {
        _id: "n1" as NotificationRow["_id"],
        text: "Nueva incidencia INC-0001",
        read: false,
        incidentId: "inc-1" as NotificationRow["incidentId"],
        createdAt: Date.parse(UNREAD),
      },
    ]);

    await openBell(container);

    // La fila del desplegable se puede pulsar y lleva el texto del aviso.
    const row = [...container.querySelectorAll("button")].find((candidate) =>
      candidate.textContent?.includes("Nueva incidencia INC-0001"),
    );
    expect(row, "el aviso no está en el desplegable").not.toBeUndefined();
    await act(async () => {
      row!.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }),
      );
    });
    await settle();

    // El salto lleva la ficha: quien monta la campana abre esa incidencia.
    expect(opened).toEqual([{ incidentId: "inc-1" }]);
    // Y se marca como leída, que era el comportamiento que ya había.
    expect(markRead).toHaveBeenCalledWith({ id: "n1" });
  });

  test("elaviso sin incidentId abre lo de siempre (sin ficha que abrir)", async () => {
    const { container, opened } = await bellWith([
      {
        _id: "n2" as NotificationRow["_id"],
        text: "La limpieza del almacén terminó",
        read: false,
        incidentId: undefined,
        createdAt: Date.parse(UNREAD),
      },
    ]);

    await openBell(container);
    const row = [...container.querySelectorAll("button")].find((candidate) =>
      candidate.textContent?.includes("limpieza del almacén"),
    );
    await act(async () => {
      row!.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }),
      );
    });
    await settle();

    expect(opened).toEqual([{ incidentId: null }]);
  });

  test("el desplegable se ancla a la ventana y cabe incluso en un panel estrecho", async () => {
    // Un contenedor que recorta (como el <aside> del menú con overflow-hidden)
    // y la campana a la derecha: la posición antigua (absolute, dentro) lo
    // habría cortado por la izquierda.
    const container = await mount(
      <div
        style={{ width: 180, height: 60, overflow: "hidden", padding: 8 }}
        data-testid="panel-estrecho"
      >
        <NotificationBell
          notifications={[]}
          markRead={vi.fn(async () => async () => {}) as never}
        />
      </div>,
    );

    jsdomViewport(480, 320);
    await openBell(container);

    const panel = container.querySelector('[role="dialog"]');
    expect(panel, "el desplegable no se abrió").not.toBeNull();
    const style = panel!.getAttribute("style") ?? "";
    expect(style).toContain("position: fixed");
    // En una ventana de 480 px hay sitio para él entero: ancho acotado a lo
    // que la ventana ofrece, y ninguna posición negativa que lo saque fuera.
    expect(style).toContain("width");
    const width = Number(/width: (\d+(?:\.\d+)?)px/.exec(style)?.[1] ?? "0");
    expect(width).toBeGreaterThan(0);
    expect(width).toBeLessThanOrEqual(480 - 16);
  });

  test("el desplegable se encoge si la ventana tampoco da para el ancho pedido", async () => {
    const container = await mount(
      <NotificationBell
        notifications={[]}
        markRead={vi.fn(async () => async () => {}) as never}
      />,
    );

    jsdomViewport(300, 320);
    await openBell(container);

    const style = container
      .querySelector('[role="dialog"]')
      ?.getAttribute("style");
    const width = Number(
      /width: (\d+(?:\.\d+)?)px/.exec(style ?? "")?.[1] ?? "0",
    );
    expect(width).toBe(284); // 300 − 16 de margen, el mínimo razonable en móvil.
  });

  test("Escape y clic fuera cierran el desplegable", async () => {
    const container = await mount(
      <NotificationBell
        notifications={[]}
        markRead={vi.fn(async () => {}) as never}
      />,
    );

    await openBell(container);
    expect(
      container.querySelector('[role="dialog"]'),
      "debería estar abierto tras pulsar la campana",
    ).not.toBeNull();

    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    await settle();
    expect(container.querySelector('[role="dialog"]')).toBeNull();

    await openBell(container);
    await act(async () => {
      document.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
      );
    });
    await settle();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  test("formatRelativeTime es el formato de siempre (ancla de la fila)", () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 30 * 60_000)).toBe("hace 30 min");
    expect(now).toBeGreaterThan(0);
  });
});

/**
 * jsdom no lleva viewport real; se le dice cuánto mide la ventana con las
 * propiedades que el componente lee para anclar y acotar el desplegable.
 */
function jsdomViewport(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", {
    value: width,
    configurable: true,
  });
  Object.defineProperty(window, "innerHeight", {
    value: height,
    configurable: true,
  });
}
