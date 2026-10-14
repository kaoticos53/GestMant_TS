import { describe, expect, test } from "vitest";
import type { IncidentStatus } from "../src/convex/schema";
import {
  INCIDENT_STEP_LABELS,
  blockedIncidentSteps,
  canAdvanceIncident,
  incidentStepBlocker,
  incidentStepStatus,
  isClosedIncident,
  isIncidentInProgress,
  type IncidentAction,
} from "../src/lib/incidentFlow";

/**
 * La tabla esperada, escrita con el tipo del esquema: si se añade un estado a la
 * base sin decidir por dónde pasa, esto no compila y hay que decidirlo. Lo mismo
 * con las acciones, en `DESTINOS`.
 */
const DESDE: Record<IncidentStatus, readonly IncidentAction[]> = {
  reported: ["assign", "selfAssign"],
  assigned: ["assign", "verifyOnsite", "verifyWorkshop", "verifyUnresolved"],
  workshop: ["reassignWorkshop", "closeResolved", "closeUnresolved"],
  resolved: [],
  unresolved: [],
};

/** Y a dónde lleva cada paso. */
const DESTINOS: Record<IncidentAction, IncidentStatus> = {
  assign: "assigned",
  selfAssign: "assigned",
  verifyOnsite: "resolved",
  verifyWorkshop: "workshop",
  verifyUnresolved: "unresolved",
  reassignWorkshop: "workshop",
  closeResolved: "resolved",
  closeUnresolved: "unresolved",
};

const ACCIONES = Object.keys(DESTINOS) as IncidentAction[];

describe("la máquina de la incidencia — qué se puede hacer desde cada estado", () => {
  test("desde cada estado se puede dar exactamente lo que está decidido", () => {
    for (const [status, actions] of Object.entries(DESDE) as [
      IncidentStatus,
      readonly IncidentAction[],
    ][]) {
      for (const action of ACCIONES) {
        expect(
          canAdvanceIncident(status, action),
          `${action} desde ${status}`,
        ).toBe(actions.includes(action));
      }
    }
  });

  test("cada paso lleva a donde dice, y llevar a un sitio no lo convierte en legal desde cualquier parte", () => {
    for (const action of ACCIONES) {
      expect(incidentStepStatus(action), action).toBe(DESTINOS[action]);
      // La tabla no puede decir «assign lleva a assigned» y luego dejar darlo
      // desde un estado cerrado.
      for (const status of Object.keys(DESDE) as IncidentStatus[]) {
        if (canAdvanceIncident(status, action)) {
          expect(isClosedIncident(status), `${action} desde ${status}`).toBe(
            false,
          );
        }
      }
    }
  });

  test("desde una incidencia cerrada no se mueve nada", () => {
    for (const status of ["resolved", "unresolved"] as IncidentStatus[]) {
      for (const action of ACCIONES) {
        expect(canAdvanceIncident(status, action), `${action}`).toBe(false);
      }
    }
  });

  test("cerrar el trabajo de taller es solo desde el taller, y verificar solo desde asignada", () => {
    // El error que esto evita: cerrar como resuelta una incidencia que nunca
    // entró en taller, o mandar a taller una ya resuelta.
    expect(canAdvanceIncident("assigned", "closeResolved")).toBe(false);
    expect(canAdvanceIncident("assigned", "closeUnresolved")).toBe(false);
    expect(canAdvanceIncident("workshop", "verifyOnsite")).toBe(false);
    expect(canAdvanceIncident("workshop", "verifyWorkshop")).toBe(false);
    expect(canAdvanceIncident("reported", "verifyOnsite")).toBe(false);
    expect(canAdvanceIncident("reported", "reassignWorkshop")).toBe(false);
    expect(canAdvanceIncident("workshop", "assign")).toBe(false);
  });

  test("el camino completo: notificada, asignada, taller y cerrada", () => {
    expect(canAdvanceIncident("reported", "selfAssign")).toBe(true);
    expect(canAdvanceIncident("reported", "assign")).toBe(true);
    expect(canAdvanceIncident("assigned", "verifyWorkshop")).toBe(true);
    expect(canAdvanceIncident("workshop", "closeResolved")).toBe(true);
    expect(canAdvanceIncident("workshop", "closeUnresolved")).toBe(true);
  });

  test("una incidencia ya asignada se puede reasignar, y la orden de taller también", () => {
    expect(canAdvanceIncident("assigned", "assign")).toBe(true);
    expect(canAdvanceIncident("workshop", "reassignWorkshop")).toBe(true);
  });
});

describe("isClosedIncident — lo que va al archivo", () => {
  test("están cerradas las dos formas de terminar", () => {
    expect(isClosedIncident("resolved")).toBe(true);
    expect(isClosedIncident("unresolved")).toBe(true);
  });

  test("lo que se mueve no está cerrado", () => {
    for (const status of ["reported", "assigned", "workshop"] as const) {
      expect(isClosedIncident(status), status).toBe(false);
    }
  });

  test("lo que no es un estado del taller tampoco está cerrado", () => {
    // La pregunta se hace también sobre filas ligeras del archivo, que traen su
    // estado como texto.
    for (const text of ["", "withdrawn", "RESOLVED", "resolved "]) {
      expect(isClosedIncident(text), `«${text}»`).toBe(false);
    }
  });
});

describe("isIncidentInProgress — lo que el aviso cuenta como trabajo en curso", () => {
  test("está en curso lo que ya tiene quien lo trabaja: asignada y en taller", () => {
    expect(isIncidentInProgress("assigned")).toBe(true);
    expect(isIncidentInProgress("workshop")).toBe(true);
  });

  test("ni lo recién notificado ni lo terminado están en curso", () => {
    // Notificada es de nadie todavía (el aviso mide desde que alguien la cogió), y
    // lo cerrado ya no se mide.
    for (const status of ["reported", "resolved", "unresolved"] as const) {
      expect(isIncidentInProgress(status), status).toBe(false);
    }
  });

  test("cada estado es una cosa y solo una: notificada, en curso o cerrada", () => {
    // Las tres preguntas de la máquina reparten los cinco estados sin solaparse ni
    // dejar ninguno suelto: si mañana se añade un estado, esto deja de cuadrar.
    for (const status of [
      "reported",
      "assigned",
      "workshop",
      "resolved",
      "unresolved",
    ] as IncidentStatus[]) {
      const donde = [
        status === "reported",
        isIncidentInProgress(status),
        isClosedIncident(status),
      ].filter(Boolean);
      expect(donde, status).toHaveLength(1);
    }
  });

  test("un estado que no es del taller no está en curso", () => {
    // El aviso también mira filas que traen el estado como texto.
    for (const text of ["", "in_progress", "ASSIGNED", " workshop"]) {
      expect(isIncidentInProgress(text), `«${text}»`).toBe(false);
    }
  });
});

describe("por qué no se puede dar un paso — lo que explica la ficha", () => {
  const ESTADOS: IncidentStatus[] = [
    "reported",
    "assigned",
    "workshop",
    "resolved",
    "unresolved",
  ];
  const PASOS = Object.keys(INCIDENT_STEP_LABELS) as IncidentAction[];

  test("hay motivo exactamente cuando el paso no es legal", () => {
    for (const status of ESTADOS) {
      for (const action of PASOS) {
        const reason = incidentStepBlocker(status, action);
        expect(reason === null, `${action} desde ${status}`).toBe(
          canAdvanceIncident(status, action),
        );
        if (reason !== null) expect(reason.trim(), action).not.toBe("");
      }
    }
  });

  test("lo que tiene arreglo se cuenta con lo que hay que hacer antes", () => {
    expect(incidentStepBlocker("reported", "verifyWorkshop")).toContain(
      "no la ha cogido nadie",
    );
    expect(incidentStepBlocker("reported", "closeResolved")).toContain(
      "primero alguien tiene que mirarla",
    );
    // El que la máquina documenta como motivo de existir del paso propio.
    expect(incidentStepBlocker("assigned", "closeResolved")).toContain(
      "primero verifícala",
    );
    expect(incidentStepBlocker("assigned", "selfAssign")).toContain(
      "ya tiene técnico",
    );
    expect(incidentStepBlocker("workshop", "verifyWorkshop")).toContain(
      "se cierra desde ahí",
    );
  });

  test("una incidencia cerrada lo dice una vez, no paso a paso", () => {
    for (const status of ["resolved", "unresolved"] as IncidentStatus[]) {
      const groups = blockedIncidentSteps(status);
      expect(groups, status).toHaveLength(1);
      expect(groups[0].reason, status).toContain("ya está cerrada");
      // Y lo dice de todos los pasos de la ficha: no se reabre desde aquí.
      expect(groups[0].actions).toEqual(
        expect.arrayContaining(["selfAssign", "assign", "closeResolved"]),
      );
    }
  });

  test("lo que sí se puede dar no aparece en la explicación", () => {
    // En taller: cerrar el trabajo sí se puede; cambiarla de técnico, no, y eso
    // es justo lo que se explica.
    const bloqueados = blockedIncidentSteps("workshop").flatMap(
      (group) => group.actions,
    );
    expect(bloqueados).not.toContain("closeResolved");
    expect(bloqueados).not.toContain("closeUnresolved");
    for (const action of bloqueados) {
      expect(canAdvanceIncident("workshop", action), action).toBe(false);
    }
  });
});
