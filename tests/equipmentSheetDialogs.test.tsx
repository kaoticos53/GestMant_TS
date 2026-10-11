// @vitest-environment jsdom
import { act, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";

/**
 * Un manual se retira desde la ficha de un equipo, sin salir de ella: pulsar
 * «Borrar manual» retira el manual y cierra su confirmación, pero la ficha del
 * equipo sigue delante. Aquí se comprueba ese contrato en las dos salidas de la
 * confirmación —borrar y cancelar—, con la ficha montada de verdad y la
 * confirmación dentro de su contenido, que es donde va.
 *
 * Se monta a mano con React y jsdom en vez de con una librería de pruebas de
 * componente: lo que hay que reproducir es una pulsación del navegador completa
 * (`pointerdown` y después `click`, que es lo que Radix mira).
 */

/**
 * Lo que jsdom todavía no trae y estos componentes dan por hecho: Radix sujeta
 * el puntero y comprueba la captura, cosas que solo existen en un navegador de
 * verdad.
 */
function installMissingDomApis() {
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
}

let roots: Root[] = [];

/** Deja pasar un turno: Radix engancha sus escuchas en un temporizador. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
}

/** Monta lo que se le pase y espera a que los diálogos enganchen su escucha. */
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

/** Vuelve a pintar lo mismo cambiando lo que se le pase (abrir el diálogo). */
async function rerender(root: Root, ui: ReactNode) {
  await act(async () => {
    root.render(ui);
  });
  await settle();
}

/**
 * Pulsa un elemento como lo haría el navegador. Radix mira el `pointerdown`
 * para saber si la pulsación cae fuera del diálogo, y espera al `click` para
 * darlo por cerrado; con solo uno de los dos, no habría nada que comprobar.
 */
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

/** Un botón por lo que dice, para pulsarlo como lo pulsaría quien lo tiene delante. */
function button(label: string): Element {
  const node = [...document.querySelectorAll("button")].find(
    (item) => item.textContent?.trim() === label,
  );
  if (node === undefined) {
    throw new Error(`No hay ningún botón «${label}» a la vista.`);
  }
  return node;
}

/** ¿Sigue la ficha a la vista? */
function sheetIsOpen() {
  return document.querySelector('[data-slot="sheet-content"]') !== null;
}

/** ¿Sigue la confirmación a la vista? */
function dialogIsOpen() {
  return document.querySelector('[data-slot="alert-dialog-content"]') !== null;
}

/**
 * La ficha de un equipo, con los diálogos que se abren desde ella dentro de su
 * contenido —igual que en la aplicación: Radix solo da por «dentro» lo que está
 * en el árbol de React de la ficha—.
 */
function EquipmentSheet({
  onClose,
  children,
}: {
  onClose: () => void;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        // Como en la ficha de verdad: cerrarla sale por `onClose`.
        if (!next) {
          onClose();
          setOpen(false);
        }
      }}
    >
      <SheetContent>
        <p>Ficha del equipo EQ-001</p>
        {children}
      </SheetContent>
    </Sheet>
  );
}

/** La confirmación de retirar un manual, como la abre la ficha del equipo. */
function ManualDeleteDialog({
  onDeleted,
  onClose,
}: {
  onDeleted: () => void;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
          setOpen(false);
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            ¿Borrar «Manual de servicio HDC-3500»?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Se borra la ficha, su archivo y las versiones anteriores que guarda
            su historial: no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onDeleted}>
            Borrar manual
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** La ficha con su confirmación, que aparece —o no— según lo que se le pase. */
function SheetWithDeleteDialog({
  withDialog,
  onSheetClose,
  onDeleted,
  onDialogClose,
}: {
  withDialog: boolean;
  onSheetClose: () => void;
  onDeleted: () => void;
  onDialogClose: () => void;
}) {
  return (
    <EquipmentSheet onClose={onSheetClose}>
      {withDialog ? (
        <ManualDeleteDialog onDeleted={onDeleted} onClose={onDialogClose} />
      ) : null}
    </EquipmentSheet>
  );
}

/**
 * Monta la ficha y, encima —como cuando se pulsa en la ficha—, su confirmación
 * de borrado.
 */
async function mountSheetWithDeleteDialog() {
  const onSheetClose = vi.fn();
  const onDeleted = vi.fn();
  const onDialogClose = vi.fn();
  const ui = (withDialog: boolean) => (
    <SheetWithDeleteDialog
      withDialog={withDialog}
      onSheetClose={onSheetClose}
      onDeleted={onDeleted}
      onDialogClose={onDialogClose}
    />
  );
  const root = await mount(ui(false));
  expect(sheetIsOpen()).toBe(true);
  await rerender(root, ui(true));
  expect(dialogIsOpen()).toBe(true);
  return { onSheetClose, onDeleted, onDialogClose };
}

beforeEach(() => {
  installMissingDomApis();
  // React pide que se le diga que está en un entorno de pruebas.
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(async () => {
  await act(async () => {
    for (const root of roots) root.unmount();
  });
  roots = [];
  document.body.innerHTML = "";
});

describe("los manuales desde la ficha del equipo", () => {
  test("retirar un manual no cierra la ficha", async () => {
    const { onSheetClose, onDeleted, onDialogClose } =
      await mountSheetWithDeleteDialog();

    await press(button("Borrar manual"));

    // El manual se retira y su confirmación se cierra…
    expect(onDeleted).toHaveBeenCalledTimes(1);
    expect(onDialogClose).toHaveBeenCalledTimes(1);
    expect(dialogIsOpen()).toBe(false);
    // …pero la ficha del equipo sigue delante.
    expect(onSheetClose).not.toHaveBeenCalled();
    expect(sheetIsOpen()).toBe(true);
  });

  test("cancelar el borrado tampoco cierra la ficha", async () => {
    const { onSheetClose, onDeleted, onDialogClose } =
      await mountSheetWithDeleteDialog();

    await press(button("Cancelar"));

    expect(onDeleted).not.toHaveBeenCalled();
    expect(onDialogClose).toHaveBeenCalledTimes(1);
    expect(dialogIsOpen()).toBe(false);
    expect(onSheetClose).not.toHaveBeenCalled();
    expect(sheetIsOpen()).toBe(true);
  });
});
