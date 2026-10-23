// @vitest-environment jsdom
import { settle } from "./settle";
import { act, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("convex/react", () => ({
  useMutation: () => async () => "",
  useAction: () => async () => "",
}));

import { RichTextEditor } from "@/components/RichTextEditor";

/**
 * El campo de las notas se puede escribir en grande: la barra trae un botón que
 * lo abre en un diálogo con el mismo campo dentro. Aquí se comprueba lo que se
 * ve —el botón, el diálogo, lo que ya estaba escrito— con el editor de verdad
 * montado en jsdom, sin suponer nada de TipTap.
 */

let roots: Root[] = [];

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  // Lo que Radix da por hecho y jsdom todavía no trae.
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
  // ProseMirror mide el cursor al ponerlo al final del campo; jsdom no sabe
  // decir dónde está, así que contesta que en ningún sitio.
  Range.prototype.getClientRects ??= () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect ??= () => new DOMRect();
  document.body.innerHTML = "";
  roots = [];
});

afterEach(async () => {
  await act(async () => {
    for (const root of roots) root.unmount();
  });
  roots = [];
  document.body.innerHTML = "";
});

/**
 * El editor llega en su propio trozo (ver `RichTextEditor`): montarlo es pedir
 * el trozo y esperar a que esté, no a que pasen unos turnos. Se espera a que el
 * hueco de carga desaparezca.
 */
async function waitForEditor(): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (!document.querySelector('[aria-busy="true"]')) return;
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 10));
    });
  }
  throw new Error("el editor no ha terminado de cargarse");
}

async function mount(node: ReactNode): Promise<HTMLElement> {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(<>{node}</>);
  });
  await waitForEditor();
  await settle();
  return container;
}

async function press(target: Element | null) {
  expect(target).not.toBeNull();
  await act(async () => {
    for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup"]) {
      target!.dispatchEvent(
        new MouseEvent(type, { bubbles: true, cancelable: true, button: 0 }),
      );
    }
    target!.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }),
    );
  });
  await settle();
}

const botonDeAmpliar = () =>
  document.querySelector<HTMLButtonElement>(
    'button[aria-label="Escribir en grande"]',
  );

const dialogos = () => [...document.querySelectorAll('[role="dialog"]')];

describe("el campo de notas en grande", () => {
  test("la barra trae el botón de abrirlo en grande", async () => {
    await mount(
      <RichTextEditor value="" onChange={() => {}} placeholder="Notas" />,
    );

    expect(botonDeAmpliar()).not.toBeNull();
    expect(botonDeAmpliar()!.title).toBe("Escribir en grande");
  });

  test("el botón abre el mismo campo, con su texto, en un diálogo", async () => {
    await mount(
      <RichTextEditor
        value="Se comprueba el cable del plató 2"
        onChange={() => {}}
        placeholder="Notas"
      />,
    );

    await press(botonDeAmpliar());

    const dialogo = dialogos().find((candidate) =>
      candidate.textContent?.includes("Escribir en grande"),
    );
    expect(dialogo, "no se ha abierto el diálogo").not.toBeUndefined();
    // El campo de dentro ya trae lo que había: no se abre en blanco.
    expect(dialogo!.textContent).toContain("Se comprueba el cable del plató 2");
    // Y el valor no se toca por abrir: quien lo lleva sigue con lo mismo.
  });

  test("lo escrito en el diálogo llega al campo de la ficha", async () => {
    // El padre guarda el documento, como en la ficha de verdad.
    function ConCampo() {
      const [valor, setValor] = useState("Primera nota");
      return (
        <>
          <RichTextEditor
            id="notas"
            value={valor}
            onChange={setValor}
            placeholder="Notas"
          />
          <p data-testid="valor">{valor}</p>
        </>
      );
    }
    await mount(<ConCampo />);

    // Abrir el diálogo no toca lo que ya había.
    const antes = document.querySelector('[data-testid="valor"]')?.textContent;
    await press(botonDeAmpliar());
    const editores = document.querySelectorAll<HTMLElement>(
      '[contenteditable="true"]',
    );
    expect(editores.length).toBe(2);
    expect(document.querySelector('[data-testid="valor"]')?.textContent).toBe(
      antes,
    );

    // Y lo que se escribe en grande vuelve al mismo valor del padre: el campo
    // de dentro del diálogo es el campo, no una copia aparte.
    const dentro = editores[1];
    dentro.innerHTML = "<p>Primera nota, con más detalle</p>";
    dentro.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: "Primera nota, con más detalle",
      }),
    );
    await settle();
    await settle();
    expect(
      document.querySelector('[data-testid="valor"]')?.textContent,
    ).toContain("Primera nota, con más detalle");
    // El campo de la ficha ya dice lo mismo, listo para seguir por ahí.
    expect(editores[0].textContent).toContain("Primera nota, con más detalle");
  });

  test("«Listo» cierra el diálogo y deja el campo donde estaba", async () => {
    const container = await mount(
      <RichTextEditor value="Una nota" onChange={() => {}} />,
    );

    await press(botonDeAmpliar());
    expect(dialogos().length).toBe(1);

    const listo = [...document.querySelectorAll("button")].find(
      (candidate) => candidate.textContent?.trim() === "Listo",
    );
    await press(listo ?? null);

    expect(dialogos().length).toBe(0);
    expect(container.querySelector('[contenteditable="true"]')).not.toBeNull();
  });

  test("el compositor de un chat no lo lleva: ahí el mensaje es corto", async () => {
    await mount(<RichTextEditor value="" onChange={() => {}} compact />);

    expect(botonDeAmpliar()).toBeNull();
  });
});
