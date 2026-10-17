import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  INCIDENT_STEP_LABELS,
  canAdvanceIncident,
  nextIncidentStatus,
  type IncidentAction,
} from "../src/lib/incidentFlow";
import {
  REQUEST_STEPS,
  REQUEST_STEP_LABELS,
  canRequestStep,
  nextRequestStatus,
  type RequestAction,
} from "../src/lib/requestFlow";
import {
  PURCHASE_ORDER_STEP_LABELS,
  PURCHASE_ORDER_STEPS,
  canAdvancePurchaseOrder,
  purchaseOrderStatusAfterReceiving,
  type PurchaseOrderAction,
} from "../src/lib/purchaseFlow";
import { PURCHASE_ORDER_STATUS_META } from "../src/lib/purchasing";
import {
  INCIDENT_STATUS_META,
  STATUS_META,
  type IncidentStatus,
  type RequestStatus,
} from "../src/lib/workshop";
// El mismo lector que compara `MAQUINAS.md` con el código: aquí se le pasa el
// documento de especificaciones y el nivel de sus cabeceras.
import { diagrams, documentedRows, parametricDestination } from "./machineDoc";

/**
 * Los ciclos que cuenta `.context/specifications.md` —la incidencia, la petición
 * de repuesto y la orden de compra—, contra las máquinas que los ejecutan
 * (`lib/incidentFlow`, `lib/requestFlow`, `lib/purchaseFlow`).
 *
 * Un documento que se queda atrás no avisa: el dibujo sigue pareciendo correcto
 * aunque el ciclo haya cambiado, y una lista de estados inventados —los que tuvo
 * este apartado durante un tiempo— se lee igual de bien que la de verdad. Por eso
 * esto no comprueba que el apartado exista, sino que diga lo que dice el código:
 * los estados con el nombre que enseña la app, y ni una transición de menos —el
 * documento mentiría por omisión— ni una de más —la máquina no la permite—, ni un
 * destino equivocado, ni un paso con otro nombre.
 *
 * `MAQUINAS.md` guarda los mismos ciclos con quién puede dar cada paso, y lo lee
 * `tests/maquinas.test.ts`; aquí se vigila la otra cara: los ciclos contados en las
 * especificaciones, sin la columna de permisos.
 */

const SPECS = readFileSync(
  new URL("../.context/specifications.md", import.meta.url),
  "utf8",
);

/** Las tablas de pasos del documento, por máquina. */
const tables = documentedRows(SPECS, "####");

/**
 * Una de las máquinas, tal y como la conoce el código y la cuenta el documento.
 */
interface Machine {
  /** El nombre de su tabla y de su dibujo en el documento. */
  key: string;
  /** Sus estados, con el nombre que les pone la app. */
  statuses: Record<string, { label: string }>;
  /** El nombre corto de cada paso, para poder llamarlos como los llama la app. */
  labels: Record<string, string>;
  /** ¿Se puede dar este paso desde este estado? */
  allows: (status: string, action: string) => boolean;
  /** A dónde lleva, o `null` si el destino no es un estado fijo. */
  destination: (status: string, action: string) => string | null;
  /**
   * Los finales del paso de destino abierto, cuando el dibujo los enseña uno a
   * uno: al recepcionar, la orden queda completada o parcial, y no otro estado
   * cualquiera. Sin lista, el dibujo solo puede usar los estados de la máquina.
   */
  openEnds?: string[];
}

/**
 * Cómo escribe cada documento el destino que no es un estado fijo: al reanudar,
 * la petición vuelve al estado del que salió (`heldFrom`); al recepcionar, la
 * orden queda completada o parcial según lo que haya llegado (`allReceived`).
 */
const OPEN_DESTINATIONS: Record<string, string> = {
  request: "heldFrom",
  purchaseOrder: "allReceived",
};

/** El destino abierto de este paso, si lo es: lo decide el código, no la tabla. */
function openDestination(machine: string, action: string): string | null {
  if (!parametricDestination(machine, action)) return null;
  return OPEN_DESTINATIONS[machine] ?? null;
}

const MACHINES: Machine[] = [
  {
    key: "incident",
    statuses: INCIDENT_STATUS_META,
    labels: INCIDENT_STEP_LABELS,
    allows: (status, action) =>
      canAdvanceIncident(status as IncidentStatus, action as IncidentAction),
    destination: (status, action) =>
      nextIncidentStatus(status as IncidentStatus, action as IncidentAction),
  },
  {
    key: "request",
    statuses: STATUS_META,
    labels: REQUEST_STEP_LABELS,
    allows: (status, action) =>
      canRequestStep(status as RequestStatus, action as RequestAction),
    destination: (status, action) =>
      openDestination("request", action) === null
        ? nextRequestStatus(status as RequestStatus, action as RequestAction)
        : null,
    // Al reanudar se vuelve al estado del que salió la suspensión, y se suspende
    // desde estos: la tabla de `hold` es la lista de finales posibles.
    openEnds: [...REQUEST_STEPS.hold.from],
  },
  {
    key: "purchaseOrder",
    statuses: PURCHASE_ORDER_STATUS_META,
    labels: PURCHASE_ORDER_STEP_LABELS,
    allows: (status, action) =>
      canAdvancePurchaseOrder(status, action as PurchaseOrderAction),
    destination: (_status, action) => {
      const to = PURCHASE_ORDER_STEPS[action as PurchaseOrderAction]?.to;
      return to === undefined || to === "allReceived" ? null : to;
    },
    // Los dos finales que el código puede devolver, preguntados al código: todo
    // recibido, o algo a medias.
    openEnds: [
      purchaseOrderStatusAfterReceiving([{ quantity: 1, receivedQuantity: 1 }]),
      purchaseOrderStatusAfterReceiving([{ quantity: 1, receivedQuantity: 0 }]),
    ],
  },
];

/**
 * Los estados con el nombre que les pone la app, de la tabla
 * `#### Estados — <máquina>`: la primera columna lleva el estado entre acentos
 * graves y la segunda, su nombre tal y como se lee en pantalla.
 */
function documentedStates(key: string): { state: string; label: string }[] {
  const states: { state: string; label: string }[] = [];
  const cabecera = `#### Estados — ${key}`;
  let inside = false;
  for (const line of SPECS.split(/\r?\n/)) {
    const text = line.trim();
    if (text.startsWith("#")) {
      inside = text === cabecera;
      continue;
    }
    if (!inside) continue;
    const cells = text.split("|");
    if (cells.length !== 5) continue;
    const state = /`(\w+)`/.exec(cells[1])?.[1];
    const label = cells[2].trim();
    if (state === undefined || label === "") continue;
    states.push({ state, label });
  }
  return states;
}

/** El dibujo de una máquina: el bloque que se declara como suyo. */
function drawing(key: string): string[] {
  const block = diagrams(SPECS).find((candidate) =>
    candidate.includes(`%% machine: ${key}`),
  );
  if (block === undefined) {
    throw new Error(`Falta el dibujo del ciclo de «${key}».`);
  }
  return block;
}

/** Las parejas `estado/paso` que la máquina permite de verdad. */
function allowedPairs(machine: Machine): string[] {
  const pairs: string[] = [];
  for (const status of Object.keys(machine.statuses)) {
    for (const action of Object.keys(machine.labels)) {
      if (machine.allows(status, action)) pairs.push(`${status}/${action}`);
    }
  }
  return pairs.sort();
}

describe("los ciclos de las especificaciones, contra el código", () => {
  test("cada máquina tiene su tabla de pasos y su dibujo, y ninguna de más", () => {
    expect(Object.keys(tables).sort()).toEqual(
      MACHINES.map((machine) => machine.key).sort(),
    );
    expect(diagrams(SPECS).length).toBe(MACHINES.length);
  });

  test("nombra los estados de cada máquina, con el nombre que enseña la app", () => {
    for (const machine of MACHINES) {
      const states = documentedStates(machine.key);
      const what = machine.key;
      // Los suyos y ni uno más: un estado nuevo en la máquina sin documentar deja
      // esta comparación corta, y uno documentado que ya no existe, larga.
      expect(states.map((item) => item.state).sort(), what).toEqual(
        Object.keys(machine.statuses).sort(),
      );
      for (const { state, label } of states) {
        expect(label, `${what}: ${state}`).toBe(machine.statuses[state].label);
      }
    }
  });

  test("las transiciones del documento son exactamente las que permite cada máquina", () => {
    for (const machine of MACHINES) {
      const rows = tables[machine.key];
      const what = machine.key;
      expect(rows.length, what).toBeGreaterThan(0);
      // Ni una de más: cada fila nombra un estado y un paso que existen.
      for (const row of rows) {
        expect(Object.keys(machine.statuses), `${what}: ${row.from}`).toContain(
          row.from,
        );
        expect(Object.keys(machine.labels), `${what}: ${row.action}`).toContain(
          row.action,
        );
      }
      const documented = rows.map((row) => `${row.from}/${row.action}`).sort();
      // Ni una de menos, ni repetida.
      expect(documented, what).toEqual(allowedPairs(machine));
      expect(new Set(documented).size, `${what}: repetidas`).toBe(
        documented.length,
      );
    }
  });

  test("cada paso lleva al estado que dice el documento y se llama como el sistema", () => {
    for (const machine of MACHINES) {
      for (const row of tables[machine.key]) {
        const what = `${machine.key}: ${row.from} → ${row.action}`;
        expect(machine.allows(row.from, row.action), what).toBe(true);
        const destination = machine.destination(row.from, row.action);
        if (destination === null) {
          // El destino no es un estado fijo: el documento tiene que escribirlo
          // como lo escribe la tabla de su módulo.
          expect(row.to, what).toBe(openDestination(machine.key, row.action));
        } else {
          expect(row.to, what).toBe(destination);
        }
        // Y el paso se llama como lo llama la ficha, no como a cada uno le suene.
        expect(row.wording, what).toBe(machine.labels[row.action]);
      }
    }
  });

  test("el dibujo de cada ciclo solo usa estados suyos y flechas que la máquina permite", () => {
    for (const machine of MACHINES) {
      const cycle = drawing(machine.key);
      // Los destinos abiertos también se dibujan —al reanudar, la petición vuelve
      // a un estado que depende de por dónde salió—, y solo mientras lo sean: si
      // el paso dejara de tener destino abierto, el documento tendría que decir un
      // estado concreto.
      const open = Object.keys(machine.labels).some(
        (action) => openDestination(machine.key, action) !== null,
      )
        ? (OPEN_DESTINATIONS[machine.key] ?? null)
        : null;
      const nodes = [
        ...Object.keys(machine.statuses),
        ...(open === null ? [] : [open]),
      ];
      // Lo dibujado, separado por lo que se puede comparar: los pasos con destino
      // fijo se dibujan uno a uno —y se comparan fila a fila—, y los de destino
      // abierto se dibujan con todos sus finales —completada y parcial—, que es
      // más de lo que dice su única fila.
      const drawnFixed: string[] = [];
      const drawnOpen: string[] = [];
      let arrows = 0;
      for (const line of cycle) {
        const parsed =
          /^(\[\*\]|\w+)\s*-->\s*(\[\*\]|\w+)(?:\s*:\s*(.*))?$/.exec(line);
        if (parsed === null) continue;
        arrows += 1;
        const [, from, to, label] = parsed;
        if (label === undefined) {
          // Sin nombre solo pueden ir la entrada y la salida del ciclo.
          expect(from === "[*]" || to === "[*]", line).toBe(true);
          continue;
        }
        const action = label.split(/\s+/)[0];
        const what = `${machine.key}: ${line}`;
        expect(Object.keys(machine.labels), what).toContain(action);
        expect(
          Object.keys(machine.statuses),
          `${what}: estado de salida`,
        ).toContain(from);
        expect(nodes, `${what}: estado de llegada`).toContain(to);
        expect(machine.allows(from, action), what).toBe(true);
        const destination = machine.destination(from, action);
        if (destination === null) {
          // Un destino abierto se dibuja con su nombre (`heldFrom`) o con sus
          // finales (`completed`, `partial`), y esos finales son los que puede
          // devolver el código, no cualquier estado de la máquina.
          if (to !== openDestination(machine.key, action) && machine.openEnds) {
            expect(machine.openEnds, `${what}: final abierto`).toContain(to);
          }
          drawnOpen.push(`${from}/${action}`);
          continue;
        }
        expect(to, what).toBe(destination);
        drawnFixed.push(`${from}/${action}/${to}`);
      }
      expect(arrows, `${machine.key}: sin flechas`).toBeGreaterThan(0);
      // El dibujo no se deja ninguna transición de la tabla: lo que la máquina
      // permite está dibujado, y lo dibujado está permitido.
      const rows = tables[machine.key];
      const isOpen = (row: { from: string; action: string }) =>
        machine.destination(row.from, row.action) === null;
      expect(drawnFixed.sort(), machine.key).toEqual(
        rows
          .filter((row) => !isOpen(row))
          .map((row) => `${row.from}/${row.action}/${row.to}`)
          .sort(),
      );
      expect(
        [...new Set(drawnOpen)].sort(),
        `${machine.key}: destino abierto`,
      ).toEqual(
        [
          ...new Set(
            rows.filter(isOpen).map((row) => `${row.from}/${row.action}`),
          ),
        ].sort(),
      );
    }
  });
});
