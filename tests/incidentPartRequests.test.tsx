// @vitest-environment jsdom
// Se sustituyen los hooks de Convex *antes* de que la vista los importe: aquí se
// comprueba la pantalla —el listado de material de la ficha, con su estado, y el
// salto a la petición—, no la conversación con el servidor.
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

const { COLA, ABIERTAS } = vi.hoisted(() => ({
  /** Lo que sirve el backend de mentira: la cola y el material del caso. */
  COLA: { incidents: [] as unknown[], requests: [] as unknown[] },
  /** Las peticiones que la ficha ha mandado abrir. */
  ABIERTAS: [] as string[],
}));

vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  return {
    useQuery: (query: unknown) => {
      const nombre = getFunctionName(query as never);
      if (nombre === "incidents:list") return COLA.incidents;
      if (nombre === "partRequests:list") return COLA.requests;
      // La ficha pide también equipos y, solo a quien coordina, el rastro de
      // documentos: aquí no hace falta ninguno de los dos.
      return [];
    },
    useMutation: () => async () => undefined,
  };
});

import { MemoryRouter } from "react-router";

import type { Doc, Id } from "@/convex/_generated/dataModel";
import { IncidentsView } from "@/pages/dashboard/IncidentsView";

const TECNICO = "user-tec" as Id<"users">;
const AYER = Date.parse("2026-10-01T09:00:00.000Z");

/** La incidencia tal y como la sirve la cola. */
function incidencia(extra: Partial<Doc<"incidents">> = {}): Doc<"incidents"> {
  return {
    _id: "inc-4",
    _creationTime: AYER,
    reference: "INC-0004",
    reporterName: "Laura Peña",
    location: "Plató 1",
    equipmentKind: "Cámara de estudio",
    model: "HDC 3500",
    description: "La cámara se apaga sola en directo.",
    reportedAt: AYER,
    status: "waitingParts",
    assigneeId: TECNICO,
    assigneeName: "Iván Torres",
    history: [
      { status: "reported", at: AYER, by: "Laura Peña" },
      { status: "waitingParts", at: AYER + 60 * 60 * 1000, by: "Iván Torres" },
    ],
    createdAt: AYER,
    updatedAt: AYER,
    ...extra,
  } as unknown as Doc<"incidents">;
}

/** Una petición de material del caso, con el estado que diga la prueba. */
function peticion(
  extra: Partial<Doc<"partRequests">> = {},
): Doc<"partRequests"> {
  return {
    _id: "pet-1",
    _creationTime: AYER,
    reference: "PET-0001",
    requesterName: "Iván Torres",
    priority: "normal",
    status: "pending",
    lines: [],
    incidentId: "inc-4" as Id<"incidents">,
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
  COLA.incidents = [incidencia()];
  COLA.requests = [];
  ABIERTAS.length = 0;
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

/** Monta la cola con esas peticiones y abre la ficha de la incidencia. */
async function abrirFicha({
  requests,
  canOpenRequests = true,
}: {
  requests: Doc<"partRequests">[];
  canOpenRequests?: boolean;
}) {
  COLA.requests = requests;
  await act(async () => {
    root.render(
      <MemoryRouter>
        <IncidentsView
          currentUserId={TECNICO}
          canOpenRequests={canOpenRequests}
          onOpenRequest={(id) => ABIERTAS.push(id)}
        />
      </MemoryRouter>,
    );
  });
  await settle();
  act(() => {
    container
      .querySelector<HTMLButtonElement>("[data-row] button")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await settle();
}

/** Los botones «Abrir petición», en el orden en que se pintan. */
function abrirPeticionButtons() {
  return [...document.querySelectorAll("button")].filter(
    (candidate) => (candidate.textContent ?? "").trim() === "Abrir petición",
  );
}

describe("ficha de la incidencia — peticiones de material", () => {
  test("el material del caso se lista con su estado, y no el de otros casos", async () => {
    await abrirFicha({
      requests: [
        peticion(),
        peticion({
          _id: "pet-2",
          reference: "PET-0002",
          status: "issued",
          priority: "urgent",
          createdAt: AYER + 60 * 60 * 1000,
        }),
        // De otro caso: no es material de esta incidencia.
        peticion({
          _id: "pet-9",
          reference: "PET-0009",
          incidentId: "inc-otra" as Id<"incidents">,
        }),
      ],
    });

    const ficha = document.body.textContent ?? "";
    expect(ficha).toContain("Peticiones de material");
    // Cada petición con su estado y con lo que el estado significa.
    expect(ficha).toContain("PET-0001");
    expect(ficha).toContain("Pendiente");
    expect(ficha).toContain("Esperando revisión del responsable de repuestos");
    expect(ficha).toContain("PET-0002");
    expect(ficha).toContain("Entregada");
    expect(ficha).toContain("Material entregado al técnico");
    // Y su prioridad, que es lo que ordena el trabajo del almacén.
    expect(ficha).toContain("Urgente");
    // Lo de otro caso no se cuela en esta ficha.
    expect(ficha).not.toContain("PET-0009");
    // Una petición viva se puede abrir desde aquí.
    expect(abrirPeticionButtons()).toHaveLength(2);
  });

  test("cada línea dice qué pieza es, cuántas se pidieron y si ya se entregó", async () => {
    // Lo que el técnico necesita saber desde el caso: qué falta y qué ya tiene.
    // Abrir la petición para averiguarlo es salir del caso a mitad de decidir.
    await abrirFicha({
      requests: [
        peticion({
          lines: [
            {
              sparePartId: "part-1" as Id<"spareParts">,
              code: "ALI-24015",
              name: "Fuente de alimentación 24 V",
              quantity: 2,
            },
            {
              sparePartId: "part-2" as Id<"spareParts">,
              code: "SOP-0077",
              name: "Soporte de cámara",
              quantity: 1,
            },
          ],
        }),
        peticion({
          _id: "pet-2",
          reference: "PET-0002",
          status: "issued",
          issuedAt: AYER + 2 * 60 * 60 * 1000,
          createdAt: AYER + 60 * 60 * 1000,
          lines: [
            {
              sparePartId: "part-3" as Id<"spareParts">,
              code: "DIS-0102",
              name: "Disipador",
              quantity: 3,
            },
          ],
        }),
        peticion({
          _id: "pet-3",
          reference: "PET-0003",
          status: "returned",
          returnedAt: AYER + 3 * 60 * 60 * 1000,
          createdAt: AYER + 2 * 60 * 60 * 1000,
          lines: [
            {
              sparePartId: "part-4" as Id<"spareParts">,
              code: "TOR-0001",
              name: "Tornillería",
              quantity: 4,
            },
          ],
        }),
        peticion({
          _id: "pet-4",
          reference: "PET-0004",
          status: "cancelled",
          createdAt: AYER + 3 * 60 * 60 * 1000,
          lines: [
            {
              sparePartId: "part-5" as Id<"spareParts">,
              code: "VEN-0003",
              name: "Ventilador",
              quantity: 1,
            },
          ],
        }),
      ],
    });

    /**
     * La fila de una pieza —la más interna, la de la propia línea—, para leer su
     * cantidad y su estado sin que se mezclen con los de al lado.
     */
    const fila = (code: string) =>
      [...document.querySelectorAll("li")]
        .filter((item) => item.querySelector("li") === null)
        .map((item) => item.textContent ?? "")
        .find((texto) => texto.includes(code));

    expect(fila("ALI-24015")).toContain("Fuente de alimentación 24 V");
    expect(fila("ALI-24015")).not.toContain("SOP-0077");
    expect(fila("ALI-24015")).toContain("×2");
    expect(fila("ALI-24015")).toContain("sin entregar");
    expect(fila("SOP-0077")).toContain("×1");
    expect(fila("DIS-0102")).toContain("×3");
    expect(fila("DIS-0102")).toContain("entregado");
    // Lo devuelto salió y volvió; lo cancelado no llegó a salir. Ni uno ni otro
    // se pueden montar, y la ficha no los llama «entregados».
    expect(fila("TOR-0001")).toContain("devuelto");
    expect(fila("VEN-0003")).toContain("no se sirvió");

    // Lo entregado y lo devuelto se fechan, no solo se nombran.
    expect(document.body.textContent).toContain("Material entregado el");
    expect(document.body.textContent).toContain("Material devuelto el");
  });

  test("lo pedido sin catálogo se lee descrito, sin abrir la petición", async () => {
    await abrirFicha({
      requests: [
        peticion({
          lines: [],
          description: "Falta el ventilador del chasis, 2 unidades",
        }),
      ],
    });

    const ficha = document.body.textContent ?? "";
    expect(ficha).toContain("Falta el ventilador del chasis, 2 unidades");
    expect(ficha).not.toContain("Sin repuesto del catálogo");
  });

  test("una petición vacía lo dice en vez de quedarse sin lista", async () => {
    await abrirFicha({ requests: [peticion({ lines: [] })] });

    expect(document.body.textContent).toContain(
      "Sin repuesto del catálogo y sin descripción",
    );
  });

  test("cada línea dice lo pedido y lo ya entregado, sin abrir la petición", async () => {
    // La ficha se lee para decidir el siguiente paso, y ese paso depende de qué
    // pieza falta: la línea tiene que decir el repuesto, cuánto se pidió y cuánto
    // ha salido ya del almacén. Abrir la petición para verlo es perder de vista
    // el caso.
    await abrirFicha({
      requests: [
        peticion({
          lines: [
            {
              sparePartId: "sp-1" as Id<"spareParts">,
              code: "ALI-12024",
              name: "Fuente de alimentación 12 V",
              quantity: 2,
            },
            {
              sparePartId: "sp-2" as Id<"spareParts">,
              code: "FIL-00042",
              name: "Filtro de aire",
              quantity: 1,
            },
          ],
        }),
        peticion({
          _id: "pet-2",
          reference: "PET-0002",
          status: "issued",
          createdAt: AYER + 60 * 60 * 1000,
          issuedAt: AYER + 2 * 60 * 60 * 1000,
          lines: [
            {
              sparePartId: "sp-3" as Id<"spareParts">,
              code: "CON-00007",
              name: "Conector XLR",
              quantity: 3,
            },
          ],
        }),
      ],
    });

    const ficha = document.body.textContent ?? "";
    // Lo pedido, línea a línea y con su código de repuesto.
    expect(ficha).toContain("ALI-12024");
    expect(ficha).toContain("Fuente de alimentación 12 V");
    expect(ficha).toContain("pedido ×2");
    expect(ficha).toContain("FIL-00042");
    expect(ficha).toContain("pedido ×1");
    // Y lo que ya se entregó: la petición entregada muestra la cantidad
    // entregada; la que sigue pendiente, que no ha salido nada.
    expect(ficha).toContain("CON-00007");
    expect(ficha).toContain("pedido ×3");
    expect(ficha).toContain("entregado ×3");
    expect(ficha).toContain("sin entregar");
  });

  test("señalar una petición la manda a abrir, con la suya y no otra", async () => {
    await abrirFicha({
      requests: [
        peticion(),
        peticion({
          _id: "pet-2",
          reference: "PET-0002",
          status: "approved",
          createdAt: AYER + 60 * 60 * 1000,
        }),
      ],
    });

    act(() => {
      (abrirPeticionButtons()[1] as HTMLButtonElement).click();
    });

    // El identificador, no la referencia: quien navega es el panel.
    expect(ABIERTAS).toEqual(["pet-2"]);
  });

  test("sin permiso para ver peticiones, el estado se lee pero no se ofrece el salto", async () => {
    // El material del caso es parte de la ficha: se enseña siempre. Lo que no
    // puede haber es un botón que lleve a un módulo que ese rol no tiene.
    await abrirFicha({
      requests: [peticion({ status: "issued" })],
      canOpenRequests: false,
    });

    const ficha = document.body.textContent ?? "";
    expect(ficha).toContain("PET-0001");
    expect(ficha).toContain("Entregada");
    expect(abrirPeticionButtons()).toHaveLength(0);
  });

  test("lo archivado se dice, y se abre en solo lectura sin sacarlo del archivo", async () => {
    // Lo archivado no vuelve a la cola, pero su caso sigue vivo: desde la ficha
    // de la incidencia se puede consultar lo que se pidió y cómo terminó.
    await abrirFicha({
      requests: [peticion({ status: "issued", archivedAt: AYER + 86_400_000 })],
    });

    const ficha = document.body.textContent ?? "";
    expect(ficha).toContain("En el archivo");
    expect(ficha).toContain("se abre en solo lectura");

    // El botón lo dice tal cual: no es «abrir» para trabajar, es «ver».
    const ver = [...document.querySelectorAll("button")].filter(
      (candidate) => (candidate.textContent ?? "").trim() === "Ver petición",
    );
    expect(ver).toHaveLength(1);
    act(() => (ver[0] as HTMLButtonElement).click());
    expect(ABIERTAS).toEqual(["pet-1"]);
    // Y no se ofrece el de las vivas: una petición archivada no se trabaja.
    expect(abrirPeticionButtons()).toHaveLength(0);
  });

  test("una entrega a medias se ve línea a línea, y la petición lo dice", async () => {
    // El material puede salir por tandas: la ficha del caso enseña lo que llegó y
    // lo que sigue en el almacén, sin abrir la petición.
    await abrirFicha({
      requests: [
        peticion({
          status: "approved",
          decidedAt: AYER,
          lines: [
            {
              sparePartId: "sp-1" as Id<"spareParts">,
              code: "ALI-12024",
              name: "Fuente de alimentación 12 V",
              quantity: 5,
              deliveredQuantity: 2,
              deliveredAt: AYER,
            },
            {
              sparePartId: "sp-2" as Id<"spareParts">,
              code: "FIL-00042",
              name: "Filtro de aire",
              quantity: 1,
            },
          ],
        }),
      ],
    });

    const ficha = document.body.textContent ?? "";
    // La petición lo dice de un vistazo, además del detalle por línea.
    expect(ficha).toContain("entrega parcial");
    // La línea que salió a medias: lo pedido, lo entregado y lo que falta.
    expect(ficha).toContain("pedido ×5");
    expect(ficha).toContain("entregado ×2");
    expect(ficha).toContain("faltan ×3");
    // Y la que no ha salido todavía no inventa una entrega.
    expect(ficha).toContain("pedido ×1");
    expect(ficha).toContain("sin entregar");
  });

  test("una línea entregada entera no habla de lo que falta", async () => {
    await abrirFicha({
      requests: [
        peticion({
          status: "issued",
          issuedAt: AYER,
          lines: [
            {
              sparePartId: "sp-1" as Id<"spareParts">,
              code: "ALI-12024",
              name: "Fuente de alimentación 12 V",
              quantity: 2,
              deliveredQuantity: 2,
              deliveredAt: AYER,
            },
          ],
        }),
      ],
    });

    const ficha = document.body.textContent ?? "";
    expect(ficha).toContain("entregado ×2");
    expect(ficha).not.toContain("faltan");
    expect(ficha).not.toContain("entrega parcial");
  });

  test("un caso sin material lo dice, en vez de dejar el hueco en blanco", async () => {
    await abrirFicha({ requests: [] });

    expect(document.body.textContent).toContain(
      "No se ha pedido material para este caso",
    );
    expect(abrirPeticionButtons()).toHaveLength(0);
  });
});
