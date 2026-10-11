// @vitest-environment jsdom
// mocking de convex/react, del backend y de la sesión *antes* de que el
// componente los importe
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/** Una conversación sin leer, de Iván hacia mí (u1), que es lo que pinta la lista. */
const { MENSAJES, CONTACTOS } = vi.hoisted(() => ({
  MENSAJES: [
    {
      _id: "m1",
      senderId: "u2",
      recipientId: "u1",
      senderName: "Iván Torres",
      recipientName: "Elena Vidal",
      text: "¿Me pasas el cable SDI del plató 2?",
      read: false,
      createdAt: Date.parse("2026-10-11T09:00:00.000Z"),
    },
  ],
  CONTACTOS: [
    { _id: "u2", name: "Iván Torres", position: "Cámara", role: "technician" },
  ],
}));

// El backend entero, de mentira: solo se usan los mensajes, y las funciones que
// el editor lleva colgadas (imágenes) no llegan a llamarse porque el chat y el
// diálogo de «nuevo mensaje» no se abren en estas pruebas.
vi.mock("@/convex/_generated/api", () => ({
  api: {
    messages: {
      list: { nombre: "messages.list" },
      contacts: { nombre: "messages.contacts" },
      thread: { nombre: "messages.thread" },
      send: { nombre: "messages.send" },
      markThreadRead: { nombre: "messages.markThreadRead" },
    },
    uploads: {
      generateImageUploadUrl: { nombre: "uploads.generateImageUploadUrl" },
      imageUrl: { nombre: "uploads.imageUrl" },
    },
    reportUploads: {
      generateUploadUrl: { nombre: "reportUploads.generateUploadUrl" },
      attachImage: { nombre: "reportUploads.attachImage" },
    },
  },
}));

vi.mock("convex/react", async () => {
  const { api } = await import("@/convex/_generated/api");
  return {
    useQuery: (query: unknown) =>
      query === api.messages.list
        ? MENSAJES
        : query === api.messages.contacts
          ? CONTACTOS
          : undefined,
    useMutation: () => async () => {},
    useAction: () => async () => ({}),
  };
});

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { _id: "u1", name: "Elena Vidal" } }),
}));

import { MessagesCenter } from "@/components/MessagesCenter";

/**
 * El desplegable de la lista de conversaciones (el icono del sobre). Lo que se
 * comprueba es el **anclaje a la ventana**, el mismo que lleva la campana de
 * avisos: el panel va en `fixed` y sus coordenadas salen de medir el botón, así
 * que quien lo rodea —el panel lateral del menú, que recorta con
 * `overflow-hidden`, o una cabecera pegajosa— no puede cortarlo; y si la ventana
 * es estrecha, se encoge en vez de salirse. La lista se desplaza **dentro** del
 * panel, que es lo que impide que un hilo más largo lo saque de la ventana.
 *
 * Se monta a mano con React y jsdom, como el resto de pruebas de componente; los
 * mensajes llegan del backend con los hooks de Convex, así que aquí se
 * sustituyen por una conversación fija: lo que importa es dónde queda el panel,
 * no cómo conversa con el backend.
 */

let roots: Root[] = [];
/** La medida que devuelve el botón del icono (jsdom no calcula ninguna). */
let boton: DOMRect;

/** Un rectángulo con lo único que se lee del botón: dónde acaba por abajo y por
 * la derecha. */
function rectangulo(bottom: number, right: number): DOMRect {
  return {
    x: 0,
    y: bottom,
    top: bottom,
    left: 0,
    right,
    bottom,
    width: right,
    height: bottom,
    toJSON: () => ({}),
  } as DOMRect;
}

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  document.body.innerHTML = "";
  roots = [];
  boton = rectangulo(52, 476);

  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      return this.tagName === "BUTTON" ? boton : rectangulo(0, 0);
    },
  );
});

afterEach(async () => {
  await act(async () => {
    for (const root of roots) root.unmount();
  });
  roots = [];
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

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

/** Abre la lista pulsando el icono de mensajes. */
async function abrir(container: HTMLElement) {
  const button = container.querySelector<HTMLButtonElement>("button");
  expect(button, "no hay icono de mensajes que pulsar").not.toBeNull();
  await act(async () => {
    button!.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }),
    );
  });
  await settle();
}

/** El panel abierto; falla si no se abrió. */
function panel(container: HTMLElement): Element {
  const encontrado = container.querySelector('[role="dialog"]');
  expect(encontrado, "la lista no se abrió").not.toBeNull();
  return encontrado!;
}

/** Su `style`, tal y como lo escribe React. */
function estilo(container: HTMLElement): string {
  return panel(container).getAttribute("style") ?? "";
}

/**
 * jsdom no lleva viewport real; se le dice cuánto mide la ventana con las
 * propiedades que el anclaje lee para colocar y acotar el panel.
 */
function jsdomViewport(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", {
    value: width,
    configurable: true,
  });
  Object.defineProperty(window, "innerHeight", {
    value: height,
    configurable: true,
  });
}

describe("desplegable de mensajes — anclaje a la ventana", () => {
  test("se cuelga de la ventana y no lo corta el panel que lo contiene", async () => {
    // Un contenedor que recorta (como el <aside> del menú, con
    // `overflow-hidden`) y más estrecho que el propio panel: colocado con
    // `absolute` dentro, lo habría cortado.
    const container = await mount(
      <div
        style={{ width: 180, height: 60, overflow: "hidden", padding: 8 }}
        data-testid="panel-estrecho"
      >
        <MessagesCenter />
      </div>,
    );

    jsdomViewport(480, 320);
    await abrir(container);

    const style = estilo(container);
    expect(style).toContain("position: fixed");
    // Justo debajo del botón (52 + 8) y dentro de la ventana: acaba donde el
    // botón (476) sin pasarse del margen de la derecha (480 − 8).
    expect(style).toContain("top: 60px");
    expect(style).toContain("left: 152px");
    expect(style).toContain("width: 320px");
    // Y sin pasarse de la ventana por abajo: 320 − 60 − 8.
    expect(style).toContain("max-height: 252px");
  });

  test("en una ventana estrecha se encoge en vez de salirse", async () => {
    const container = await mount(<MessagesCenter />);

    jsdomViewport(300, 320);
    await abrir(container);

    const style = estilo(container);
    // 300 − 16 de margen: lo que da la ventana. El ancho pedido no cabe.
    expect(style).toContain("width: 284px");
    // Y el botón (476) está fuera de esa ventana: el panel se desplaza al borde
    // en vez de salirse por la derecha.
    expect(style).toContain("left: 8px");
  });

  test("al desplazarse la página, el panel se recoloca con su botón", async () => {
    const container = await mount(<MessagesCenter />);

    jsdomViewport(480, 600);
    await abrir(container);
    expect(estilo(container)).toContain("top: 60px");

    // El botón vive en una cabecera pegajosa: al bajar por la página se va con
    // ella y su borde inferior acaba más abajo.
    boton = rectangulo(120, 476);
    await act(async () => {
      window.dispatchEvent(new Event("scroll"));
    });
    await settle();

    expect(estilo(container)).toContain("top: 128px");
  });

  test("el panel es el de siempre: la conversación, con su scroll dentro", async () => {
    const container = await mount(<MessagesCenter />);

    jsdomViewport(480, 320);
    await abrir(container);

    const lista = panel(container);
    expect(lista.textContent).toContain("Mensajes");
    expect(lista.textContent).toContain("Iván Torres");
    expect(lista.textContent).toContain("¿Me pasas el cable SDI del plató 2?");
    // Lo que no cabe se desplaza **dentro** del panel: si la lista creciera, el
    // panel se saldría por abajo en vez de recortarla.
    const hilos = lista.querySelector("ul");
    expect(hilos, "la lista de conversaciones no está").not.toBeNull();
    expect(hilos!.className).toContain("overflow-y-auto");
    expect(hilos!.className).toContain("min-h-0");
  });

  test("el clic fuera sigue cerrando la lista", async () => {
    const container = await mount(<MessagesCenter />);

    jsdomViewport(480, 320);
    await abrir(container);
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();

    await act(async () => {
      document.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
      );
    });
    await settle();

    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
});
