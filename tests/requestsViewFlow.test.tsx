// @vitest-environment jsdom
// Lo que ofrece la ficha de una petición sale de la máquina (`lib/requestFlow`),
// no de una lista paralela en la vista. Aquí se comprueba en pantalla; lo que
// hace de verdad cada paso está en tests/repuestos.test.ts.
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

const { COLA } = vi.hoisted(() => ({
  COLA: {
    /** La cola: lo que se trabaja, sin lo archivado. */
    requests: [] as unknown[],
    /** La petición que se pide abrir por su id (las archivadas). */
    detalle: undefined as unknown,
    /** La constancia de la petición abierta: sus decisiones, entregas incluidas. */
    decisiones: [] as unknown[],
  },
}));

vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  return {
    // La cola la carga la propia vista: se le sirve lo que la prueba haya puesto.
    // Lo demás (catálogo, equipos, compras de la petición) va vacío.
    useQuery: (query: unknown) => {
      const nombre = getFunctionName(query as never);
      if (nombre === "partRequests:list") return COLA.requests;
      // La puerta de una petición concreta: es la que abre lo archivado.
      if (nombre === "partRequests:detail") return COLA.detalle;
      // La constancia de la petición abierta: quién entregó qué y cuándo.
      if (nombre === "partRequests:decisions") return COLA.decisiones;
      return [];
    },
    useMutation: () => async () => undefined,
  };
});

import { MemoryRouter } from "react-router";

import type { Doc } from "@/convex/_generated/dataModel";
import { RequestsView } from "@/pages/dashboard/RequestsView";

const AYER = Date.parse("2026-10-01T09:00:00.000Z");

/** La petición tal y como la sirve la cola: con un repuesto pedido. */
function peticion(
  extra: Partial<Doc<"partRequests">> = {},
): Doc<"partRequests"> {
  return {
    _id: "pet-1",
    _creationTime: AYER,
    reference: "PET-0001",
    requesterName: "Sandra Ruiz",
    priority: "normal",
    status: "pending",
    lines: [
      {
        sparePartId: "part-1",
        code: "TRI-60004",
        name: "Triac BTA16-600B",
        quantity: 2,
      },
    ],
    attachments: [],
    createdAt: AYER,
    ...extra,
  } as unknown as Doc<"partRequests">;
}

/** Lo que jsdom no trae y Radix da por hecho al abrir la ficha. */
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
  COLA.requests = [];
  COLA.detalle = undefined;
  COLA.decisiones = [];
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  // La ficha se pinta en un portal colgado del cuerpo: se limpia para que la
  // prueba siguiente no lea lo de esta.
  document.body.innerHTML = "";
});

/**
 * La ficha abierta, no la cola: las dos están en el documento a la vez, así que
 * lo que se mira aquí tiene que ser el contenido de la ficha.
 */
function ficha(): HTMLElement {
  const sheet = document.querySelector<HTMLElement>(
    '[data-slot="sheet-content"]',
  );
  if (sheet === null) throw new Error("La ficha no se ha abierto");
  return sheet;
}

/** Un botón por su texto exacto, dentro de lo que se le pase. */
function boton(
  texto: string,
  raiz: ParentNode = document,
): HTMLButtonElement | undefined {
  return [...raiz.querySelectorAll("button")].find(
    (candidate) => (candidate.textContent ?? "").trim() === texto,
  );
}

/** Monta la cola con esa petición y abre su ficha. */
async function abrirFicha(request: Doc<"partRequests">) {
  COLA.requests = [request];
  await act(async () => {
    root.render(
      <MemoryRouter>
        <RequestsView canManage />
      </MemoryRouter>,
    );
  });
  await settle();
  act(() => boton("Ver detalle")?.click());
  await settle();
}

/** El botón de la ficha abierta, que es lo que la prueba mira. */
function botonDeLaFicha(texto: string): HTMLButtonElement | undefined {
  return boton(texto, ficha());
}

/**
 * La ficha abierta como lo hace el panel al llegar desde una incidencia: la
 * petición viene en `initialDetailId`, sin pasar por la cola. Es el camino de
 * las archivadas, que no están listadas en ninguna sección.
 */
async function abrirFichaDirecta(request: Doc<"partRequests">) {
  // Tal y como es en producción: la cola no trae la archivada, y la ficha llega
  // por la consulta puntual.
  COLA.requests = [];
  COLA.detalle = request;
  await act(async () => {
    root.render(
      <MemoryRouter>
        <RequestsView canManage initialDetailId={request._id} />
      </MemoryRouter>,
    );
  });
  await settle();
}

describe("ficha de la petición — los pasos que ofrece son los que deja la máquina", () => {
  test("con el material ya recibido sí se puede aprobar, y no rechazar", async () => {
    // El aviso de compras dice «ya se puede entregar», pero la ficha solo ofrecía
    // aprobar desde «pendiente»: el paso legal existe y ahora se ve.
    await abrirFicha(peticion({ status: "materialReceived" }));

    expect(botonDeLaFicha("Aprobar")).toBeDefined();
    // Rechazar no es un paso desde aquí: la petición ya se resolvió.
    expect(botonDeLaFicha("Rechazar")).toBeUndefined();
  });

  test("una petición en espera se reanuda, y no se archiva", async () => {
    await abrirFicha(
      peticion({ status: "onHold", holdSinceAt: AYER, heldFrom: "pending" }),
    );

    expect(botonDeLaFicha("Reanudar")).toBeDefined();
    // Lo que aún se mueve no va al archivo: el servidor lo rechazaría, así que la
    // ficha no puede ofrecerlo.
    expect(botonDeLaFicha("Archivar")).toBeUndefined();
  });

  test("una petición pendiente sin repuesto se asocia antes de aprobarla", async () => {
    await abrirFicha(peticion({ lines: [] }));

    expect(botonDeLaFicha("Asociar repuesto")).toBeDefined();
    expect(botonDeLaFicha("Aprobar")).toBeUndefined();
    expect(botonDeLaFicha("Rechazar")).toBeDefined();
  });

  test("una petición ya entregada no se suspende ni se cancela: primero se devuelve", async () => {
    await abrirFicha(peticion({ status: "issued", issuedAt: AYER }));

    expect(botonDeLaFicha("En espera")).toBeUndefined();
    expect(botonDeLaFicha("Cancelar petición")).toBeUndefined();
    // Y lo ya terminado sí se puede archivar.
    expect(botonDeLaFicha("Archivar")).toBeDefined();
  });

  test("una petición entregada dice por qué no se cancela, y deja devolver el material", async () => {
    // Antes esto era un «no hay botón» sin más: el motivo lo tenía el servidor
    // —«devuélvela desde Devolver material»—, y ese botón no existía.
    await abrirFicha(peticion({ status: "issued", issuedAt: AYER }));

    // Los motivos viven en el recorrido, bajo la etapa de su paso.
    expect(ficha().textContent).toContain("Aún no se puede");
    expect(ficha().textContent).toContain(
      "primero devuélvela desde «Devolver material»",
    );
    expect(botonDeLaFicha("Devolver material")).toBeDefined();
  });

  test("una petición aprobada explica que el material está comprometido", async () => {
    await abrirFicha(peticion({ status: "approved", decidedAt: AYER }));

    expect(ficha().textContent).toContain("material comprometido");
    // Y lo que sí se puede desde ahí sigue ahí, sin explicación de más.
    expect(botonDeLaFicha("Entregar material")).toBeDefined();
  });

  test("una petición archivada se abre en solo lectura y no vuelve a la cola", async () => {
    // Lo archivado no se lista ni se trabaja, pero tiene que poder consultarse:
    // la ficha de la incidencia enlaza con el material que se pidió para el caso.
    const archivada = peticion({
      status: "issued",
      issuedAt: AYER,
      archivedAt: AYER + 86_400_000,
      archivedBy: "Elena Vidal",
    });
    await abrirFichaDirecta(archivada);

    // La ficha está delante, con su aviso de dónde vive y por qué no se toca.
    const texto = ficha().textContent ?? "";
    expect(texto).toContain("En el archivo desde el");
    expect(texto).toContain("solo lectura");
    expect(texto).toContain("recupérala desde el módulo Archivo");

    // El archivo es un tramo del recorrido: una entregada y guardada no se lee
    // igual que una entregada que sigue en la cola.
    expect(texto).toContain("Ahora (paso 4 de 4):");
    expect(texto).toContain("Entregada · en el archivo");
    expect(texto).toContain("Archivada");
    expect(texto).toContain("En el archivo: la petición se consulta en solo lectura.");

    // Y ninguna acción: los pasos de la máquina, el archivo y la retirada se
    // apagan aunque quien mire sea quien decide peticiones.
    for (const paso of [
      "Aprobar",
      "Rechazar",
      "Entregar material",
      "En espera",
      "Devolver material",
      "Cancelar petición",
      "Archivar",
      "Retirar",
    ]) {
      expect(botonDeLaFicha(paso), paso).toBeUndefined();
    }

    // Y no se ha colado en la cola: lo archivado se consulta, no se trabaja.
    expect(boton("Ver detalle")).toBeUndefined();
  });

  test("la ficha dice quién entregó cada tanda de material, y cuándo", async () => {
    // Lo que las líneas no pueden contar: que salió en dos veces y quién lo sacó.
    COLA.decisiones = [
      {
        _id: "dec-2",
        _creationTime: AYER,
        requestId: "pet-1",
        by: "Elena Vidal",
        decision: {
          reason: "materialDelivered",
          note: "1 × TRI-60004 Triac BTA16-600B",
        },
        at: AYER + 60 * 60 * 1000,
      },
      {
        _id: "dec-1",
        _creationTime: AYER,
        requestId: "pet-1",
        by: "Marcos Vega",
        decision: {
          reason: "materialPartiallyDelivered",
          note: "1 × TRI-60004 Triac BTA16-600B",
        },
        at: AYER,
      },
    ];
    await abrirFicha(peticion({ status: "issued", issuedAt: AYER }));

    const texto = ficha().textContent ?? "";
    expect(texto).toContain("Entregas del material");
    // Cada tanda con quien la entregó, su hora y lo que salió.
    expect(texto).toContain("Marcos Vega");
    expect(texto).toContain("Material entregado en parte");
    expect(texto).toContain("Elena Vidal");
    expect(texto).toContain("Material entregado");
    expect(texto).toContain("1 × TRI-60004 Triac BTA16-600B");
  });

  test("sin entregas apuntadas, la constancia no ocupa sitio", async () => {
    await abrirFicha(peticion({ status: "pending" }));

    expect(ficha().textContent).not.toContain("Entregas del material");
  });

  test("una petición rechazada lo dice una vez, no paso a paso", async () => {
    await abrirFicha(peticion({ status: "rejected", decidedAt: AYER }));

    const texto = ficha().textContent ?? "";
    // Lo dice el resumen del recorrido, en la línea de «Siguiente»…
    expect(
      texto.match(/Ya está cerrada: no se vuelve a tramitar/g) ?? [],
    ).toHaveLength(1);
    // …y no se repite el mismo motivo siete veces, uno por cada paso.
    expect(texto.match(/ya está resuelta/g) ?? []).toHaveLength(0);
    expect(texto).not.toContain("Aún no se puede");
  });
});
