// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PwaUpdateBanner } from "@/components/PwaUpdateBanner";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
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
    // Sonner apila abajo a la derecha; el aviso de versión va abajo a la
    // izquierda en escritorio (en móvil ocupa el ancho y sonner sube sus
    // avisos con `mobileOffset`).
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
    expect(classes).toContain("bottom-3");
    expect(classes).not.toContain("sm:right-4");
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

/**
 * Lo que jsdom no trae y sonner da por hecho: mira el tamaño de la ventana y
 * sujeta el aviso con el puntero. Mismo doble que `noteToasts.test.tsx`.
 */
function installMissingDomApis() {
  if (typeof window.matchMedia !== "function") {
    window.matchMedia = (query: string) =>
      ({
        media: query,
        matches: false,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList;
  }
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
}

/** Lo que sonner tarda en purgar un aviso cerrado (`TIME_BEFORE_UNMOUNT`). */
const PURGE_DELAY = 250;

describe("Toaster con el aviso de versión abierto", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    installMissingDomApis();
    dismissUpdate();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    toast.dismiss();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, PURGE_DELAY));
      root.unmount();
    });
    container.remove();
  });

  const toasterStyle = () =>
    document
      .querySelector<HTMLElement>("[data-sonner-toaster]")
      ?.getAttribute("style") ?? "";

  it("sube los avisos en móvil: el aviso ocupa el ancho de abajo", async () => {
    // El aviso de versión va abajo en móvil; si sonner dejara sus toasts ahí,
    // taparían el «Recargar». Mientras el aviso está visible, suben.
    await act(async () => {
      root.render(<Toaster />);
      toast("Guardado");
      await settle();
    });
    expect(toasterStyle()).not.toContain("--mobile-offset-bottom: 92px");

    await act(async () => {
      offerUpdate(vi.fn());
      await settle();
    });

    expect(toasterStyle()).toContain("--mobile-offset-bottom: 92px");
  });
});
