import { describe, expect, test } from "vitest";
import { CAPABILITIES } from "../src/lib/permissions";
import {
  INCIDENT_STEP_LABELS,
  canAdvanceIncident,
  incidentStepStatus,
  type IncidentAction,
} from "../src/lib/incidentFlow";
import {
  REQUEST_STEP_LABELS,
  nextRequestStatus,
  type RequestAction,
} from "../src/lib/requestFlow";
import {
  PURCHASE_REQUEST_STATUS_META,
  PURCHASE_ORDER_STATUS_META,
  type PurchaseOrderStatus,
} from "../src/lib/purchasing";
import {
  PURCHASE_ORDER_STEP_LABELS,
  canAdvancePurchaseOrder,
  nextPurchaseRequestStatus,
  purchaseOrderStatusAfterReceiving,
  type PurchaseOrderAction,
  type PurchaseRequestAction,
} from "../src/lib/purchaseFlow";
import {
  INCIDENT_STATUS_META,
  STATUS_META,
  type IncidentStatus,
  type RequestStatus,
} from "../src/lib/workshop";
// El documento, leído por el mismo sitio que `maquinasPermisos.test.ts`: aquí se
// comprueba contra las tablas del código y allí contra el backend.
import { diagrams, documentedRows } from "./machineDoc";

/**
 * El diagrama de las tres máquinas —`MAQUINAS.md`, en la raíz— leído contra el
 * código que dibuja.
 *
 * Un dibujo que se queda atrás no avisa: sigue pareciendo correcto. Por eso esto
 * no comprueba que el documento exista, sino que diga lo que dicen las máquinas:
 * ni una transición de menos —el documento mentiría por omisión—, ni una de más
 * —la máquina no la permite—, ni un destino equivocado, ni un paso sin nadie que
 * pueda darlo, ni una capacidad inventada.
 */

/**
 * ¿El destino de este paso depende de algo más que el estado del que sale? Se
 * pregunta al código en vez de escribirlo a mano: si algún día reanudar volviera
 * siempre al mismo sitio, o una recepción ya no pudiera quedar a medias, esto
 * deja de dar por bueno el destino abierto y el documento tendrá que decir un
 * estado concreto.
 */
function parametric(machine: string, action: string): boolean {
  if (machine === "request" && action === "resume") {
    return (
      nextRequestStatus("onHold", "resume", "approved") !==
      nextRequestStatus("onHold", "resume", undefined)
    );
  }
  if (machine === "purchaseOrder" && action === "receive") {
    // Recibir todo de un artículo y nada de otro: completada, o parcial.
    const all = purchaseOrderStatusAfterReceiving([
      { quantity: 1, receivedQuantity: 1 },
    ]);
    const part = purchaseOrderStatusAfterReceiving([
      { quantity: 2, receivedQuantity: 1 },
    ]);
    return all !== part;
  }
  return false;
}

/**
 * Una de las tres máquinas (la compra lleva dos dentro), tal y como la conoce el
 * código.
 */
interface Machine {
  /** El nombre de su tabla en el documento. */
  key: string;
  /** Sus estados. */
  statuses: string[];
  /** Sus pasos. */
  actions: string[];
  /** El nombre corto de cada paso, si el módulo lo tiene escrito. */
  labels: Record<string, string> | null;
  /** ¿Se puede dar este paso desde este estado? */
  allows: (status: string, action: string) => boolean;
  /** A dónde lleva, o `null` si el destino no es un estado fijo. */
  destination: (status: string, action: string) => string | null;
  /** El destino abierto, escrito como lo escribe la tabla del módulo. */
  parametricTo: string | null;
}

/**
 * Los pasos de la petición de compra, escritos con el tipo del módulo: una
 * acción nueva sin fila en el documento no compila.
 */
const PURCHASE_REQUEST_ACTIONS: Record<PurchaseRequestAction, true> = {
  order: true,
  unorder: true,
  cancel: true,
  receive: true,
};

/**
 * Los dos destinos que no son un estado fijo, escritos como los escribe la tabla
 * de su módulo: al reanudar, la petición vuelve al estado del que salió
 * (`heldFrom`); al recepcionar, la orden queda completada o parcial según lo que
 * haya llegado (`allReceived`).
 */
const PARAMETRIC: Record<string, string> = {
  request: "heldFrom",
  purchaseOrder: "allReceived",
};

const MACHINES: Machine[] = [
  {
    key: "incident",
    statuses: Object.keys(INCIDENT_STATUS_META),
    actions: Object.keys(INCIDENT_STEP_LABELS),
    labels: INCIDENT_STEP_LABELS,
    allows: (status, action) =>
      canAdvanceIncident(status as IncidentStatus, action as IncidentAction),
    destination: (_status, action) =>
      incidentStepStatus(action as IncidentAction),
    parametricTo: null,
  },
  {
    key: "request",
    statuses: Object.keys(STATUS_META),
    actions: Object.keys(REQUEST_STEP_LABELS),
    labels: REQUEST_STEP_LABELS,
    allows: (status, action) =>
      nextRequestStatus(status as RequestStatus, action as RequestAction) !==
      null,
    destination: (status, action) =>
      parametric("request", action)
        ? null
        : nextRequestStatus(status as RequestStatus, action as RequestAction),
    parametricTo: PARAMETRIC.request,
  },
  {
    key: "purchaseRequest",
    statuses: Object.keys(PURCHASE_REQUEST_STATUS_META),
    actions: Object.keys(PURCHASE_REQUEST_ACTIONS),
    // Sus pasos no tienen nombre corto escrito: lo que cuenta el documento
    // después del nombre del paso es prosa, y aquí no se compara.
    labels: null,
    allows: (status, action) =>
      nextPurchaseRequestStatus(status, action as PurchaseRequestAction) !==
      null,
    destination: (status, action) =>
      nextPurchaseRequestStatus(status, action as PurchaseRequestAction),
    parametricTo: null,
  },
  {
    key: "purchaseOrder",
    statuses: Object.keys(PURCHASE_ORDER_STATUS_META),
    actions: Object.keys(PURCHASE_ORDER_STEP_LABELS),
    labels: PURCHASE_ORDER_STEP_LABELS,
    allows: (status, action) =>
      canAdvancePurchaseOrder(status, action as PurchaseOrderAction),
    destination: (_status, action) =>
      parametric("purchaseOrder", action)
        ? null
        : ("cancelled" as const satisfies PurchaseOrderStatus),
    parametricTo: PARAMETRIC.purchaseOrder,
  },
];

/** Las parejas `estado/paso` que la máquina permite de verdad. */
function allowedPairs(machine: Machine): string[] {
  const pairs: string[] = [];
  for (const status of machine.statuses) {
    for (const action of machine.actions) {
      if (machine.allows(status, action)) pairs.push(`${status}/${action}`);
    }
  }
  return pairs.sort();
}

const tables = documentedRows();

describe("el diagrama de las tres máquinas, contra el código", () => {
  test("dibuja las cuatro tablas —tres máquinas y las dos caras de la compra— y ninguna de más", () => {
    expect(Object.keys(tables).sort()).toEqual(
      MACHINES.map((machine) => machine.key).sort(),
    );
    // Y cada tabla tiene su dibujo: el diagrama es lo que se mira primero.
    expect(diagrams().length).toBe(MACHINES.length);
  });

  test("los diagramas solo dibujan estados que existen, y sus flechas llevan un paso de verdad", () => {
    const blocks = diagrams();
    MACHINES.forEach((machine, index) => {
      // Los destinos abiertos también se dibujan: al reanudar, la petición vuelve
      // a un estado que depende de por dónde salió.
      const nodes = machine.parametricTo
        ? [...machine.statuses, machine.parametricTo]
        : machine.statuses;
      const edges = blocks[index].filter((line) => line.includes("-->"));
      expect(edges.length, `${machine.key}: sin flechas`).toBeGreaterThan(0);
      for (const edge of edges) {
        const what = `${machine.key}: ${edge}`;
        const parsed = /^(\[\*\]|\w+)\s*-->\s*(\[\*\]|\w+)(?::\s*(.*))?$/.exec(
          edge,
        );
        expect(parsed, what).not.toBeNull();
        const [, from, to, label] = parsed!;
        for (const side of [from, to]) {
          if (side === "[*]") continue;
          expect(nodes, what).toContain(side);
        }
        if (label === undefined) {
          // Una flecha sin nombre es la entrada o la salida: por dónde nace la
          // máquina y por dónde se da por terminada.
          expect(from === "[*]" || to === "[*]", what).toBe(true);
          continue;
        }
        const action = label.split(/\s+/)[0];
        expect(machine.actions, what).toContain(action);
        // Y la flecha dibuja algo que la máquina permite: ni un paso que se
        // nombre bien pero no se pueda dar desde ahí —`resolved` no se asigna—,
        // ni un destino que no sea el suyo.
        expect(machine.allows(from, action), what).toBe(true);
        const destination = machine.destination(from, action);
        if (destination === null) {
          // Destino abierto: el dibujo enseña los finales posibles —completada y
          // parcial, o el estado del que salió— y aquí no se le pide uno solo.
          expect([...nodes, machine.parametricTo], what).toContain(to);
          continue;
        }
        expect(to, what).toBe(destination);
      }
    });
  });

  test("las transiciones del documento son exactamente las que permite cada máquina", () => {
    for (const machine of MACHINES) {
      const rows = tables[machine.key];
      // Ni una de más: cada fila nombra un estado y un paso que existen.
      for (const row of rows) {
        expect(machine.statuses, `${machine.key}: ${row.from}`).toContain(
          row.from,
        );
        expect(machine.actions, `${machine.key}: ${row.action}`).toContain(
          row.action,
        );
      }
      const documented = rows.map((row) => `${row.from}/${row.action}`).sort();
      // Ni una de menos, ni repetida: lo que la máquina permite está dibujado.
      expect(documented, `${machine.key}: transiciones`).toEqual(
        allowedPairs(machine),
      );
      expect(new Set(documented).size, `${machine.key}: repetidas`).toBe(
        documented.length,
      );
    }
  });

  test("cada paso lleva al estado que dice el documento", () => {
    for (const machine of MACHINES) {
      for (const row of tables[machine.key]) {
        const what = `${machine.key}: ${row.from} → ${row.action}`;
        const to = machine.destination(row.from, row.action);
        if (to === null) {
          // El destino no es un estado fijo: el documento tiene que escribirlo
          // como lo escribe la tabla de su módulo.
          expect(machine.parametricTo, what).not.toBeNull();
          expect(row.to, what).toBe(machine.parametricTo);
          continue;
        }
        expect(row.to, what).toBe(to);
      }
    }
  });

  test("cada paso se llama como lo llama el sistema, y lleva quien lo pueda dar", () => {
    const known = CAPABILITIES.map((item) => item.id);
    for (const machine of MACHINES) {
      for (const row of tables[machine.key]) {
        const what = `${machine.key}: ${row.action}`;
        if (machine.labels) {
          expect(row.wording, what).toBe(machine.labels[row.action]);
        }
        // Todo paso tiene puerta: al menos una capacidad, y de las que existen.
        expect(row.caps.length, what).toBeGreaterThan(0);
        for (const cap of row.caps) {
          expect(known, `${what} → ${cap}`).toContain(cap);
        }
      }
    }
  });
});
