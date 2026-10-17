// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const estado = vi.hoisted(() => ({
  /** Las consultas que la página ha pedido, en su forma canónica. */
  consultas: [] as string[],
  respuesta: undefined as unknown,
}));

vi.mock("@/convex/_generated/api", () => ({
  api: { incidents: { byCode: { nombre: "incidents.byCode" } } },
}));

// La consulta pública es una mutación —cada una se cuenta, que es lo que la
// limita—: se apunta lo que se pide y se contesta con lo que diga la prueba.
vi.mock("convex/react", () => ({
  useMutation: () => async (args: { code: string }) => {
    estado.consultas.push(JSON.stringify(args));
    return estado.respuesta;
  },
}));

import FollowIncident from "@/pages/FollowIncident";

/**
 * La página pública de seguimiento: la dirección que lleva el correo
 * (`/seguimiento?codigo=…`). Se comprueba lo que importa de esa puerta —que el
 * código de la dirección se consulta solo al abrir y que la página se enseña sin
 * pedir sesión—, no la consulta en sí (esa está en `tests/incidents.test.ts`).
 */

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  estado.consultas.length = 0;
  estado.respuesta = undefined;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

// La consulta del código que trae la dirección se lanza al montar y es
// asíncrona: se espera a que conteste, como quien abre el enlace del correo.
const montar = async (entrada: string) => {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[entrada]}>
        <Routes>
          <Route path="/seguimiento" element={<FollowIncident />} />
        </Routes>
      </MemoryRouter>,
    );
  });
};

const texto = () => container.textContent ?? "";

const seguimiento = {
  code: "A7K2QX9M",
  status: "workshop" as const,
  equipmentKind: "Cámara de estudio",
  model: "HDC-3500",
  serialNumber: null,
  location: "Plató 2",
  description: "Pierde la señal cada pocos minutos.",
  reportedAt: Date.parse("2026-10-01T09:00:00.000Z"),
  closedAt: null,
  assigneeName: null,
  workshopAssigneeName: "Iván Torres",
  history: [
    { status: "reported" as const, at: Date.parse("2026-10-01T09:00:00.000Z") },
  ],
  pendingParts: [] as {
    name: string;
    quantity: number;
    since: number;
  }[],
};

describe("seguimiento público por código", () => {
  test("el código que trae la dirección se consulta solo al abrir", async () => {
    estado.respuesta = seguimiento;
    await montar("/seguimiento?codigo=a7k2-qx9m");

    // Escrito como venga en el enlace: la consulta lo lee en su forma canónica, y
    // el campo lo enseña para que se vea qué caso se está siguiendo.
    expect(estado.consultas).toEqual(['{"code":"A7K2QX9M"}']);
    expect(texto()).toContain("A7K2-QX9M");
    expect(texto()).toContain("Cámara de estudio · HDC-3500");
    expect(texto()).toContain("Iván Torres");
  });

  test("dice qué falta: el repuesto, la cantidad y desde cuándo", async () => {
    // Lo que se pregunta al seguir un caso que espera material es «¿qué falta y
    // desde cuándo?», no la referencia de la petición. La ficha lo contesta sin
    // que haya que abrir nada.
    const haceTresDias = Date.now() - 3 * 24 * 60 * 60 * 1000;
    estado.respuesta = {
      ...seguimiento,
      status: "waitingParts",
      pendingParts: [
        {
          name: "Fuente de alimentación 12 V",
          quantity: 2,
          since: haceTresDias,
        },
        { name: "Filtro de aire", quantity: 1, since: haceTresDias },
      ],
    };
    await montar("/seguimiento?codigo=A7K2QX9M");

    expect(texto()).toContain("Repuestos pendientes");
    expect(texto()).toContain("2 ×");
    expect(texto()).toContain("Fuente de alimentación 12 V");
    expect(texto()).toContain("1 ×");
    expect(texto()).toContain("Filtro de aire");
    expect(texto()).toContain("pedido hace 3 días");
    expect(texto()).toContain("El más antiguo se pidió el");
    // Y lo que es del taller sigue fuera: ni la referencia de la petición ni la
    // del caso.
    expect(texto()).not.toContain("PET-");
    expect(texto()).not.toContain("INC-");
  });

  test("un caso que espera material sin líneas lo dice, sin inventar repuestos", async () => {
    // La petición se abrió describiendo la avería y el repuesto aún no se ha
    // asociado: la ficha no puede dejar el hueco en blanco ni rellenarlo con una
    // línea que no existe.
    estado.respuesta = {
      ...seguimiento,
      status: "waitingParts",
      pendingParts: [],
    };
    await montar("/seguimiento?codigo=A7K2QX9M");

    expect(texto()).toContain("todavía no ha detallado qué repuestos");
    expect(texto()).not.toContain("Repuestos pendientes");
  });

  test("un caso cerrado no enseña repuestos pendientes: ya no espera nada", async () => {
    // Si quedó una petición viva por descuido, una ficha que dice «cerrada» no
    // puede contradecirse debajo con una lista de lo que falta.
    estado.respuesta = {
      ...seguimiento,
      status: "resolved",
      closedAt: Date.now(),
      pendingParts: [
        { name: "Filtro de aire", quantity: 1, since: Date.now() - 86_400_000 },
      ],
    };
    await montar("/seguimiento?codigo=A7K2QX9M");

    expect(texto()).toContain("Resuelta");
    expect(texto()).not.toContain("Repuestos pendientes");
    expect(texto()).not.toContain("Filtro de aire");
  });

  test("sin código en la dirección se explica qué hace falta, sin consultar nada", async () => {
    await montar("/seguimiento");

    expect(estado.consultas).toEqual([]);
    expect(texto()).toContain("Escribe el código de la incidencia");
  });

  test("la página se enseña entera sin haber entrado: ni acceso ni cuenta", async () => {
    await montar("/seguimiento");

    expect(texto()).toContain("Seguir una incidencia");
    expect(texto()).toContain("Seguir una incidencia");
    // Nada de muros de acceso: lo que se ofrece es notificar y pedir el código.
    expect(texto()).not.toContain("Sign in to continue");
    expect(texto()).toContain("notificar la incidencia otra vez");
  });
});
