// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { DataTableToolbar } from "@/components/DataTableToolbar";
import { settle } from "./settle";

let roots: Root[] = [];

beforeEach(() => {
  (
    globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(async () => {
  await act(async () => {
    for (const root of roots) root.unmount();
  });
  roots = [];
  document.body.innerHTML = "";
});

async function mount(element: React.ReactElement) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(element);
  });
  await settle();
  return {
    container,
    rerender: async (next: React.ReactElement) => {
      await act(async () => {
        root.render(next);
      });
      await settle();
    },
  };
}

function typeText(input: HTMLInputElement, value: string) {
  act(() => {
    const setValue = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    setValue?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

describe("DataTableToolbar", () => {
  test("renderiza el campo de búsqueda con su placeholder y emite cambios inmediatos", async () => {
    const handleSearch = vi.fn();
    const { container } = await mount(
      <DataTableToolbar
        search=""
        onSearchChange={handleSearch}
        searchPlaceholder="Buscar repuesto..."
        searchAriaLabel="Buscar repuesto"
      />,
    );

    const input = container.querySelector("input");
    expect(input).not.toBeNull();
    expect(input?.placeholder).toBe("Buscar repuesto...");
    expect(input?.getAttribute("aria-label")).toBe("Buscar repuesto");

    typeText(input!, "filtro");
    expect(handleSearch).toHaveBeenCalledWith("filtro");
  });

  test("el botón de limpiar 'X' solo aparece cuando hay texto y al pulsarlo vacía la búsqueda", async () => {
    function Controlled() {
      const [search, setSearch] = useState("");
      return (
        <DataTableToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Buscar..."
        />
      );
    }

    const { container } = await mount(<Controlled />);

    // Inicialmente no hay botón X
    expect(container.querySelector('button[aria-label="Limpiar búsqueda"]')).toBeNull();

    // Escribimos algo
    const input = container.querySelector("input")!;
    typeText(input, "tornillo");
    await settle();

    const clearButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Limpiar búsqueda"]',
    );
    expect(clearButton).not.toBeNull();

    // Hacemos click en limpiar
    await act(async () => {
      clearButton!.click();
    });
    await settle();

    expect(input.value).toBe("");
    expect(container.querySelector('button[aria-label="Limpiar búsqueda"]')).toBeNull();
  });

  test("aplica debounce al escribir si debounceMs > 0", async () => {
    const handleSearch = vi.fn();
    const { container } = await mount(
      <DataTableToolbar
        search=""
        onSearchChange={handleSearch}
        debounceMs={50}
      />,
    );

    const input = container.querySelector("input")!;
    typeText(input, "aceite");

    // Inmediatamente no se llama
    expect(handleSearch).not.toHaveBeenCalled();

    // Esperamos 70ms para que se ejecute el debounce
    await new Promise((r) => setTimeout(r, 70));
    await settle();

    expect(handleSearch).toHaveBeenCalledWith("aceite");
  });

  test("enseña el botón de reset cuando hasActiveFilters es true y ejecuta onResetFilters al pulsar", async () => {
    const handleReset = vi.fn();
    const { container } = await mount(
      <DataTableToolbar
        search="test"
        onSearchChange={() => {}}
        hasActiveFilters={true}
        onResetFilters={handleReset}
        resetFiltersLabel="Reiniciar filtros"
      />,
    );

    const resetButton = container.querySelector<HTMLButtonElement>(
      'button[title="Reiniciar filtros"]',
    );
    expect(resetButton).not.toBeNull();
    expect(resetButton?.textContent).toContain("Reiniciar filtros");

    await act(async () => {
      resetButton!.click();
    });

    expect(handleReset).toHaveBeenCalledTimes(1);
  });

  test("permite alternar la densidad entre cómoda y compacta", async () => {
    const handleCompact = vi.fn();
    const { container } = await mount(
      <DataTableToolbar
        search=""
        onSearchChange={() => {}}
        compact={false}
        onCompactChange={handleCompact}
        densityAriaLabel="Densidad de prueba"
      />,
    );

    const comfortableBtn = container.querySelector<HTMLButtonElement>(
      'button[title="Fichas o filas cómodas con espaciado amplio"]',
    );
    const compactBtn = container.querySelector<HTMLButtonElement>(
      'button[title="Fichas o filas más compactas"]',
    );

    expect(comfortableBtn?.getAttribute("aria-pressed")).toBe("true");
    expect(compactBtn?.getAttribute("aria-pressed")).toBe("false");

    await act(async () => {
      compactBtn!.click();
    });

    expect(handleCompact).toHaveBeenCalledWith(true);
  });

  test("soporta la propiedad density y emite onDensityChange", async () => {
    const handleDensity = vi.fn();
    const { container } = await mount(
      <DataTableToolbar
        search=""
        onSearchChange={() => {}}
        density="compact"
        onDensityChange={handleDensity}
      />,
    );

    const comfortableBtn = container.querySelector<HTMLButtonElement>(
      'button[title="Fichas o filas cómodas con espaciado amplio"]',
    );
    const compactBtn = container.querySelector<HTMLButtonElement>(
      'button[title="Fichas o filas más compactas"]',
    );

    expect(comfortableBtn?.getAttribute("aria-pressed")).toBe("false");
    expect(compactBtn?.getAttribute("aria-pressed")).toBe("true");

    await act(async () => {
      comfortableBtn!.click();
    });

    expect(handleDensity).toHaveBeenCalledWith("comfortable");
  });

  test("renderiza los slots de filtros y acciones", async () => {
    const { container } = await mount(
      <DataTableToolbar
        search=""
        onSearchChange={() => {}}
        filters={<div id="custom-filters">Filtros de estado</div>}
        actions={<button id="custom-action">Exportar</button>}
      />,
    );

    expect(container.querySelector("#custom-filters")).not.toBeNull();
    expect(container.querySelector("#custom-action")).not.toBeNull();
  });
});
