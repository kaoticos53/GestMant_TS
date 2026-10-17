// @vitest-environment jsdom
import { settle } from "./settle";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { DocumentLink } from "@/components/DocumentLink";

/**
 * El enlace de un documento del expediente: mientras su archivo se puede abrir
 * es el enlace de siempre y, cuando no, deja su sitio al aviso de por qué. Se
 * monta a mano con React y jsdom, como el resto de pruebas de componente del
 * taller; lo que el navegador contesta se le da hecho —una sonda que dice que sí
 * o que no—, porque lo que importa aquí es qué queda en la fila.
 */

let roots: Root[] = [];

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
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

/** Pinta lo que se le pase y devuelve el contenedor. */
async function mount(node: ReactNode): Promise<HTMLElement> {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(<>{node}</>);
  });
  await settle();
  return container;
}

/** Pulsa un botón por su texto, como haría quien lo tiene delante. */
async function press(container: HTMLElement, label: string) {
  const button = [...container.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === label,
  );
  expect(button, `no hay un botón «${label}»`).not.toBeUndefined();
  await act(async () => {
    button!.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }),
    );
  });
  await settle();
}

const documento = "https://api.tudominio.com/api/storage/a";

describe("DocumentLink", () => {
  test("mientras el archivo se puede abrir, es el enlace de siempre", async () => {
    const probe = vi.fn(async () => true);
    const container = await mount(
      <DocumentLink
        url={documento}
        name="Presupuesto.pdf"
        className="mt-0.5"
        probe={probe}
      />,
    );

    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe(documento);
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link?.textContent).toBe("Ver el archivo");
    expect(link?.className).toContain("mt-0.5");
    // Se le ha preguntado a la dirección, y ha contestado que sí.
    expect(probe).toHaveBeenCalledWith(documento);
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  test("un documento sin archivo lo dice, en vez de ofrecer un enlace muerto", async () => {
    const probe = vi.fn(async () => true);
    const container = await mount(
      <DocumentLink url={null} name="Presupuesto.pdf" probe={probe} />,
    );

    expect(container.textContent).toContain("Sin archivo");
    expect(container.querySelector("a")).toBeNull();
    // No hay dirección que preguntar.
    expect(probe).not.toHaveBeenCalled();
  });

  test("dentro de una página HTTPS, un archivo por HTTP no se ofrece ni se pregunta", async () => {
    const probe = vi.fn(async () => true);
    const container = await mount(
      <DocumentLink
        url="http://192.168.1.10:3210/api/storage/a"
        name="Presupuesto.pdf"
        pageProtocol="https:"
        probe={probe}
      />,
    );

    expect(container.textContent).toContain("No se abre «Presupuesto.pdf»");
    expect(container.textContent).toContain("Sin HTTPS");
    expect(container.textContent).toContain("contenido mixto");
    // El único enlace que queda es el de abrirlo de todas formas, no el de antes.
    const links = [...container.querySelectorAll("a")];
    expect(links.map((link) => link.textContent?.trim())).toEqual([
      "Abrirlo de todas formas",
    ]);
    expect(probe).not.toHaveBeenCalled();
  });

  test("un archivo servido desde otro sitio se delata sin preguntar", async () => {
    const probe = vi.fn(async () => true);
    const container = await mount(
      <DocumentLink
        url="https://files.ejemplo.com/informe.pdf"
        name="Informe.pdf"
        apiUrl="https://api.tudominio.com"
        probe={probe}
      />,
    );

    expect(container.textContent).toContain("Otra dirección");
    expect(container.textContent).toContain("https://files.ejemplo.com");
    expect(probe).not.toHaveBeenCalled();
  });

  test("si la dirección no contesta, el enlace deja su sitio al aviso", async () => {
    const container = await mount(
      <DocumentLink
        url={documento}
        name="Presupuesto.pdf"
        probe={async () => false}
      />,
    );

    expect(container.querySelector("a")?.textContent).toBe(
      "Abrirlo de todas formas",
    );
    expect(container.textContent).toContain("No se abre «Presupuesto.pdf»");
    expect(container.textContent).toContain("No responde");
    expect(container.textContent).toContain("el aviso de arriba");
    // La dirección que no contesta es la de la API, que es la casa del archivo.
    expect(container.textContent).toContain("https://api.tudominio.com");
    expect(container.textContent).toContain("Volver a comprobar");
    // Y el enlace de socorro sigue llevando al documento entero.
    const escape = container.querySelector("a");
    expect(escape?.getAttribute("href")).toBe(documento);
  });

  test("«Volver a comprobar» vuelve a preguntar, y el enlace vuelve si contesta", async () => {
    let answers = false;
    const probe = vi.fn(async () => answers);
    const container = await mount(
      <DocumentLink url={documento} name="Presupuesto.pdf" probe={probe} />,
    );
    expect(container.querySelector("a")?.textContent).toBe(
      "Abrirlo de todas formas",
    );
    expect(probe).toHaveBeenCalledTimes(1);

    answers = true;
    await press(container, "Volver a comprobar");

    expect(probe).toHaveBeenCalledTimes(2);
    expect(container.querySelector("a")?.getAttribute("href")).toBe(documento);
    expect(container.textContent).not.toContain("No se abre");
  });

  test("al cambiar de documento, el aviso del anterior no se queda", async () => {
    const container = await mount(
      <DocumentLink url={documento} name="Una" probe={async () => false} />,
    );
    expect(container.textContent).toContain("No se abre");

    const root = roots[roots.length - 1];
    await act(async () => {
      root.render(
        <DocumentLink
          url="https://api.tudominio.com/api/storage/b"
          name="Otra"
          probe={async () => true}
        />,
      );
    });
    await settle();

    expect(container.textContent).not.toContain("No se abre");
    expect(container.querySelector("a")?.getAttribute("href")).toBe(
      "https://api.tudominio.com/api/storage/b",
    );
  });
});
