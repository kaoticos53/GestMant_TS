// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { STATE } = vi.hoisted(() => ({
  STATE: { theme: "system" as string | undefined, setTheme: vi.fn() },
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: STATE.theme,
    setTheme: (next: string) => {
      STATE.setTheme(next);
      STATE.theme = next;
    },
  }),
}));

import { ThemeToggle } from "@/components/ThemeToggle";

describe("ThemeToggle", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    STATE.theme = "system";
    STATE.setTheme = vi.fn();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const renderToggle = () => {
    act(() => {
      root.render(<ThemeToggle />);
    });
  };

  it("muestra Claro, Oscuro y Sistema con aria-pressed y llama a setTheme", () => {
    renderToggle();

    const lightBtn = container.querySelector(
      'button[aria-label="Tema claro"]',
    ) as HTMLButtonElement;
    const darkBtn = container.querySelector(
      'button[aria-label="Tema oscuro"]',
    ) as HTMLButtonElement;
    const systemBtn = container.querySelector(
      'button[aria-label="Tema del sistema"]',
    ) as HTMLButtonElement;

    expect(systemBtn.getAttribute("aria-pressed")).toBe("true");
    expect(lightBtn.getAttribute("aria-pressed")).toBe("false");
    expect(darkBtn.getAttribute("aria-pressed")).toBe("false");

    act(() => {
      darkBtn.click();
    });
    expect(STATE.setTheme).toHaveBeenCalledWith("dark");
    renderToggle();
    expect(darkBtn.getAttribute("aria-pressed")).toBe("true");
    expect(systemBtn.getAttribute("aria-pressed")).toBe("false");

    act(() => {
      lightBtn.click();
    });
    expect(STATE.setTheme).toHaveBeenCalledWith("light");
    renderToggle();
    expect(lightBtn.getAttribute("aria-pressed")).toBe("true");

    act(() => {
      systemBtn.click();
    });
    expect(STATE.setTheme).toHaveBeenCalledWith("system");
    renderToggle();
    expect(systemBtn.getAttribute("aria-pressed")).toBe("true");
  });
});
