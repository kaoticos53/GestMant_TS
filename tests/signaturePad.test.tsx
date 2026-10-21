// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SignaturePad } from "../src/components/SignaturePad";

describe("Componente de campo: SignaturePad", () => {
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

  test("renderiza el panel de firma y los controles iniciales", async () => {
    await act(async () => {
      root.render(
        <SignaturePad
          title="Firma del Operario"
          description="Valide la recepción técnica"
        />,
      );
    });

    expect(container.textContent).toContain("Firma del Operario");
    expect(container.textContent).toContain("Valide la recepción técnica");
    expect(container.querySelector("canvas")).not.toBeNull();

    // El botón limpiar debe empezar deshabilitado al estar vacío
    const clearBtn = container.querySelector("button") as HTMLButtonElement;
    expect(clearBtn?.disabled).toBe(true);
  });

  test("el botón de confirmar firma aparece cuando se pasa callback onSave", async () => {
    const onSave = vi.fn();

    await act(async () => {
      root.render(
        <SignaturePad
          onSave={onSave}
          title="Conformidad"
        />,
      );
    });

    const confirmBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Confirmar firma"),
    );
    expect(confirmBtn).toBeDefined();
    expect(confirmBtn?.disabled).toBe(true);
  });
});
