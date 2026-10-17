// @vitest-environment jsdom
import { settle } from "./settle";
import { act, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import {
  UNDO_LABEL,
  noteRemovedToast,
  noteRestoreUndoneToast,
  noteVersionRestoredToast,
} from "@/lib/noteToasts";
import { TOASTER_SELECTOR } from "@/lib/toasts";

/**
 * Los avisos del cuaderno —devolver una nota a una versión anterior, deshacer
 * esa restauración y retirar una nota— salen con la ficha abierta, y se pintan
 * fuera de ella: para Radix, pulsarlos es pulsar «fuera». Aquí se pulsan de
 * verdad, con el aviso y la ficha montados, y se comprueba lo que importa: que
 * el aviso hace lo suyo y que la ficha (o el diálogo) sigue delante.
 *
 * Se montan a mano con React y jsdom en vez de con una librería de pruebas de
 * componente: lo que hay que reproducir es una pulsación del navegador
 * completa (`pointerdown` y luego `click`, que es lo que Radix mira) y un aviso
 * de sonner real, no un doble.
 */

/**
 * Lo que jsdom todavía no trae y estos componentes dan por hecho: sonner mira el
 * tamaño de la ventana y sujeta el aviso con el puntero (para poder arrastrarlo
 * fuera), y son dos cosas que solo existen en un navegador de verdad.
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

let roots: Root[] = [];

/** Lanza un aviso y espera a tenerlo a la vista. */
async function showNotice(fire: () => void) {
  await act(async () => {
    fire();
  });
  await settle();
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
  // Radix engancha la escucha de `pointerdown` en un temporizador: sin dejarle
  // el turno, la pulsación se pierde y la prueba no probaría nada.
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

/** El contenedor de los avisos, que es lo que sonner pinta. */
function toaster(): Element {
  const node = document.querySelector(TOASTER_SELECTOR);
  if (node === null) throw new Error("No hay ningún aviso a la vista.");
  return node;
}

/** El botón de un aviso —«Deshacer»—, buscado por lo que dice. */
function toastButton(label: string): Element {
  const button = [...toaster().querySelectorAll("button")].find(
    (node) => node.textContent?.trim() === label,
  );
  if (button === undefined) {
    throw new Error(`El aviso no tiene un botón «${label}».`);
  }
  return button;
}

/** El texto que el aviso enseña, para leerlo como lo leería quien lo tiene delante. */
function toastText(): string {
  return toaster().textContent ?? "";
}

/** La ficha de una incidencia: la hoja que abre el cuaderno (y los avisos). */
function IncidentSheet({
  onClose,
  onInteractOutside,
}: {
  onClose: () => void;
  onInteractOutside: React.ComponentProps<
    typeof SheetContent
  >["onInteractOutside"];
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
      <SheetContent onInteractOutside={onInteractOutside}>
        <p>Cuaderno de la incidencia INC-0001</p>
      </SheetContent>
    </Sheet>
  );
}

/** Un diálogo cualquiera con un aviso por delante. */
function PlainDialog({
  onClose,
  onInteractOutside,
}: {
  onClose: () => void;
  onInteractOutside: React.ComponentProps<
    typeof DialogContent
  >["onInteractOutside"];
}) {
  const [open, setOpen] = useState(true);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
          setOpen(false);
        }
      }}
    >
      <DialogContent onInteractOutside={onInteractOutside}>
        <DialogTitle>Historial de la nota</DialogTitle>
      </DialogContent>
    </Dialog>
  );
}

/** ¿Sigue la ficha (o el diálogo) a la vista? */
function wrapperIsOpen() {
  return (
    document.querySelector('[data-slot="sheet-content"]') !== null ||
    document.querySelector('[data-slot="dialog-content"]') !== null
  );
}

/** Monta la ficha con su toaster y devuelve los espías de cierre. */
async function mountSheet() {
  const onClose = vi.fn();
  const onInteractOutside = vi.fn();
  await mount(
    <>
      <IncidentSheet onClose={onClose} onInteractOutside={onInteractOutside} />
      <Toaster />
    </>,
  );
  return { onClose, onInteractOutside };
}

beforeEach(() => {
  toast.dismiss();
  installMissingDomApis();
  // React pide que se le diga que está en un entorno de pruebas.
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(async () => {
  toast.dismiss();
  await act(async () => {
    for (const root of roots) root.unmount();
  });
  roots = [];
  document.body.innerHTML = "";
});

describe("los avisos del cuaderno con la ficha abierta", () => {
  test("el «Deshacer» de la restauración deshace y deja la ficha delante", async () => {
    const { onClose, onInteractOutside } = await mountSheet();
    const onUndo = vi.fn();

    await showNotice(() => noteVersionRestoredToast({ onUndo }));
    expect(toastText()).toContain("Nota devuelta a la versión anterior");

    await press(toastButton(UNDO_LABEL));

    // El aviso hace lo suyo…
    expect(onUndo).toHaveBeenCalledTimes(1);
    // …y la ficha sigue abierta: Radix no ha visto ahí una pulsación de fuera.
    expect(onInteractOutside).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(wrapperIsOpen()).toBe(true);
  });

  test("el aviso de la restauración deshecha se lee sin cerrar la ficha", async () => {
    const { onClose, onInteractOutside } = await mountSheet();

    await showNotice(() => noteRestoreUndoneToast());
    expect(toastText()).toContain("Restauración deshecha");

    await press(toaster());

    expect(onInteractOutside).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(wrapperIsOpen()).toBe(true);
  });

  test("el aviso de deshacer no vuelve a ofrecer deshacer", async () => {
    await mountSheet();

    await showNotice(() => noteRestoreUndoneToast());

    // Encadenar vueltas dejaría el cuaderno sin saber dónde está.
    expect(
      [...toaster().querySelectorAll("button")].map((node) =>
        node.textContent?.trim(),
      ),
    ).not.toContain(UNDO_LABEL);
  });

  test("el «Deshacer» de una nota retirada la devuelve y no cierra la ficha", async () => {
    const { onClose, onInteractOutside } = await mountSheet();
    const onUndo = vi.fn();

    await showNotice(() => noteRemovedToast({ onUndo }));
    expect(toastText()).toContain("Nota retirada del cuaderno");

    await press(toastButton(UNDO_LABEL));

    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onInteractOutside).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(wrapperIsOpen()).toBe(true);
  });

  test("pulsar fuera de la ficha sí la cierra: el aviso es lo único aparte", async () => {
    const { onClose, onInteractOutside } = await mountSheet();

    await press(document.body);

    expect(onInteractOutside).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(wrapperIsOpen()).toBe(false);
  });
});

describe("el mismo aviso con un diálogo por delante", () => {
  test("el «Deshacer» de la restauración no cierra el diálogo", async () => {
    const onClose = vi.fn();
    const onInteractOutside = vi.fn();
    const onUndo = vi.fn();
    await mount(
      <>
        <PlainDialog onClose={onClose} onInteractOutside={onInteractOutside} />
        <Toaster />
      </>,
    );

    await showNotice(() => noteVersionRestoredToast({ onUndo }));
    await press(toastButton(UNDO_LABEL));

    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onInteractOutside).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(wrapperIsOpen()).toBe(true);
  });

  test("pulsar fuera del diálogo sí lo cierra", async () => {
    const onClose = vi.fn();
    const onInteractOutside = vi.fn();
    await mount(
      <>
        <PlainDialog onClose={onClose} onInteractOutside={onInteractOutside} />
        <Toaster />
      </>,
    );

    await press(document.body);

    expect(onInteractOutside).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(wrapperIsOpen()).toBe(false);
  });
});
