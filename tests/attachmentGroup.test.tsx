// @vitest-environment jsdom
import { settle } from "./settle";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { AttachmentGroup } from "@/components/AttachmentGroup";
import { AttachmentImage } from "@/components/AttachmentImage";

/**
 * El aviso de la dirección pública, una vez por ficha y no una por foto.
 *
 * Se monta a mano con React y jsdom, como el resto de pruebas de componente del
 * taller: no hay navegador que cargue imágenes, así que el fallo se le cuenta a
 * cada foto tal y como se lo cuenta el navegador —un `error` en el elemento—, y a
 * partir de ahí se mira lo que de verdad importa: cuántas veces se lee el porqué,
 * qué queda en cada hueco y que se puedan volver a pedir todas de una vez.
 *
 * Las dos direcciones de los casos son las de siempre: `files.ejemplo.com` es
 * otro dominio —la avería clásica del NAS, que rompe todas las fotos a la vez— y
 * la misma dirección de la API con un archivo que ya no está, que solo rompe una.
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

/** Todas las fotos piden su dirección y el navegador contesta que no llegan. */
async function breakPictures(container: HTMLElement) {
  const pictures = [...container.querySelectorAll("img")];
  expect(
    pictures.length,
    "tienen que estar las fotos antes de fallar",
  ).toBeGreaterThan(0);
  await act(async () => {
    for (const picture of pictures) {
      picture.dispatchEvent(new Event("error"));
    }
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

/** Dos fotos de la misma ficha, las dos servidas desde el mismo sitio. */
function twoPictures(apiUrl: string, base: string) {
  return (
    <AttachmentGroup>
      <AttachmentImage
        url={`${base}/a.jpg`}
        name="Una"
        layout="cell"
        apiUrl={apiUrl}
      />
      <AttachmentImage
        url={`${base}/b.jpg`}
        name="Otra"
        layout="cell"
        apiUrl={apiUrl}
      />
    </AttachmentGroup>
  );
}

describe("el grupo de fotos de una ficha", () => {
  test("con varias fotos, el porqué de la dirección se dice una vez", async () => {
    const container = await mount(
      twoPictures("https://api.tudominio.com", "https://files.ejemplo.com"),
    );
    await breakPictures(container);

    // Un solo aviso —el del grupo—, con el porqué entero dentro.
    const notices = container.querySelectorAll('[role="status"]');
    expect(notices).toHaveLength(1);
    expect(notices[0].textContent).toContain("No llegan las fotos");
    expect(notices[0].textContent).toContain("dos direcciones distintas");
    // Y una sola vez en toda la pantalla, no una por hueco.
    expect(
      container.textContent?.match(/dos direcciones distintas/g),
    ).toHaveLength(1);

    // Los huecos se quedan con su icono y sin repetir nada de eso.
    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(container.textContent).not.toContain("No se abre");
    expect(container.querySelectorAll("button")).toHaveLength(1);
  });

  test("«Reintentar las fotos» vuelve a pedirlas todas, con dirección nueva", async () => {
    const container = await mount(
      twoPictures("https://api.tudominio.com", "https://files.ejemplo.com"),
    );
    await breakPictures(container);

    await press(container, "Reintentar las fotos");

    const sources = [...container.querySelectorAll("img")].map((picture) =>
      picture.getAttribute("src"),
    );
    expect(sources).toHaveLength(2);
    // Sin el número del intento detrás, el navegador podría contestar con el
    // error que ya tenía guardado.
    expect(sources.every((source) => source?.includes("reintento=1"))).toBe(
      true,
    );
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  test("con una sola foto el aviso se queda en su hueco, con su nombre", async () => {
    const container = await mount(
      <AttachmentGroup>
        <AttachmentImage
          url="https://files.ejemplo.com/a.jpg"
          name="Filtro roto"
          layout="block"
          apiUrl="https://api.tudominio.com"
        />
      </AttachmentGroup>,
    );
    await breakPictures(container);

    // Con una no hay repetición que evitar: el aviso se queda donde estaba.
    expect(container.textContent).toContain("No se abre «Filtro roto»");
    expect(container.textContent).not.toContain("No llegan las fotos");
  });

  test("lo que es de un archivo y no de la dirección no sube al grupo", async () => {
    const container = await mount(
      twoPictures("https://api.tudominio.com", "https://api.tudominio.com"),
    );
    await breakPictures(container);

    // La dirección llega —por ella han venido los datos de la ficha—: lo que
    // falta es cada archivo, y eso solo lo dice su hueco.
    expect(container.textContent).not.toContain("No llegan las fotos");
    expect(container.querySelectorAll('[role="status"]')).toHaveLength(2);
    expect(container.textContent).toContain("Ya no está");
  });

  test("sin grupo, cada foto cuenta lo suyo como siempre", async () => {
    const container = await mount(
      <AttachmentImage
        url="https://files.ejemplo.com/a.jpg"
        name="Filtro roto"
        layout="block"
        apiUrl="https://api.tudominio.com"
      />,
    );
    await breakPictures(container);

    expect(container.textContent).toContain("No se abre «Filtro roto»");
    expect(container.textContent).toContain("dos direcciones distintas");
  });
});
