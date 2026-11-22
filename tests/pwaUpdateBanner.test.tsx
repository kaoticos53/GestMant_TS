// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PwaUpdateBanner } from "@/components/PwaUpdateBanner";
import {
  dismissUpdate,
  isUpdateReady,
  offerUpdate,
} from "@/lib/pwaUpdate";
import { BUILD_NUMBER } from "@/version";
import { settle } from "./settle";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe("PwaUpdateBanner", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    dismissUpdate();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("no dice nada mientras la compilación servida es la última", async () => {
    await act(async () => {
      root.render(<PwaUpdateBanner />);
      await settle();
    });

    expect(container.textContent).toBe("");
  });

  it("avisa con el build de la pestaña cuando el service worker tiene otro", async () => {
    await act(async () => {
      root.render(<PwaUpdateBanner />);
      await settle();
    });

    await act(async () => {
      offerUpdate(vi.fn());
      await settle();
    });

    const text = container.textContent ?? "";
    expect(text).toContain("Hay una versión nueva");
    expect(text).toContain(`Esta pestaña sirve la b${BUILD_NUMBER}`);
  });

  it("no comparte esquina con los avisos de sonner", async () => {
    // Sonner apila abajo a la derecha; el aviso de versión va arriba a la
    // izquierda, donde no puede quedar debajo de un toast.
    await act(async () => {
      root.render(<PwaUpdateBanner />);
      await settle();
    });
    await act(async () => {
      offerUpdate(vi.fn());
      await settle();
    });

    const banner = container.querySelector('[role="status"]');
    expect(banner).not.toBeNull();
    const classes = banner?.getAttribute("class") ?? "";
    expect(classes).toContain("sm:left-4");
    expect(classes).not.toContain("sm:right-4");
    expect(classes).not.toContain("bottom-3");
  });

  it("no recarga sola: solo cuando se pulsa «Recargar»", async () => {
    const apply = vi.fn();
    await act(async () => {
      root.render(<PwaUpdateBanner />);
      await settle();
    });
    await act(async () => {
      offerUpdate(apply);
      await settle();
    });

    expect(apply).not.toHaveBeenCalled();

    const reload = Array.from(container.querySelectorAll("button")).find(
      (candidate) => candidate.textContent?.trim() === "Recargar",
    );
    expect(reload).not.toBeNull();
    await act(async () => {
      reload?.click();
      await settle();
    });

    expect(apply).toHaveBeenCalledTimes(1);
  });

  it("«Luego» retira el aviso y deja la compilación para la próxima apertura", async () => {
    await act(async () => {
      root.render(<PwaUpdateBanner />);
      await settle();
    });
    await act(async () => {
      offerUpdate(vi.fn());
      await settle();
    });

    const later = Array.from(container.querySelectorAll("button")).find(
      (candidate) => candidate.textContent?.trim() === "Luego",
    );
    expect(later).not.toBeNull();
    await act(async () => {
      later?.click();
      await settle();
    });

    expect(container.textContent).toBe("");
    expect(isUpdateReady()).toBe(false);
  });
});
