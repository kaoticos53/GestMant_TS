// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { printLabelDocument } from "../src/lib/labelBrowser";

/**
 * La puerta a la impresora: abrir el documento y llamar a `print()`.
 *
 * Se prueba con una ventana de mentira —jsdom no imprime— para fijar las dos
 * cosas que importan: que un emergente bloqueado se note (devuelve `false` en
 * vez de fingir que la etiqueta ha salido) y que la impresión se pida cuando el
 * documento ha cargado, no antes.
 */

const openMock = vi.fn();

function fakeWindow(readyState: "complete" | "loading") {
  const listeners: (() => void)[] = [];
  return {
    closed: false,
    document: { readyState },
    focus: vi.fn(),
    print: vi.fn(),
    addEventListener: vi.fn((_event: string, listener: () => void) => {
      listeners.push(listener);
    }),
    /** Simula que el documento ha terminado de cargar. */
    load: () => listeners.forEach((listener) => listener()),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  openMock.mockReset();
});

describe("imprimir etiquetas", () => {
  test("abre el documento y pide la impresión al cargar", () => {
    const window = fakeWindow("loading");
    openMock.mockReturnValue(window);
    vi.stubGlobal("open", openMock);
    const createObjectURL = vi.fn(() => "blob:etiquetas");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });

    expect(printLabelDocument("<html>etiqueta</html>")).toBe(true);
    // Se abre en una ventana propia, con el documento del rollo.
    expect(openMock).toHaveBeenCalledWith(
      "blob:etiquetas",
      "_blank",
      expect.stringContaining("width"),
    );
    expect(window.print).not.toHaveBeenCalled();

    window.load();
    expect(window.focus).toHaveBeenCalled();
    expect(window.print).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:etiquetas");
  });

  test("si el navegador bloquea el emergente, se dice y no se imprime nada", () => {
    openMock.mockReturnValue(null);
    vi.stubGlobal("open", openMock);
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL: () => "blob:etiquetas",
      revokeObjectURL,
    });

    expect(printLabelDocument("<html></html>")).toBe(false);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:etiquetas");
  });

  test("un documento ya cargado se imprime sin esperar al evento", () => {
    const window = fakeWindow("complete");
    openMock.mockReturnValue(window);
    vi.stubGlobal("open", openMock);
    vi.stubGlobal("URL", {
      createObjectURL: () => "blob:etiquetas",
      revokeObjectURL: vi.fn(),
    });

    expect(printLabelDocument("<html></html>")).toBe(true);
    expect(window.print).toHaveBeenCalledTimes(1);
  });
});
