// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Toaster } from "@/components/ui/sonner";
import {
  ARCHIVE_UNDO_LABEL,
  archiveWithUndoToast,
  unarchiveSuccessToast,
} from "@/lib/archiveToasts";
import { toast } from "sonner";
import { TOASTER_SELECTOR } from "@/lib/toasts";
import { settle } from "./settle";

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

async function mount(ui: ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(ui);
  });
  await settle();
}

async function showNotice(fire: () => void) {
  await act(async () => {
    fire();
  });
  await settle();
}

function toaster(): Element {
  const node = document.querySelector(TOASTER_SELECTOR);
  if (node === null) throw new Error("No hay ningún aviso a la vista.");
  return node;
}

function toastButton(label: string): Element {
  const button = [...toaster().querySelectorAll("button")].find(
    (node) => node.textContent?.trim() === label,
  );
  if (button === undefined) {
    throw new Error(`El aviso no tiene un botón «${label}».`);
  }
  return button;
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

beforeEach(() => {
  toast.dismiss();
  (
    globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  installMissingDomApis();
});

afterEach(async () => {
  toast.dismiss();
  await act(async () => {
    for (const root of roots) root.unmount();
  });
  roots = [];
  document.body.innerHTML = "";
});

describe("Avisos de archivado (archiveToasts)", () => {
  test("archiveWithUndoToast muestra la referencia, la descripción y el botón Deshacer", async () => {
    await mount(<Toaster />);
    const onUndo = vi.fn();

    await showNotice(() => {
      archiveWithUndoToast({
        reference: "INC-2026-0042",
        noun: "incidencia",
        onUndo,
      });
    });

    const content = toaster().textContent ?? "";
    expect(content).toContain("INC-2026-0042 al archivo");
    expect(content).toContain("pestaña Archivo");
    expect(content).toContain(ARCHIVE_UNDO_LABEL);

    const button = toastButton(ARCHIVE_UNDO_LABEL);
    await press(button);

    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  test("unarchiveSuccessToast confirma la recuperación", async () => {
    await mount(<Toaster />);

    await showNotice(() => {
      unarchiveSuccessToast({ reference: "REQ-2026-0010" });
    });

    const content = toaster().textContent ?? "";
    expect(content).toContain("REQ-2026-0010 recuperada del archivo");
    expect(content).toContain("Vuelve a estar disponible");
  });
});
