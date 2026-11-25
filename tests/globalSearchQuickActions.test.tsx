// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const { STATE } = vi.hoisted(() => ({
  STATE: { queryResult: undefined as unknown },
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    search: { global: { name: "search.global" } },
  },
}));

vi.mock("convex/react", () => ({
  useQuery: (_query: unknown, args?: unknown) => {
    if (args === "skip") return undefined;
    return STATE.queryResult;
  },
}));

import { GlobalSearch, type QuickAction } from "@/pages/dashboard/GlobalSearch";

describe("GlobalSearch acciones rápidas", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    vi.useFakeTimers();
    STATE.queryResult = undefined;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    vi.useRealTimers();
    container.remove();
  });

  const typeQuery = (value: string) => {
    const input = container.querySelector("input") as HTMLInputElement;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
  };

  it("muestra acciones rápidas al enfocar vacío, las filtra y las ejecuta con Enter", () => {
    const onReport = vi.fn();
    const onPurchasing = vi.fn();
    const actions: QuickAction[] = [
      {
        id: "report",
        label: "Notificar incidencia",
        subtitle: "Abrir formulario público",
        keywords: ["nueva", "averia"],
        onRun: onReport,
      },
      {
        id: "purchasing",
        label: "Ir a Compras",
        subtitle: "Abrir órdenes de compra",
        keywords: ["pedidos"],
        shortcut: "g c",
        onRun: onPurchasing,
      },
    ];

    act(() => {
      root.render(
        <GlobalSearch onSelect={vi.fn()} quickActions={actions} />,
      );
    });

    const input = container.querySelector("input") as HTMLInputElement;
    act(() => {
      input.focus();
    });

    expect(container.textContent).toContain("Acciones rápidas");
    expect(container.textContent).toContain("Notificar incidencia");
    expect(container.textContent).toContain("Ir a Compras");

    typeQuery("pedidos");
    expect(container.textContent).toContain("Ir a Compras");
    expect(container.textContent).not.toContain("Notificar incidencia");

    act(() => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
    });

    expect(onPurchasing).toHaveBeenCalledTimes(1);
    expect(onReport).not.toHaveBeenCalled();
  });

  it("mantiene las fichas encontradas por delante de las acciones rápidas al pulsar Enter", () => {
    const onSelect = vi.fn();
    const onAction = vi.fn();
    STATE.queryResult = {
      incidents: [
        {
          kind: "incident",
          id: "inc-1",
          title: "INC-0004 · Cámara HDC-3500",
          subtitle: "Plató 1",
          archived: false,
        },
      ],
      requests: [],
      archived: [],
      parts: [],
      equipment: [],
    };

    const actions: QuickAction[] = [
      {
        id: "go-incidents",
        label: "Ir a Incidencias",
        subtitle: "Abrir cola",
        keywords: ["INC-0004"],
        onRun: onAction,
      },
    ];

    act(() => {
      root.render(
        <GlobalSearch onSelect={onSelect} quickActions={actions} />,
      );
    });

    typeQuery("INC-0004");
    const input = container.querySelector("input") as HTMLInputElement;
    act(() => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
    });

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]?.[0]).toMatchObject({
      kind: "incident",
      id: "inc-1",
    });
    expect(onAction).not.toHaveBeenCalled();
  });
});
