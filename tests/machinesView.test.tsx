// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import { MACHINE_SHEET, type SheetState } from "@/lib/machineSheet";
import { MachinesView } from "@/pages/dashboard/MachinesView";

/**
 * La pantalla de «Máquinas del taller»: las tres máquinas —y la orden que la
 * compra lleva dentro— pintadas desde las tablas del código.
 *
 * Se monta a mano con React y jsdom, como el resto de pantallas del panel, y no
 * necesita doble del backend: lo que se pinta sale entero de `lib/machineSheet`.
 * Lo que se comprueba aquí es el contrato de la pantalla —cada bloque enseña sus
 * pasos, su destino y los motivos de lo que no se puede hacer—, así que lo que
 * se espera se lee de la propia ficha: si la máquina cambia, la pantalla cambia
 * con ella y quien vigila que ese cambio sea el correcto es
 * `machineSheet.test.ts`, que la lee contra las tablas.
 */

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(<MachinesView />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = "";
});

/** La tarjeta de una máquina. */
function tarjeta(id: string): HTMLElement {
  const node = document.querySelector<HTMLElement>(`[data-machine='${id}']`);
  if (!node) throw new Error(`No hay tarjeta de la máquina «${id}».`);
  return node;
}

/** El bloque de un estado. */
function bloque(id: string, estado: string): HTMLElement {
  const node = tarjeta(id).querySelector<HTMLElement>(
    `[data-state='${estado}']`,
  );
  if (!node)
    throw new Error(`La máquina «${id}» no pinta el estado «${estado}».`);
  return node;
}

/** El primer estado de todas las máquinas que cumple lo que se le pida. */
function primerEstadoQue(cumple: (estado: SheetState) => boolean): {
  maquina: string;
  estado: SheetState;
} {
  for (const maquina of MACHINE_SHEET) {
    const estado = maquina.states.find(cumple);
    if (estado) return { maquina: maquina.id, estado };
  }
  throw new Error("Ninguna máquina tiene un estado así.");
}

describe("la pantalla de las máquinas del taller", () => {
  test("pinta las cuatro, con un bloque por estado", () => {
    expect(MACHINE_SHEET.map((maquina) => maquina.id)).toEqual([
      "incident",
      "request",
      "purchaseRequest",
      "purchaseOrder",
    ]);

    for (const maquina of MACHINE_SHEET) {
      expect(tarjeta(maquina.id).textContent).toContain(maquina.title);
      expect(
        tarjeta(maquina.id).querySelectorAll("[data-state]"),
        `estados de ${maquina.id}`,
      ).toHaveLength(maquina.states.length);
    }
    // El nombre del estado en pantalla, no su clave interna.
    expect(bloque("incident", "reported").textContent).toContain("Nueva");
  });

  test("cada bloque enseña sus pasos con el estado al que llevan", () => {
    const { maquina, estado } = primerEstadoQue((candidato) =>
      candidato.steps.some((step) => step.to.kind === "status"),
    );
    const texto = bloque(maquina, estado.key).textContent ?? "";

    for (const step of estado.steps) {
      expect(texto, `${maquina}/${estado.key}: ${step.label}`).toContain(
        step.label,
      );
      if (step.to.kind === "status") expect(texto).toContain(step.to.label);
    }
  });

  test("el destino que decide la máquina se cuenta con palabras", () => {
    const { maquina, estado } = primerEstadoQue((candidato) =>
      candidato.steps.some((step) => step.to.kind === "decided"),
    );
    const texto = bloque(maquina, estado.key).textContent ?? "";

    for (const step of estado.steps) {
      if (step.to.kind === "decided") expect(texto).toContain(step.to.note);
    }
  });

  test("de un estado sin pasos dice que no hay ninguno", () => {
    const { maquina, estado } = primerEstadoQue(
      (candidato) => candidato.steps.length === 0,
    );
    expect(bloque(maquina, estado.key).textContent).toContain(
      "No hay ningún paso desde aquí",
    );
  });

  test("lo que no se puede desde aquí va con el motivo de su máquina", () => {
    const conMotivos = primerEstadoQue(
      (candidato) => candidato.blocked.length > 0,
    );
    const texto =
      bloque(conMotivos.maquina, conMotivos.estado.key).textContent ?? "";
    expect(texto).toContain("No se puede desde aquí");
    expect(texto).toContain(conMotivos.estado.blocked[0].reason);

    // Y la máquina que no tiene motivos escritos —la petición de compra— no se
    // los inventa: sus bloques no llevan esa línea.
    const sinMotivos = MACHINE_SHEET.find((maquina) =>
      maquina.states.every((estado) => estado.blocked.length === 0),
    );
    expect(sinMotivos, "ninguna máquina sin motivos").toBeDefined();
    const sinMotivosEstado = sinMotivos!.states[0];
    expect(
      bloque(sinMotivos!.id, sinMotivosEstado.key).textContent,
    ).not.toContain("No se puede desde aquí");
  });
});
