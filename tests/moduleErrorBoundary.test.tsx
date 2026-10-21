// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ModuleErrorBoundary } from "../src/components/ModuleErrorBoundary";

// Configuramos flag para react act
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let roots: Root[] = [];
let container: HTMLDivElement | null = null;

function renderComponent(ui: React.ReactElement) {
  container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  act(() => {
    root.render(ui);
  });
  return container;
}

function ProblematicChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("Fallo simulado al procesar el expediente");
  }
  return <div data-testid="ok-content">Contenido del módulo cargado correctamente</div>;
}

describe("ModuleErrorBoundary — aislamiento de excepciones en vistas de taller", () => {
  beforeEach(() => {
    // Silenciamos console.error intencionado de React y del ErrorBoundary
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    for (const root of roots) {
      act(() => root.unmount());
    }
    roots = [];
    if (container) {
      container.remove();
      container = null;
    }
    vi.restoreAllMocks();
  });

  test("renderiza los hijos con normalidad cuando no hay errores", () => {
    const el = renderComponent(
      <ModuleErrorBoundary moduleName="Incidencias">
        <ProblematicChild shouldThrow={false} />
      </ModuleErrorBoundary>,
    );

    expect(el.textContent).toContain("Contenido del módulo cargado correctamente");
    expect(el.querySelector('[role="alert"]')).toBeNull();
  });

  test("captura la excepción y muestra la tarjeta de error con el nombre del módulo", () => {
    const el = renderComponent(
      <ModuleErrorBoundary moduleName="Compras">
        <ProblematicChild shouldThrow={true} />
      </ModuleErrorBoundary>,
    );

    const alert = el.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(el.textContent).toContain("Error al cargar Compras");
    expect(el.textContent).toContain("Fallo simulado al procesar el expediente");
    expect(el.textContent).toContain("Reintentar");
  });

  test("permite reintentar e invoca el callback onReset", () => {
    const onReset = vi.fn();
    const el = renderComponent(
      <ModuleErrorBoundary moduleName="Equipos" onReset={onReset}>
        <ProblematicChild shouldThrow={true} />
      </ModuleErrorBoundary>,
    );

    const retryBtn = el.querySelector("button");
    expect(retryBtn).not.toBeNull();
    expect(retryBtn?.textContent).toContain("Reintentar");

    act(() => {
      retryBtn?.click();
    });

    expect(onReset).toHaveBeenCalledTimes(1);
  });

  test("muestra un fallback personalizado si se proporciona", () => {
    const customFallback = <div data-testid="custom-error">Fallback personalizado para el taller</div>;
    const el = renderComponent(
      <ModuleErrorBoundary moduleName="Inventario" fallback={customFallback}>
        <ProblematicChild shouldThrow={true} />
      </ModuleErrorBoundary>,
    );

    expect(el.textContent).toContain("Fallback personalizado para el taller");
    expect(el.querySelector('[role="alert"]')).toBeNull();
  });
});
