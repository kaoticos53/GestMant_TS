// @vitest-environment jsdom
// Lo retirado se abre desde la papelera del módulo Archivo para decidir si
// vuelve o se borra: es una consulta, no una pantalla de trabajo. Aquí se
// comprueba que la ficha se lee entera —con su motivo, quién la retiró y el
// tramo «retirada» del recorrido— y que no ofrece ningún paso, aunque quien la
// mire sea quien podría darlos.
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

vi.mock("convex/react", () => ({
  // La ficha retirada no pide nada al servidor: se le entrega el documento.
  useQuery: () => undefined,
  useMutation: () => async () => undefined,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() },
}));

import type { Doc } from "@/convex/_generated/dataModel";
import { IncidentDetailSheet } from "@/pages/dashboard/incidents/components/IncidentDetailSheet";
import { RequestDetailSheet } from "@/pages/dashboard/requests/components/RequestDetailSheet";

const RETIRADA = Date.parse("2026-10-01T09:00:00.000Z");
const ARCHIVADA = Date.parse("2026-09-20T09:00:00.000Z");

/** La petición tal y como la sirve el servidor, ya retirada. */
function peticionRetirada(
  extra: Partial<Doc<"partRequests">> = {},
): Doc<"partRequests"> {
  return {
    _id: "pet-9",
    _creationTime: RETIRADA,
    reference: "PET-0014",
    requesterName: "Iván Torres",
    requesterTeam: "Iluminación",
    equipment: "Micrófono de solapa Axient Digital",
    priority: "normal",
    status: "rejected",
    lines: [
      {
        sparePartId: "part-1",
        code: "AUD-XLR03",
        name: "Cable XLR 3 m",
        quantity: 4,
      },
    ],
    attachments: [],
    createdAt: ARCHIVADA,
    decidedAt: RETIRADA,
    decidedBy: "Elena Vidal",
    rejectedNote: "Sin presupuesto este trimestre.",
    deletedAt: RETIRADA,
    deletedBy: "Elena Vidal",
    deletedReason: "Duplicada de la PET-0011",
    purgeAt: RETIRADA + 30 * 24 * 60 * 60 * 1000,
    ...extra,
  } as unknown as Doc<"partRequests">;
}

/** La incidencia tal y como la sirve el servidor, ya retirada. */
function incidenciaRetirada(
  extra: Partial<Doc<"incidents">> = {},
): Doc<"incidents"> {
  return {
    _id: "inc-9",
    _creationTime: ARCHIVADA,
    reference: "INC-0016",
    code: "A7K2QX9M",
    status: "assigned",
    equipmentKind: "Generador de sincronía",
    model: "SPG 5600",
    description: '{"type":"doc","content":[]}',
    reporterName: "Laura Peña",
    reporterRole: "Realización",
    location: "Plató 1",
    history: [],
    reportedAt: ARCHIVADA,
    assigneeId: "user-2",
    assigneeName: "Iván Torres",
    deletedAt: RETIRADA,
    deletedBy: "Elena Vidal",
    deletedReason: "Aviso duplicado",
    purgeAt: RETIRADA + 30 * 24 * 60 * 60 * 1000,
    ...extra,
  } as unknown as Doc<"incidents">;
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

/** La ficha abierta, no lo que quede detrás. */
function ficha(): HTMLElement {
  const sheet = document.querySelector<HTMLElement>(
    '[data-slot="sheet-content"]',
  );
  if (sheet === null) throw new Error("La ficha no se ha abierto");
  return sheet;
}

/** El botón de la ficha abierta, por su texto exacto. */
function botonDeLaFicha(texto: string): HTMLElement | undefined {
  return [...ficha().querySelectorAll("button")].find(
    (candidate) => (candidate.textContent ?? "").trim() === texto,
  );
}

function textoDeLaFicha(): string {
  return ficha().textContent ?? "";
}

describe("la ficha de lo que espera en la papelera", () => {
  test("una petición retirada se lee entera y no se puede volver a tramitar", async () => {
    await act(async () => {
      root.render(
        <RequestDetailSheet
          request={peticionRetirada()}
          parts={[]}
          // Quien la mira podría tramitarla: lo que la deja en solo lectura es
          // que está retirada, no el permiso de quien la abre.
          canManage
          onApprove={() => {}}
          onReject={() => {}}
          onIssue={() => {}}
          onClose={() => {}}
        />,
      );
    });
    await settle();

    const texto = textoDeLaFicha();
    // El recorrido dice en qué punto está: retirada, no «Rechazada» a secas.
    expect(texto).toContain("Rechazada · retirada");
    // Y por qué, quién y cuándo: es lo que se mira antes de decidir.
    expect(texto).toContain("Retirada el");
    expect(texto).toContain("Elena Vidal");
    expect(texto).toContain("Duplicada de la PET-0011");
    expect(texto).toContain("se consulta en solo lectura");
    // La petición sigue contando lo que pedía y lo que se decidió.
    expect(texto).toContain("Cable XLR 3 m");

    // Ni aprobar, ni rechazar, ni entregar, ni retirar otra vez.
    for (const paso of ["Aprobar", "Rechazar", "Entregar", "Retirar"]) {
      expect(botonDeLaFicha(paso), `«${paso}»`).toBeUndefined();
    }
    expect(botonDeLaFicha("Cerrar")).toBeDefined();
  });

  test("una incidencia retirada se lee entera y no se puede trabajar", async () => {
    await act(async () => {
      root.render(
        <IncidentDetailSheet
          incident={incidenciaRetirada()}
          equipment={[]}
          requests={[]}
          currentUserId={"user-2" as never}
          currentUserName="Iván Torres"
          // Quien la mira es quien la podría coordinar: aun así no hay pasos.
          canAssign
          onClose={() => {}}
        />,
      );
    });
    await settle();

    const texto = textoDeLaFicha();
    expect(texto).toContain("Asignada · retirada");
    expect(texto).toContain("Retirada el");
    expect(texto).toContain("Aviso duplicado");
    expect(texto).toContain(
      "En la papelera: el caso se consulta en solo lectura",
    );

    for (const paso of [
      "Asignarme",
      "Asignar técnico",
      "Finalizar trabajo",
      "Archivar",
      "Retirar",
      "Corregir datos del equipo",
    ]) {
      expect(botonDeLaFicha(paso), `«${paso}»`).toBeUndefined();
    }
    expect(botonDeLaFicha("Cerrar")).toBeDefined();
  });
});
