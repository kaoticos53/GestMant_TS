// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { usePersistentDraft } from "../src/hooks/use-persistent-draft";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface TestFormState {
  title: string;
  notes: string;
}

const INITIAL_FORM: TestFormState = {
  title: "",
  notes: "",
};

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

describe("usePersistentDraft — persistencia y prevención de pérdida de datos", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.useFakeTimers();
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
    vi.useRealTimers();
  });

  test("arranca con el valor inicial y sin cambios pendientes cuando el almacén está vacío", () => {
    let hookReturn!: ReturnType<typeof usePersistentDraft<TestFormState>>;

    function TestComponent() {
      hookReturn = usePersistentDraft<TestFormState>({
        key: "test:draft:empty",
        initialValue: INITIAL_FORM,
      });
      return <div>{hookReturn.draft.title}</div>;
    }

    renderComponent(<TestComponent />);

    expect(hookReturn.draft).toEqual(INITIAL_FORM);
    expect(hookReturn.hasUnsavedChanges).toBe(false);
    expect(hookReturn.isRestored).toBe(false);
  });

  test("restaura un borrador existente en localStorage al montar", () => {
    const savedDraft: TestFormState = {
      title: "Reparación de cinta transportadora",
      notes: "Sustituido rodamiento derecho",
    };
    window.localStorage.setItem(
      "test:draft:existing",
      JSON.stringify(savedDraft),
    );

    let hookReturn!: ReturnType<typeof usePersistentDraft<TestFormState>>;

    function TestComponent() {
      hookReturn = usePersistentDraft<TestFormState>({
        key: "test:draft:existing",
        initialValue: INITIAL_FORM,
      });
      return <div>{hookReturn.draft.title}</div>;
    }

    renderComponent(<TestComponent />);

    expect(hookReturn.draft).toEqual(savedDraft);
    expect(hookReturn.hasUnsavedChanges).toBe(true);
    expect(hookReturn.isRestored).toBe(true);
  });

  test("persiste cambios en localStorage tras el debounce", () => {
    let hookReturn!: ReturnType<typeof usePersistentDraft<TestFormState>>;

    function TestComponent() {
      hookReturn = usePersistentDraft<TestFormState>({
        key: "test:draft:debounce",
        initialValue: INITIAL_FORM,
        debounceMs: 300,
      });
      return <div>{hookReturn.draft.title}</div>;
    }

    renderComponent(<TestComponent />);

    act(() => {
      hookReturn.setDraft({
        title: "Nuevo parte",
        notes: "Revisando componentes",
      });
    });

    expect(hookReturn.hasUnsavedChanges).toBe(true);
    // Aún no debe haberse guardado antes de agotar el debounce
    expect(window.localStorage.getItem("test:draft:debounce")).toBeNull();

    // Avanzamos el reloj
    act(() => {
      vi.advanceTimersByTime(300);
    });

    const stored = window.localStorage.getItem("test:draft:debounce");
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!)).toEqual({
      title: "Nuevo parte",
      notes: "Revisando componentes",
    });
  });

  test("clearDraft elimina el borrador del almacenamiento y limpia los cambios pendientes", () => {
    const initialSaved: TestFormState = {
      title: "Parte finalizado",
      notes: "Guardado en backend",
    };
    window.localStorage.setItem(
      "test:draft:clear",
      JSON.stringify(initialSaved),
    );

    let hookReturn!: ReturnType<typeof usePersistentDraft<TestFormState>>;

    function TestComponent() {
      hookReturn = usePersistentDraft<TestFormState>({
        key: "test:draft:clear",
        initialValue: INITIAL_FORM,
      });
      return <div>{hookReturn.draft.title}</div>;
    }

    renderComponent(<TestComponent />);

    act(() => {
      hookReturn.clearDraft();
    });

    expect(window.localStorage.getItem("test:draft:clear")).toBeNull();
    expect(hookReturn.hasUnsavedChanges).toBe(false);
    expect(hookReturn.isRestored).toBe(false);
  });

  test("resetToInitial restaura el valor inicial y purga el almacenamiento", () => {
    let hookReturn!: ReturnType<typeof usePersistentDraft<TestFormState>>;

    function TestComponent() {
      hookReturn = usePersistentDraft<TestFormState>({
        key: "test:draft:reset",
        initialValue: INITIAL_FORM,
        debounceMs: 100,
      });
      return <div>{hookReturn.draft.title}</div>;
    }

    renderComponent(<TestComponent />);

    act(() => {
      hookReturn.setDraft({
        title: "Borrador temporal",
        notes: "A descartar",
      });
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(window.localStorage.getItem("test:draft:reset")).not.toBeNull();

    act(() => {
      hookReturn.resetToInitial();
    });

    expect(hookReturn.draft).toEqual(INITIAL_FORM);
    expect(window.localStorage.getItem("test:draft:reset")).toBeNull();
    expect(hookReturn.hasUnsavedChanges).toBe(false);
  });
});
