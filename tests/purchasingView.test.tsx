// @vitest-environment jsdom
// Se sustituyen el backend y los hooks de Convex *antes* de que el componente
// los importe: lo que se comprueba es la pantalla, no la conversación con el
// servidor (esa está en tests/compras.test.ts).
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

const { CREADAS, RECIBIDAS, APARTADAS, DATOS } = vi.hoisted(() => ({
  CREADAS: [] as unknown[],
  RECIBIDAS: [] as unknown[],
  APARTADAS: [] as unknown[],
  // Lo que el backend de mentira sirve a cada consulta del módulo.
  DATOS: {
    purchaseRequests: [] as unknown[],
    orders: [] as unknown[],
    receptions: [] as unknown[],
    partRequests: [] as unknown[],
    parts: [] as unknown[],
  },
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    purchasing: {
      listPurchaseRequests: { nombre: "purchasing.listPurchaseRequests" },
      listOrders: { nombre: "purchasing.listOrders" },
      listReceptions: { nombre: "purchasing.listReceptions" },
      requestPurchase: { nombre: "purchasing.requestPurchase" },
      requestPurchases: { nombre: "purchasing.requestPurchases" },
      setSupplier: { nombre: "purchasing.setSupplier" },
      setNote: { nombre: "purchasing.setNote" },
      cancelPurchaseRequest: { nombre: "purchasing.cancelPurchaseRequest" },
      createOrder: { nombre: "purchasing.createOrder" },
      setLineNote: { nombre: "purchasing.setLineNote" },
      receive: { nombre: "purchasing.receive" },
      cancelOrder: { nombre: "purchasing.cancelOrder" },
      generateUploadUrl: { nombre: "purchasing.generateUploadUrl" },
    },
    partRequests: { list: { nombre: "partRequests.list" } },
    spareParts: { list: { nombre: "spareParts.list" } },
  },
}));

vi.mock("convex/react", async () => {
  const { api } = await import("@/convex/_generated/api");
  return {
    // El módulo carga sus listas: se le sirve lo que la prueba haya puesto.
    useQuery: (query: unknown) => {
      if (query === api.purchasing.listPurchaseRequests) {
        return { requests: DATOS.purchaseRequests, groups: [] };
      }
      if (query === api.purchasing.listOrders) return DATOS.orders;
      if (query === api.purchasing.listReceptions) return DATOS.receptions;
      if (query === api.partRequests.list) return DATOS.partRequests;
      if (query === api.spareParts.list) return DATOS.parts;
      return undefined;
    },
    useMutation: (mutation: unknown) => async (args: unknown) => {
      if (mutation === api.purchasing.createOrder) {
        CREADAS.push(args);
        return { reference: "OC-0001", orderId: "order-1", lines: 1 };
      }
      if (mutation === api.purchasing.receive) {
        RECIBIDAS.push(args);
        return { status: "completed", received: [], materialReceived: [] };
      }
      if (mutation === api.purchasing.requestPurchases) {
        APARTADAS.push(args);
        return {
          references: ["PC-0001", "PC-0002"],
          requests: 2,
          repeated: 0,
          skipped: [],
        };
      }
      return undefined;
    },
  };
});

import { PurchasingView } from "@/pages/dashboard/PurchasingView";

/** Lo que jsdom no trae y Radix da por hecho al abrir diálogos y hojas. */
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
  // Sin esto React avisa en cada `act`: jsdom no es un navegador y hay que
  // decirle que las actualizaciones son las de una prueba (como en el resto de
  // las pruebas de componente del repositorio).
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  installMissingDomApis();
  CREADAS.length = 0;
  RECIBIDAS.length = 0;
  APARTADAS.length = 0;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/** Una petición de compra sin tratar, con lo justo que pinta la pantalla. */
function compra(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: `pc-${overrides.reference ?? "0001"}`,
    reference: "PC-0001",
    requestId: "req-1",
    requestReference: "PET-0007",
    requestDate: Date.parse("2026-10-01T09:00:00.000Z"),
    requesterName: "Teo Técnico",
    sparePartId: "part-1",
    code: "ALI-24015",
    name: "Fuente de alimentación",
    unit: "ud",
    quantity: 3,
    supplier: "Electro Suministros",
    status: "pending",
    reason: "noStock",
    requestedAt: Date.parse("2026-10-02T09:00:00.000Z"),
    requestedBy: "Rita Repuestos",
    createdAt: Date.parse("2026-10-02T09:00:00.000Z"),
    ...overrides,
  } as never;
}

const orden = {
  _id: "order-1",
  reference: "OC-0001",
  supplier: "Electro Suministros",
  status: "partial",
  orderedAt: Date.parse("2026-10-03T09:00:00.000Z"),
  orderedBy: "Rita Repuestos",
  requestRefs: [{ reference: "PET-0007", requestedAt: 1 }],
  lines: [
    {
      purchaseRequestId: "pc-0001",
      requestId: "req-1",
      requestReference: "PET-0007",
      requestDate: 1,
      sparePartId: "part-1",
      code: "ALI-24015",
      name: "Fuente de alimentación",
      unit: "ud",
      quantity: 3,
      receivedQuantity: 1,
      note: "Confirmar el plazo",
    },
  ],
  createdAt: 1,
  updatedAt: 1,
} as never;

/** La misma orden, ya cerrada: es la que llega entera al almacén. */
function ordenCompletada() {
  return {
    ...(orden as unknown as Record<string, unknown>),
    status: "completed",
    lines: [
      {
        purchaseRequestId: "pc-0001",
        requestId: "req-1",
        requestReference: "PET-0007",
        requestDate: 1,
        sparePartId: "part-1",
        code: "ALI-24015",
        name: "Fuente de alimentación",
        unit: "ud",
        quantity: 3,
        receivedQuantity: 3,
      },
    ],
  } as never;
}

function pintar(
  props: {
    purchaseRequests?: unknown[];
    orders?: unknown[];
    receptions?: unknown[];
    partRequests?: unknown[];
    parts?: unknown[];
  } = {},
) {
  DATOS.purchaseRequests = props.purchaseRequests ?? [compra()];
  DATOS.orders = props.orders ?? [];
  DATOS.receptions = props.receptions ?? [];
  DATOS.partRequests = props.partRequests ?? [];
  DATOS.parts = props.parts ?? [];
  act(() => {
    root.render(<PurchasingView canManage />);
  });
}

/** El botón cuyo texto empieza por lo que se busca. */
function boton(texto: string): HTMLButtonElement {
  const encontrado = [...document.querySelectorAll("button")].find((button) =>
    (button.textContent ?? "").trim().startsWith(texto),
  );
  if (!encontrado)
    throw new Error(`No hay ningún botón que empiece por «${texto}»`);
  return encontrado as HTMLButtonElement;
}

/** Una petición de repuesto a la que el almacén no cubre, con su línea. */
function peticionSinMaterial(reference: string, id: string) {
  return {
    _id: id,
    reference,
    requesterName: "Teo Técnico",
    requesterTeam: "Plató 1",
    priority: "normal",
    status: "pending",
    createdAt: Date.parse("2026-10-01T09:00:00.000Z"),
    attachments: [],
    lines: [
      {
        sparePartId: "part-1",
        code: "ALI-24015",
        name: "Fuente de alimentación",
        unit: "ud",
        quantity: 2,
      },
    ],
  } as never;
}

describe("el módulo de compras, pintado", () => {
  test("«Sin material» aparta varias peticiones de una vez", () => {
    // Antes había un botón idéntico por fila: para nueve líneas, nueve clics y
    // nueve esperas. Ahora se marcan y van en una sola llamada.
    pintar({
      // Sin compras vivas: las dos peticiones están esperando que alguien las aparte.
      purchaseRequests: [],
      partRequests: [
        peticionSinMaterial("PET-0001", "req-1"),
        peticionSinMaterial("PET-0002", "req-2"),
      ],
    });

    expect(document.body.textContent).toContain("Sin material en el almacén");
    expect(document.body.textContent).toContain("PET-0001");
    // Sin marcar nada no hay nada que apartar.
    expect(boton("Apartar las marcadas").disabled).toBe(true);

    act(() => boton("Marcar todas").click());
    // El botón dice cuántas van, para no apartar de más.
    expect(document.body.textContent).toContain("Apartar 2 peticiones");
    act(() => boton("Apartar 2 peticiones").click());

    expect(APARTADAS).toHaveLength(1);
    expect(APARTADAS[0]).toMatchObject({ requestIds: ["req-1", "req-2"] });
  });

  test("lo que está sin tratar se agrupa por proveedor y se elige para la orden", () => {
    pintar({
      purchaseRequests: [
        compra({ reference: "PC-0001" }),
        compra({
          reference: "PC-0002",
          _id: "pc-0002",
          supplier: "Ferretería Norte",
          code: "TOR-1",
          name: "Tornillería",
        }),
      ],
    });
    const texto = document.body.textContent ?? "";
    expect(texto).toContain("Electro Suministros");
    expect(texto).toContain("Ferretería Norte");
    expect(texto).toContain("1 petición · 1 artículo · 3 ud");
    expect(texto).toContain("PET-0007");

    // Sin marcar nada no hay orden que montar.
    expect(boton("Crear orden de compra").disabled).toBe(true);
    expect(texto).toContain("Marca lo que va en la orden");

    // Al marcar una línea se puede montar la orden de ese proveedor.
    const casilla = document.querySelector('[role="checkbox"]') as HTMLElement;
    act(() => casilla.click());
    expect(boton("Crear orden de compra").disabled).toBe(false);

    act(() => boton("Crear orden de compra").click());
    expect(document.body.textContent).toContain(
      "Orden de compra · Electro Suministros",
    );
  });

  test("la orden se crea con lo elegido y su nota por artículo", () => {
    pintar();
    const casilla = document.querySelector('[role="checkbox"]') as HTMLElement;
    act(() => casilla.click());
    act(() => boton("Crear orden de compra").click());

    const nota = [...document.querySelectorAll("input")].find(
      (input) => input.placeholder === "Nota de este artículo",
    );
    expect(nota).toBeDefined();
    // React 19 no escucha un cambio de valor a pelo: hay que escribir por el
    // mismo camino que el navegador (el «setter» nativo) para que se entere.
    act(() => {
      const escribir = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      escribir?.call(nota, "Pedir el modelo nuevo");
      (nota as HTMLInputElement).dispatchEvent(
        new Event("input", { bubbles: true }),
      );
    });

    act(() => boton("Crear la orden").click());
    expect(CREADAS).toHaveLength(1);
    expect(CREADAS[0]).toMatchObject({
      purchaseRequestIds: ["pc-0001"],
      lineNotes: { "pc-0001": "Pedir el modelo nuevo" },
    });
  });

  test("las órdenes enseñan lo que ha llegado y dejan recepcionar", () => {
    pintar({
      orders: [orden],
      receptions: [
        {
          _id: "rec-1",
          orderId: "order-1",
          orderReference: "OC-0001",
          supplier: "Electro Suministros",
          lines: [
            {
              sparePartId: "part-1",
              code: "ALI-24015",
              name: "Fuente de alimentación",
              quantity: 1,
            },
          ],
          deliveryNote: {
            storageId: "st-1",
            name: "albaran.pdf",
            kind: "document",
          },
          deliveryNoteUrl: "https://ejemplo.test/albaran.pdf",
          receivedBy: "Rita Repuestos",
          receivedAt: Date.parse("2026-10-04T09:00:00.000Z"),
        },
      ] as never,
    });

    act(() => boton("Órdenes de compra").click());
    const listado = document.body.textContent ?? "";
    expect(listado).toContain("OC-0001");
    expect(listado).toContain("1/3 ud recibidas");
    expect(listado).toContain("Parcial");

    // La ficha de la orden: sus artículos con la nota y lo que ha entrado.
    act(() => boton("Ver la orden").click());
    const ficha = document.body.textContent ?? "";
    expect(ficha).toContain("Confirmar el plazo");
    expect(ficha).toContain("Desde PET-0007");
    expect(ficha).toContain("albaran.pdf");

    // Y desde ahí se recepciona: se abre el diálogo con el albarán pedido.
    act(() => boton("Recepcionar material").click());
    expect(document.body.textContent).toContain("Recepcionar OC-0001");
    expect(document.body.textContent).toContain("faltan 2 ud");
    // Sin albarán no se da la entrada.
    expect(boton("Dar entrada").disabled).toBe(true);

    act(() => boton("Recepciones").click());
    expect(document.body.textContent).toContain("albaran.pdf");
  });

  test("la ficha de la orden explica su recorrido y qué toca ahora", () => {
    pintar({ orders: [orden] });
    act(() => boton("Órdenes de compra").click());
    act(() => boton("Ver la orden").click());

    const ficha = document.body.textContent ?? "";
    expect(
      document.querySelector('[aria-label="Recorrido de la orden de compra"]'),
    ).not.toBeNull();
    // El «Ahora» se pinta en dos trozos (la etiqueta y el estado), así que se
    // comprueban por separado, como los lee un lector de pantalla.
    expect(ficha).toContain("Ahora (paso 2 de 3):");
    expect(ficha).toContain("Parcial · 1/3 ud");
    expect(ficha).toContain("Siguiente:");
    expect(ficha).toContain("Recepcionar el material que falta");
    // Con la orden abierta no hay nada bloqueado que explicar…
    expect(ficha).not.toContain("Aún no se puede");
    // …y el bloque suelto ya no vive en la tarjeta de la lista.
    expect(ficha).not.toContain("Por qué no se puede");
  });

  test("una orden completada cuenta cómo terminó y por qué ya no se toca", () => {
    pintar({ orders: [ordenCompletada()] });
    act(() => boton("Órdenes de compra").click());
    act(() => boton("Ver la orden").click());

    const ficha = document.body.textContent ?? "";
    expect(ficha).toContain("Ahora (paso 3 de 3):");
    expect(ficha).toContain("Completada · 3/3 ud");
    expect(ficha).toContain("La orden está completada");
    // Los dos motivos, bajo el tramo que cuenta cómo terminó.
    expect(ficha).toContain("Aún no se puede");
    expect(ficha).toContain("Recepcionar material");
    expect(ficha).toContain("Anular la orden");
    expect(ficha).toContain("ya está completada: entró todo lo que se pidió");
    expect(ficha).not.toContain("Por qué no se puede");
  });
});
