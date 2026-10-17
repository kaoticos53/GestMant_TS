import { describe, expect, test } from "vitest";
import {
  INCIDENT_STEP_LABELS,
  INCIDENT_STEPS,
  incidentStepBlocker,
  nextIncidentStatus,
  type IncidentAction,
  type IncidentStatus,
} from "../src/lib/incidentFlow";
import {
  PURCHASE_ORDER_STEP_LABELS,
  PURCHASE_ORDER_STEPS,
  PURCHASE_REQUEST_STEP_LABELS,
  PURCHASE_REQUEST_STEPS,
  purchaseOrderStatusAfterReceiving,
  purchaseOrderStepBlocker,
  type PurchaseOrderAction,
  type PurchaseOrderStatus,
} from "../src/lib/purchaseFlow";
import {
  PURCHASE_ORDER_STATUS_META,
  PURCHASE_REQUEST_STATUS_META,
} from "../src/lib/purchasing";
import {
  REQUEST_STEP_LABELS,
  REQUEST_STEPS,
  requestStepBlocker,
  resumedStatus,
  type RequestAction,
  type RequestStatus,
} from "../src/lib/requestFlow";
import { INCIDENT_STATUS_META, STATUS_META } from "../src/lib/workshop";
import { MACHINE_SHEET } from "../src/lib/machineSheet";

/**
 * La ficha que pinta la pantalla de «Máquinas del taller», leída contra el
 * código del que sale.
 *
 * La pantalla no puede contar una cosa distinta de la que hace el servidor, y eso
 * no se consigue con buena voluntad: aquí se recorren las **tablas** de las tres
 * máquinas por un lado y la ficha por otro, y se exige que digan exactamente lo
 * mismo —ni una fila de menos, ni una inventada, ni un destino cambiado—. Los
 * motivos («primero verifícala») son los textos de la máquina, los mismos que la
 * ficha de un caso enseña.
 *
 * Es la prueba hermana de `maquinas.test.ts`: aquella vigila el documento
 * (`MAQUINAS.md`) y esta, lo que se ve dentro de la aplicación.
 */

interface Paso {
  readonly from: readonly string[];
  readonly to: string;
}

/** Lo que dice el código de cada máquina: sus estados, su tabla y sus nombres. */
const MAQUINAS: {
  id: string;
  estados: Record<string, { label: string; description?: string }>;
  pasos: Record<string, Paso>;
  nombres: Record<string, string>;
  /** Por qué no se puede dar un paso desde un estado, si el módulo lo sabe decir. */
  motivo?: (status: string, action: string) => string | null;
}[] = [
  {
    id: "incident",
    estados: INCIDENT_STATUS_META,
    pasos: INCIDENT_STEPS,
    nombres: INCIDENT_STEP_LABELS,
    motivo: (status, action) =>
      incidentStepBlocker(status as IncidentStatus, action as IncidentAction),
  },
  {
    id: "request",
    estados: STATUS_META,
    pasos: REQUEST_STEPS,
    nombres: REQUEST_STEP_LABELS,
    motivo: (status, action) =>
      requestStepBlocker(status as RequestStatus, action as RequestAction),
  },
  {
    // La petición de compra no tiene motivos escritos: su tabla es de un paso por
    // estado y nadie la mueve a mano de punta a punta.
    id: "purchaseRequest",
    estados: PURCHASE_REQUEST_STATUS_META,
    pasos: PURCHASE_REQUEST_STEPS,
    nombres: PURCHASE_REQUEST_STEP_LABELS,
  },
  {
    id: "purchaseOrder",
    estados: PURCHASE_ORDER_STATUS_META,
    pasos: PURCHASE_ORDER_STEPS,
    nombres: PURCHASE_ORDER_STEP_LABELS,
    motivo: (status, action) =>
      purchaseOrderStepBlocker(
        status as PurchaseOrderStatus,
        action as PurchaseOrderAction,
      ),
  },
];

/** La máquina de la ficha, tal y como se pinta. */
function ficha(id: string) {
  const maquina = MACHINE_SHEET.find((candidate) => candidate.id === id);
  if (!maquina) throw new Error(`La ficha no tiene la máquina «${id}».`);
  return maquina;
}

/** Las filas que la ficha pinta, como parejas `estado/paso`. */
function filasDeLaFicha(id: string): string[] {
  return ficha(id)
    .states.flatMap((estado) =>
      estado.steps.map((step) => `${estado.key}/${step.action}`),
    )
    .sort();
}

/** Las parejas `estado/paso` que dice la tabla del módulo. */
function filasDeLaTabla(maquina: (typeof MAQUINAS)[number]): string[] {
  return Object.entries(maquina.pasos)
    .flatMap(([accion, paso]) => paso.from.map((desde) => `${desde}/${accion}`))
    .sort();
}

describe("la ficha de las máquinas, contra las tablas del código", () => {
  test("están las cuatro —la compra lleva dos dentro—, en su orden", () => {
    expect(MACHINE_SHEET.map((maquina) => maquina.id)).toEqual(
      MAQUINAS.map((maquina) => maquina.id),
    );
    for (const maquina of MACHINE_SHEET) {
      expect(maquina.title.length).toBeGreaterThan(0);
      expect(maquina.note.length).toBeGreaterThan(0);
      expect(maquina.states.length).toBeGreaterThan(0);
    }
  });

  test("cada una sale con sus estados, en el orden en que están declarados", () => {
    for (const esperada of MAQUINAS) {
      const maquina = ficha(esperada.id);
      expect(maquina.states.map((estado) => estado.key)).toEqual(
        Object.keys(esperada.estados),
      );
      for (const estado of maquina.states) {
        // El nombre y la píldora son los mismos que ve el panel en una ficha.
        expect(estado.label).toBe(esperada.estados[estado.key].label);
        expect(estado.description).toBe(
          esperada.estados[estado.key].description,
        );
      }
    }
  });

  test("la ficha dice ni una transición de menos ni una de más", () => {
    for (const esperada of MAQUINAS) {
      expect(filasDeLaFicha(esperada.id)).toEqual(filasDeLaTabla(esperada));
    }
  });

  test("cada paso lleva al estado que dice su tabla, con el nombre de pantalla", () => {
    const desajustes: string[] = [];
    for (const esperada of MAQUINAS) {
      for (const estado of ficha(esperada.id).states) {
        for (const step of estado.steps) {
          const to = esperada.pasos[step.action].to;
          if (step.to.kind === "status") {
            if (step.to.status !== to) {
              desajustes.push(
                `${esperada.id}: ${step.action} lleva a ${step.to.status} y la tabla dice ${to}`,
              );
            }
            if (step.to.label !== esperada.estados[to]?.label) {
              desajustes.push(
                `${esperada.id}: ${step.action} enseña «${step.to.label}» y el estado es «${esperada.estados[to]?.label}»`,
              );
            }
          }
        }
      }
    }
    expect(desajustes).toEqual([]);
  });

  test("los destinos que no son un estado son los tres que la máquina resuelve sola", () => {
    // Si apareciera otro —una tabla con un destino que no es un estado—, esta
    // prueba lo delata y la ficha tendría que contar cómo se resuelve.
    const sueltos: string[] = [];
    for (const maquina of MAQUINAS) {
      const estados = new Set(Object.keys(maquina.estados));
      for (const paso of Object.values(maquina.pasos)) {
        if (!estados.has(paso.to)) sueltos.push(`${maquina.id}: ${paso.to}`);
      }
    }
    expect(sueltos).toEqual([
      "incident: keptStatus",
      "request: heldFrom",
      "purchaseOrder: allReceived",
    ]);
  });

  test("los destinos abiertos se cuentan como los resuelve el módulo", () => {
    const reasignar = ficha("incident")
      .states.flatMap((estado) => estado.steps)
      .find((step) => step.action === "reassignWorkshop")!;
    const reanudar = ficha("request")
      .states.flatMap((estado) => estado.steps)
      .find((step) => step.action === "resume")!;
    const recepcionar = ficha("purchaseOrder")
      .states.flatMap((estado) => estado.steps)
      .find((step) => step.action === "receive")!;

    expect(reasignar.to.kind).toBe("decided");
    expect(reanudar.to.kind).toBe("decided");
    expect(recepcionar.to.kind).toBe("decided");
    if (reasignar.to.kind === "decided") {
      expect(reasignar.to.note).toContain("mismo estado");
    }
    if (reanudar.to.kind === "decided") {
      expect(reanudar.to.note).toContain("el que salió");
    }
    if (recepcionar.to.kind === "decided") {
      expect(recepcionar.to.note).toContain("lo que haya llegado");
    }

    // Y lo que cuentan las notas es lo que hacen las funciones del módulo.
    expect(nextIncidentStatus("waitingParts", "reassignWorkshop")).toBe(
      "waitingParts",
    );
    expect(resumedStatus(undefined)).toBe("pending");
    expect(
      purchaseOrderStatusAfterReceiving([{ quantity: 2, receivedQuantity: 2 }]),
    ).toBe("completed");
    expect(
      purchaseOrderStatusAfterReceiving([{ quantity: 2, receivedQuantity: 1 }]),
    ).toBe("partial");
  });

  test("lo que no se puede hacer desde un estado va con el motivo de su máquina", () => {
    for (const esperada of MAQUINAS) {
      for (const estado of ficha(esperada.id).states) {
        const bloqueados = estado.blocked.flatMap((grupo) =>
          grupo.labels.map((label) => ({ label, reason: grupo.reason })),
        );

        if (esperada.motivo === undefined) {
          // La que no sabe explicarse no se inventa nada.
          expect(estado.blocked).toEqual([]);
          continue;
        }

        // Todos los pasos que no salen de aquí están, y ninguno más.
        const esperados = Object.entries(esperada.nombres)
          .filter(
            ([accion]) => !esperada.pasos[accion].from.includes(estado.key),
          )
          .map(([, nombre]) => nombre)
          .sort();
        expect(
          bloqueados.map((bloqueado) => bloqueado.label).sort(),
          `${esperada.id}/${estado.key}`,
        ).toEqual(esperados);

        // Y cada uno con el motivo que da la máquina, no con otro.
        for (const bloqueado of bloqueados) {
          const accion = Object.entries(esperada.nombres).find(
            ([, nombre]) => nombre === bloqueado.label,
          )?.[0];
          expect(accion, `«${bloqueado.label}» no es un paso`).toBeDefined();
          expect(bloqueado.reason).toBe(esperada.motivo(estado.key, accion!));
        }
      }
    }
  });
});
