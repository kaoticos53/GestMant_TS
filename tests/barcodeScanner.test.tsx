// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { BarcodeScannerModal } from "../src/components/BarcodeScannerModal";

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("Componente de campo: BarcodeScannerModal", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = "";
  });

  test("se renderiza en el portal del documento cuando está abierto", async () => {
    const onScan = vi.fn();
    const onOpenChange = vi.fn();

    await act(async () => {
      root.render(
        <BarcodeScannerModal
          open={true}
          onOpenChange={onOpenChange}
          onScan={onScan}
          title="Escanear Equipo o Repuesto"
        />,
      );
    });
    await settle();

    expect(document.body.textContent).toContain("Escanear Equipo o Repuesto");
    const input = document.body.querySelector("#manual-scan-input") as HTMLInputElement;
    expect(input).not.toBeNull();
  });

  test("permite introducir un código manual y confirma con onScan", async () => {
    const onScan = vi.fn();
    const onOpenChange = vi.fn();

    await act(async () => {
      root.render(
        <BarcodeScannerModal
          open={true}
          onOpenChange={onOpenChange}
          onScan={onScan}
        />,
      );
    });
    await settle();

    const input = document.body.querySelector("#manual-scan-input") as HTMLInputElement;
    expect(input).not.toBeNull();

    // Simular escritura en el input
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      setValue?.call(input, "EQ-BOMBA-001");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await settle();

    // Enviar el formulario
    const form = input.closest("form") as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await settle();

    expect(onScan).toHaveBeenCalledWith("EQ-BOMBA-001");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
