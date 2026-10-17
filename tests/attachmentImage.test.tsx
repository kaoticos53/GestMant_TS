// @vitest-environment jsdom
import { settle } from "./settle";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { AttachmentImage } from "@/components/AttachmentImage";
import {
  attachmentFailure,
  missingAttachment,
  originOf,
} from "@/lib/attachment";

/**
 * La foto de un adjunto cuando su dirección pública no llega: en el sitio de la
 * foto se lee por qué, y se puede volver a intentar. Se monta a mano con React y
 * jsdom, como el resto de pruebas de componente del taller: el navegador no
 * carga imágenes de verdad, así que el fallo se le cuenta a la foto tal y como
 * se lo cuenta el navegador —un `error` en el elemento—, y a partir de ahí se
 * mira lo que de verdad importa: qué queda en el hueco.
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

/** La foto pide su dirección y el navegador contesta que no llega. */
async function breakPicture(container: HTMLElement) {
  const picture = container.querySelector("img");
  expect(picture, "la foto tiene que estar antes de fallar").not.toBeNull();
  await act(async () => {
    picture!.dispatchEvent(new Event("error"));
  });
  await settle();
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

describe("attachmentFailure", () => {
  test("ve la dirección pública del archivo, no la del sitio", () => {
    expect(originOf("https://api.tudominio.com/api/storage/abc")).toBe(
      "https://api.tudominio.com",
    );
    expect(originOf("no-es-una-direccion")).toBeNull();
    expect(originOf(null)).toBeNull();
  });

  test("dice que son dos direcciones distintas cuando el archivo viene de otro sitio", () => {
    const failure = attachmentFailure("https://files.ejemplo.com/foto.jpg", {
      apiUrl: "https://api.tudominio.com",
      pageProtocol: "https:",
    });
    expect(failure.reason).toBe("Otra dirección");
    expect(failure.detail).toContain("https://files.ejemplo.com");
    expect(failure.detail).toContain("https://api.tudominio.com");
    expect(failure.address).toBe("https://files.ejemplo.com/foto.jpg");
  });

  test("delata el contenido mixto: la página por HTTPS y el archivo por HTTP", () => {
    const failure = attachmentFailure(
      "http://192.168.1.10:3210/api/storage/a",
      {
        apiUrl: "http://192.168.1.10:3210",
        pageProtocol: "https:",
      },
    );
    expect(failure.reason).toBe("Sin HTTPS");
    expect(failure.detail).toContain("contenido mixto");
    expect(failure.detail).toContain("CONVEX_CLOUD_ORIGIN");
  });

  test("con la misma dirección, el que falta es el archivo", () => {
    const failure = attachmentFailure(
      "https://api.tudominio.com/api/storage/a",
      {
        apiUrl: "https://api.tudominio.com",
        pageProtocol: "https:",
      },
    );
    expect(failure.reason).toBe("Ya no está");
    expect(failure.detail).toContain("almacén");
  });

  test("sin nada que comparar, al menos dice la dirección que falló", () => {
    const failure = attachmentFailure("/api/storage/a", {
      apiUrl: null,
      pageProtocol: null,
    });
    expect(failure.reason).toBe("No responde");
    expect(failure.detail).toContain("/api/storage/a");
  });

  test("un adjunto que se quedó sin archivo no tiene dirección que juzgar", () => {
    const missing = missingAttachment();
    expect(missing.reason).toBe("Sin archivo");
    expect(missing.detail).toContain("almacén");
    // Ni dirección que enseñar ni nada que reintentar: no hay archivo.
    expect(missing.address).toBe("");
    // Y es cosa de ese archivo, no de la dirección: se dice en su hueco.
    expect(missing.blame).toBe("file");
  });

  test("de quién es el fallo: de la dirección —la misma para todas— o del archivo", () => {
    const otra = attachmentFailure("https://files.ejemplo.com/foto.jpg", {
      apiUrl: "https://api.tudominio.com",
      pageProtocol: "https:",
    });
    expect(otra.blame).toBe("address");

    const sinHttps = attachmentFailure(
      "http://192.168.1.10:3210/api/storage/a",
      { apiUrl: "http://192.168.1.10:3210", pageProtocol: "https:" },
    );
    expect(sinHttps.blame).toBe("address");

    // La dirección llega —los datos de la ficha han venido por ella—: el que
    // falta es este archivo.
    const yaNo = attachmentFailure("https://api.tudominio.com/api/storage/a", {
      apiUrl: "https://api.tudominio.com",
      pageProtocol: "https:",
    });
    expect(yaNo.blame).toBe("file");
  });
});

describe("AttachmentImage", () => {
  test("pinta la foto mientras se puede abrir", async () => {
    const container = await mount(
      <AttachmentImage
        url="https://api.tudominio.com/api/storage/a"
        name="Filtro roto"
        layout="cell"
        link
      />,
    );
    const picture = container.querySelector("img");
    expect(picture?.getAttribute("src")).toBe(
      "https://api.tudominio.com/api/storage/a",
    );
    expect(picture?.getAttribute("alt")).toBe("Filtro roto");
    expect(container.querySelector("a")?.getAttribute("href")).toBe(
      "https://api.tudominio.com/api/storage/a",
    );
  });

  test("en la rejilla, el hueco pasa a decir por qué no se abre", async () => {
    const container = await mount(
      <AttachmentImage
        url="https://files.ejemplo.com/foto.jpg"
        name="Filtro roto"
        layout="cell"
        link
        apiUrl="https://api.tudominio.com"
      />,
    );
    await breakPicture(container);

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toContain("No se abre");
    expect(container.textContent).toContain("Otra dirección");
    expect(container.textContent).toContain("Reintentar");
    // El porqué largo cabe en el tooltip del hueco.
    expect(
      container.querySelector('[role="status"]')?.getAttribute("title"),
    ).toContain("https://files.ejemplo.com");
  });

  test("«Reintentar» vuelve a pedir la foto, y con dirección nueva", async () => {
    const container = await mount(
      <AttachmentImage
        url="https://files.ejemplo.com/foto.jpg"
        name="Filtro roto"
        layout="cell"
      />,
    );
    await breakPicture(container);
    expect(container.querySelector("img")).toBeNull();

    await press(container, "Reintentar");
    const picture = container.querySelector("img");
    expect(picture).not.toBeNull();
    // Sin el número del intento detrás, el navegador podría contestar con el
    // error que ya tenía guardado.
    expect(picture?.getAttribute("src")).toContain("reintento=1");
  });

  test("dentro de un texto, la explicación se lee entera", async () => {
    const container = await mount(
      <AttachmentImage
        url="http://192.168.1.10:3210/api/storage/a"
        name="Etiqueta del motor"
        layout="block"
        pageProtocol="https:"
      />,
    );
    await breakPicture(container);

    expect(container.textContent).toContain("No se abre «Etiqueta del motor»");
    expect(container.textContent).toContain("contenido mixto");
    expect(container.textContent).toContain(
      "http://192.168.1.10:3210/api/storage/a",
    );
    expect(container.querySelector("a")?.getAttribute("href")).toBe(
      "http://192.168.1.10:3210/api/storage/a",
    );
  });

  test("al cambiar de foto, el aviso de la anterior no se queda", async () => {
    const container = await mount(
      <AttachmentImage
        url="https://x.ejemplo.com/a.jpg"
        name="Una"
        layout="cell"
      />,
    );
    await breakPicture(container);
    expect(container.textContent).toContain("No se abre");

    const root = roots[roots.length - 1];
    await act(async () => {
      root.render(
        <AttachmentImage
          url="https://x.ejemplo.com/b.jpg"
          name="Otra"
          layout="cell"
        />,
      );
    });
    await settle();

    expect(container.textContent).not.toContain("No se abre");
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "https://x.ejemplo.com/b.jpg",
    );
  });

  test("un documento sin archivo lo dice, en vez de dejar el hueco vacío", async () => {
    const container = await mount(
      <AttachmentImage url={undefined} name="Presupuesto" layout="cell" />,
    );
    expect(container.textContent).toContain("Sin archivo");
    expect(container.querySelector("img")).toBeNull();
  });
});

describe("AttachmentImage en una fila de lista", () => {
  /** La miniatura de una fila: el mismo hueco de 40 px de la papelera. */
  const thumb = "size-10 shrink-0 overflow-hidden rounded-md border";

  test("mientras la foto se abre, es la miniatura de siempre", async () => {
    const container = await mount(
      <AttachmentImage
        url="https://api.tudominio.com/api/storage/a"
        name=""
        layout="row"
        frameClassName={thumb}
        imageClassName="size-full object-cover"
      />,
    );

    const frame = container.firstElementChild;
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "https://api.tudominio.com/api/storage/a",
    );
    expect(frame?.className).toContain(thumb);
    // Nada de aviso: la foto está.
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  test("si no se abre, la miniatura deja su sitio al aviso entero", async () => {
    const container = await mount(
      <AttachmentImage
        url="https://files.ejemplo.com/foto.jpg"
        name=""
        layout="row"
        apiUrl="https://api.tudominio.com"
        frameClassName={thumb}
        imageClassName="size-full object-cover"
      />,
    );
    await breakPicture(container);

    expect(container.querySelector("img")).toBeNull();
    // El aviso entero: qué no se abre, por qué y dónde —aquí sí cabe—.
    expect(container.textContent).toContain("No se abre");
    expect(container.textContent).toContain("dos direcciones distintas");
    expect(container.textContent).toContain("https://files.ejemplo.com");
    expect(container.textContent).toContain("Reintentar");
    // El aviso no lleva el marco pequeño —no cabría— y se pone detrás de lo que
    // ya contaba la fila, a lo ancho de toda ella.
    const notice = container.querySelector('[role="status"]');
    expect(notice?.className).not.toContain("size-10");
    expect(container.firstElementChild?.className).toContain("order-last");
    expect(container.firstElementChild?.className).toContain("w-full");
  });

  test("«Reintentar» vuelve a pedir la foto desde la propia fila", async () => {
    const container = await mount(
      <AttachmentImage
        url="https://files.ejemplo.com/foto.jpg"
        name=""
        layout="row"
        frameClassName={thumb}
      />,
    );
    await breakPicture(container);

    await press(container, "Reintentar");

    expect(container.querySelector("img")?.getAttribute("src")).toContain(
      "reintento=1",
    );
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  test("sin archivo lo dice con la explicación entera, y sin mandar a abrir nada", async () => {
    const container = await mount(
      <AttachmentImage
        url={undefined}
        name=""
        layout="row"
        frameClassName={thumb}
      />,
    );

    expect(container.textContent).toContain("Sin archivo");
    expect(container.textContent).toContain("la limpieza");
    // Ni botón de reintentar ni dirección que abrir: no hay archivo.
    expect(container.querySelector("button")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });
});
