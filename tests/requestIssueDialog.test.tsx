// @vitest-environment jsdom
// El material de una petición sale de una en una: el diálogo de entrega pone una
// cantidad por línea y manda solo lo que se entrega en esa tanda. Aquí se
// comprueba lo que se manda —que es lo que el técnico recibe—, no la pantalla de
// la cola; lo que hace el servidor con cada tanda está en tests/repuestos.test.ts.
import { settle } from "./settle";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

const { ENVIADO } = vi.hoisted(() => ({
  /** Lo que el diálogo ha mandado al backend, en orden. */
  ENVIADO: [] as { nombre: string; args: Record<string, unknown> }[],
}));

vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  return {
    useQuery: () => undefined,
    // El editor de la nota usa una acción para subir imágenes (lo mismo que en
    // el formulario público): aquí no se sube nada.
    useAction: () => async () => undefined,
    useMutation:
      (reference: unknown) => async (args: Record<string, unknown>) => {
        ENVIADO.push({ nombre: getFunctionName(reference as never), args });
        return undefined;
      },
  };
});

import type { Doc } from "@/convex/_generated/dataModel";
import { DecisionDialog } from "@/pages/dashboard/requests/dialogs/DecisionDialog";

const AYER = Date.parse("2026-10-01T09:00:00.000Z");

/** Una petición aprobada con dos líneas: 5 fuentes y 2 filtros. */
function peticion(
  extra: Partial<Doc<"partRequests">> = {},
): Doc<"partRequests"> {
  return {
    _id: "pet-1",
    _creationTime: AYER,
    reference: "PET-0001",
    requesterName: "Sandra Ruiz",
    priority: "normal",
    status: "approved",
    lines: [
      {
        sparePartId: "part-1",
        code: "ALI-12024",
        name: "Fuente de alimentación 12 V",
        quantity: 5,
      },
      {
        sparePartId: "part-2",
        code: "FIL-00042",
        name: "Filtro de aire",
        quantity: 2,
      },
    ],
    attachments: [],
    createdAt: AYER,
    ...extra,
  } as unknown as Doc<"partRequests">;
}

/** Lo que jsdom no trae y Radix da por hecho al abrir el diálogo. */
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
      }) as unknown as MediaQueryList;
  }
  if (!("ResizeObserver" in window)) {
    (window as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  const proto = Element.prototype as unknown as Record<string, unknown>;
  proto.hasPointerCapture ??= () => false;
  proto.setPointerCapture ??= () => {};
  proto.releasePointerCapture ??= () => {};
  proto.scrollIntoView ??= () => {};
}

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  installMissingDomApis();
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  ENVIADO.length = 0;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  // El diálogo se pinta en un portal colgado del cuerpo: se limpia para que la
  // prueba siguiente no lea lo de esta.
  document.body.innerHTML = "";
});

/** Monta el diálogo de entrega de esa petición. */
async function abrirEntrega(request: Doc<"partRequests">) {
  await act(async () => {
    root.render(
      <DecisionDialog
        request={request}
        mode="issue"
        parts={[]}
        canPurchase={false}
        onClose={() => undefined}
      />,
    );
  });
  await settle();
}

/** Los campos de cantidad, en el orden en que se pintan. */
function cantidadInputs() {
  return [...document.querySelectorAll<HTMLInputElement>("input[type=number]")];
}

/** El botón que confirma la entrega. */
function botonEntregar() {
  return [...document.querySelectorAll("button")].find(
    (candidate) => (candidate.textContent ?? "").trim() === "Entregar",
  );
}

/** Escribe una cantidad en el campo de esa línea, como tecleando. */
async function escribirCantidad(index: number, value: string) {
  const input = cantidadInputs()[index];
  act(() => {
    // React escucha el cambio a través del setter nativo del prototipo: es la
    // forma de escribir en un input controlado desde una prueba.
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await settle();
}

describe("entregar el material de una petición, línea a línea", () => {
  test("arranca con todo lo que queda, para poder entregarlo entero de una vez", async () => {
    await abrirEntrega(peticion());

    const texto = document.body.textContent ?? "";
    expect(texto).toContain("Qué se entrega en esta tanda");
    expect(texto).toContain("Fuente de alimentación 12 V");
    expect(texto).toContain("quedan 5 por entregar");
    expect(texto).toContain("quedan 2 por entregar");
    expect(cantidadInputs().map((input) => input.value)).toEqual(["5", "2"]);

    act(() => (botonEntregar() as HTMLButtonElement).click());
    await settle();

    // Un solo paso, con las dos líneas enteras: lo que hacía el botón de antes.
    expect(ENVIADO).toEqual([
      {
        nombre: "partRequests:issueLines",
        args: {
          requestId: "pet-1",
          lines: [
            { sparePartId: "part-1", quantity: 5 },
            { sparePartId: "part-2", quantity: 2 },
          ],
        },
      },
    ]);
  });

  test("entregar una pieza suelta manda solo esa cantidad", async () => {
    // Lo de «de una en uno»: se baja el resto a cero y se entrega una unidad.
    await abrirEntrega(peticion());

    await escribirCantidad(0, "1");
    await escribirCantidad(1, "0");
    act(() => (botonEntregar() as HTMLButtonElement).click());
    await settle();

    expect(ENVIADO).toHaveLength(1);
    expect(ENVIADO[0].args).toEqual({
      requestId: "pet-1",
      lines: [{ sparePartId: "part-1", quantity: 1 }],
    });
  });

  test("una entrega a medias solo cuenta lo que falta", async () => {
    // Dos fuentes ya entregadas de las cinco: el campo arranca en lo que queda,
    // que es lo único que se puede entregar.
    await abrirEntrega(
      peticion({
        lines: [
          {
            sparePartId: "part-1",
            code: "ALI-12024",
            name: "Fuente de alimentación 12 V",
            quantity: 5,
            deliveredQuantity: 2,
            deliveredAt: AYER,
          },
          {
            sparePartId: "part-2",
            code: "FIL-00042",
            name: "Filtro de aire",
            quantity: 2,
            deliveredQuantity: 2,
            deliveredAt: AYER,
          },
        ],
      }),
    );

    const texto = document.body.textContent ?? "";
    expect(texto).toContain("quedan 3 por entregar");
    // Una línea ya entregada no se puede volver a entregar: queda apagada.
    expect(texto).toContain("ya está entregado");
    expect(cantidadInputs()[1].disabled).toBe(true);
    // La que queda entera por entregar arranca en lo que falta, y la ya entregada
    // no puede pedir nada.
    expect(cantidadInputs().map((input) => input.value)).toEqual(["3", "0"]);

    act(() => (botonEntregar() as HTMLButtonElement).click());
    await settle();

    expect(ENVIADO[0].args).toEqual({
      requestId: "pet-1",
      lines: [{ sparePartId: "part-1", quantity: 3 }],
    });
  });

  test("no se entrega de más: el campo se corta en lo que queda", async () => {
    await abrirEntrega(peticion());

    await escribirCantidad(0, "9");

    expect(cantidadInputs()[0].value).toBe("5");
  });

  test("una tanda en cero no es una entrega, y el botón lo dice", async () => {
    await abrirEntrega(peticion());

    await escribirCantidad(0, "0");
    await escribirCantidad(1, "0");

    expect((botonEntregar() as HTMLButtonElement).disabled).toBe(true);
    act(() => (botonEntregar() as HTMLButtonElement).click());
    await settle();
    expect(ENVIADO).toEqual([]);
  });
});
