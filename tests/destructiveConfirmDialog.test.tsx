// @vitest-environment jsdom
import { settle } from "./settle";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { DestructiveConfirmDialog } from "@/components/ui/destructive-confirm-dialog";

/**
 * La confirmación común de los borrados y las retiradas. Se prueba lo que tiene
 * que ser igual en todos los módulos que la usan: que confirmar no cierra por
 * su cuenta, que un segundo clic no repite la acción y que no se puede cerrar
 * el diálogo mientras la operación sigue en marcha.
 *
 * Se monta a mano con React y jsdom, como el resto de pruebas de diálogos: lo
 * que hay que reproducir es una pulsación de navegador completa.
 */

function installMissingDomApis() {
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
}

let roots: Root[] = [];

async function mount(ui: ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(ui);
  });
  await settle();
  return root;
}

async function press(target: Element) {
  await act(async () => {
    for (const type of [
      "pointerdown",
      "mousedown",
      "pointerup",
      "mouseup",
      "click",
    ]) {
      target.dispatchEvent(
        new MouseEvent(type, { bubbles: true, cancelable: true, button: 0 }),
      );
    }
  });
  await settle();
}

function button(label: string): HTMLButtonElement {
  const node = [...document.querySelectorAll("button")].find(
    (item) => item.textContent?.trim() === label,
  );
  if (node === undefined) {
    throw new Error(`No hay ningún botón «${label}» a la vista.`);
  }
  return node as HTMLButtonElement;
}

function dialogIsOpen() {
  return document.querySelector('[data-slot="alert-dialog-content"]') !== null;
}

/** Una operación que acaba cuando el test lo decide. */
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  installMissingDomApis();
});

afterEach(async () => {
  for (const root of roots) {
    await act(async () => root.unmount());
  }
  roots = [];
  document.body.innerHTML = "";
});

describe("DestructiveConfirmDialog", () => {
  test("dice qué se borra y qué cuesta, con el texto de cada módulo", async () => {
    await mount(
      <DestructiveConfirmDialog
        onClose={() => {}}
        title="¿Borrar EQ-001?"
        description="Se borrará del inventario."
        confirmLabel="Borrar equipo"
        onConfirm={() => {}}
      />,
    );

    expect(document.body.textContent).toContain("¿Borrar EQ-001?");
    expect(document.body.textContent).toContain("Se borrará del inventario.");
    expect(button("Borrar equipo").disabled).toBe(false);
  });

  test("confirmar lanza la acción y no cierra por su cuenta", async () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    await mount(
      <DestructiveConfirmDialog
        onClose={onClose}
        title="¿Borrar?"
        description="d"
        confirmLabel="Borrar"
        onConfirm={onConfirm}
      />,
    );

    await press(button("Borrar"));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    // Cierra quien confirma, en su `finally`: aquí no.
    expect(onClose).not.toHaveBeenCalled();
    expect(dialogIsOpen()).toBe(true);
  });

  test("con la operación en marcha el botón se bloquea y un segundo clic no la repite", async () => {
    const work = deferred();
    const onConfirm = vi.fn(() => work.promise);
    const onClose = vi.fn();
    await mount(
      <DestructiveConfirmDialog
        onClose={onClose}
        title="¿Borrar?"
        description="d"
        confirmLabel="Borrar"
        busyLabel="Borrando..."
        onConfirm={onConfirm}
      />,
    );

    await press(button("Borrar"));
    expect(button("Borrando...").disabled).toBe(true);

    await press(button("Borrando..."));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    // Cancelar tampoco deja salir mientras se guarda.
    expect(button("Cancelar").disabled).toBe(true);
    await press(button("Cancelar"));
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => work.resolve());
    await settle();
    expect(button("Borrar").disabled).toBe(false);
  });

  test("si la operación falla, el botón vuelve a quedar libre", async () => {
    const onConfirm = vi.fn(async () => {
      throw new Error("sin red");
    });
    await mount(
      <DestructiveConfirmDialog
        onClose={() => {}}
        title="¿Borrar?"
        description="d"
        confirmLabel="Borrar"
        onConfirm={() => onConfirm().catch(() => {})}
      />,
    );

    await press(button("Borrar"));

    expect(button("Borrar").disabled).toBe(false);
  });

  test("un padre que lleva el estado de guardado también bloquea el diálogo", async () => {
    const onClose = vi.fn();
    await mount(
      <DestructiveConfirmDialog
        onClose={onClose}
        title="¿Retirar la nota?"
        description="d"
        confirmLabel="Retirar nota"
        busyLabel="Retirando..."
        busy
        onConfirm={() => {}}
      />,
    );

    expect(button("Retirando...").disabled).toBe(true);
    expect(button("Cancelar").disabled).toBe(true);
    await press(button("Cancelar"));
    expect(onClose).not.toHaveBeenCalled();
  });

  test("cancelar cierra, con el texto que ponga el módulo", async () => {
    const onClose = vi.fn();
    await mount(
      <DestructiveConfirmDialog
        onClose={onClose}
        title="¿Borrar?"
        description="d"
        confirmLabel="Borrar"
        cancelLabel="Volver"
        onConfirm={() => {}}
      />,
    );

    await press(button("Volver"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("si no se puede borrar, solo informa y no ofrece el botón destructivo", async () => {
    await mount(
      <DestructiveConfirmDialog
        onClose={() => {}}
        title="No se puede eliminar el modelo"
        description="Hay equipos de este modelo."
        confirmLabel="Eliminar modelo"
        cancelLabel="Cerrar"
        hideConfirm
        onConfirm={() => {}}
      />,
    );

    expect(button("Cerrar")).toBeDefined();
    expect(
      [...document.querySelectorAll("button")].some(
        (item) => item.textContent?.trim() === "Eliminar modelo",
      ),
    ).toBe(false);
  });

  test("cerrado no pinta nada", async () => {
    await mount(
      <DestructiveConfirmDialog
        open={false}
        onClose={() => {}}
        title="¿Borrar?"
        description="d"
        confirmLabel="Borrar"
        onConfirm={() => {}}
      />,
    );

    expect(dialogIsOpen()).toBe(false);
  });
});
