import { describe, expect, test } from "vitest";
import type { IncidentStatus } from "../src/convex/schema";
import {
  INCIDENT_STEP_LABELS,
  blockedIncidentSteps,
  canAdvanceIncident,
  canChangeWorkshopTechnician,
  incidentCloseStep,
  incidentStepBlocker,
  incidentStepStatus,
  incidentTakesPartRequests,
  nextIncidentStatus,
  incidentWithoutPartsStep,
  isClosedIncident,
  isIncidentInProgress,
  isIncidentInWorkshop,
  isIncidentRepairing,
  isIncidentWaitingParts,
  type IncidentAction,
} from "../src/lib/incidentFlow";

/**
 * La tabla esperada, escrita con el tipo del esquema: si se añade un estado a la
 * base sin decidir por dónde pasa, esto no compila y hay que decidirlo. Lo mismo
 * con las acciones, en `DESTINOS`.
 */
const DESDE: Record<IncidentStatus, readonly IncidentAction[]> = {
  reported: ["assign", "selfAssign"],
  assigned: [
    "assign",
    "verifyOnsite",
    "verifyWorkshop",
    "verifyUnresolved",
    "waitParts",
  ],
  workshop: [
    "reassignWorkshop",
    "waitParts",
    "closeResolved",
    "closeUnresolved",
  ],
  waitingParts: [
    "partsArrived",
    "partsSettledOnsite",
    "partsSettledWorkshop",
    // Con el equipo en el taller, cambiar de técnico no mueve el caso.
    "reassignWorkshop",
  ],
  repairing: [
    "verifyOnsite",
    "verifyWorkshop",
    "verifyUnresolved",
    "waitParts",
    "reassignWorkshop",
    "closeResolved",
    "closeUnresolved",
  ],
  resolved: [],
  unresolved: [],
};

/**
 * Y a dónde lleva cada paso. Cambiar el técnico de taller no mueve el caso: su
 * destino es `keptStatus`, el estado del que sale, y por eso no está escrito como
 * uno de los siete.
 */
const DESTINOS: Record<IncidentAction, IncidentStatus | "keptStatus"> = {
  assign: "assigned",
  selfAssign: "assigned",
  verifyOnsite: "resolved",
  verifyWorkshop: "workshop",
  verifyUnresolved: "unresolved",
  reassignWorkshop: "keptStatus",
  waitParts: "waitingParts",
  partsArrived: "repairing",
  partsSettledOnsite: "assigned",
  partsSettledWorkshop: "workshop",
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

  test("cerrar el trabajo de taller no sale de una incidencia sin taller, y verificar no sale de una notificada", () => {
    // El error que esto evita: cerrar como resuelta una incidencia que nunca
    // entró en taller, o mandar a taller una ya resuelta.
    expect(canAdvanceIncident("assigned", "closeResolved")).toBe(false);
    expect(canAdvanceIncident("assigned", "closeUnresolved")).toBe(false);
    expect(canAdvanceIncident("workshop", "verifyOnsite")).toBe(false);
    expect(canAdvanceIncident("workshop", "verifyWorkshop")).toBe(false);
    expect(canAdvanceIncident("reported", "verifyOnsite")).toBe(false);
    expect(canAdvanceIncident("reported", "reassignWorkshop")).toBe(false);
    expect(canAdvanceIncident("workshop", "assign")).toBe(false);
    // Y un caso cerrado no vuelve a moverse, ni para esperar material ni para
    // pedirlo.
    expect(canAdvanceIncident("resolved", "waitParts")).toBe(false);
    expect(canAdvanceIncident("unresolved", "partsArrived")).toBe(false);
    expect(incidentTakesPartRequests("resolved")).toBe(false);
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
    // Y con el equipo en taller, esperando material o ya reparándose: es cuando
    // más falta hace (el que se fue de baja, el que sabe de esa pieza).
    expect(canAdvanceIncident("waitingParts", "reassignWorkshop")).toBe(true);
    expect(canAdvanceIncident("repairing", "reassignWorkshop")).toBe(true);
    // Lo que no se puede es reasignar en una incidencia en el sitio: no hay orden
    // de taller que cambiar (el estado no lo dice; el backend sí lo comprueba).
    expect(canAdvanceIncident("assigned", "reassignWorkshop")).toBe(false);
  });
});

describe("isClosedIncident — lo que va al archivo", () => {
  test("están cerradas las dos formas de terminar", () => {
    expect(isClosedIncident("resolved")).toBe(true);
    expect(isClosedIncident("unresolved")).toBe(true);
  });

  test("lo que se mueve no está cerrado", () => {
    for (const status of [
      "reported",
      "assigned",
      "workshop",
      "waitingParts",
      "repairing",
    ] as const) {
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
  test("está en curso lo que ya tiene quien lo trabaja", () => {
    for (const status of [
      "assigned",
      "workshop",
      "waitingParts",
      "repairing",
    ] as const) {
      expect(isIncidentInProgress(status), status).toBe(true);
    }
  });

  test("ni lo recién notificado ni lo terminado están en curso", () => {
    // Notificada es de nadie todavía (el aviso mide desde que alguien la cogió), y
    // lo cerrado ya no se mide.
    for (const status of ["reported", "resolved", "unresolved"] as const) {
      expect(isIncidentInProgress(status), status).toBe(false);
    }
  });

  test("cada estado es una cosa y solo una: notificada, en curso o cerrada", () => {
    // Las tres preguntas de la máquina reparten los estados sin solaparse ni
    // dejar ninguno suelto: si mañana se añade un estado, esto deja de cuadrar.
    for (const status of [
      "reported",
      "assigned",
      "workshop",
      "waitingParts",
      "repairing",
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
    "waitingParts",
    "repairing",
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

describe("el sitio donde está el equipo — lo que el estado no dice", () => {
  test("una incidencia derivada está en taller por su propio estado", () => {
    expect(isIncidentInWorkshop({ status: "workshop" })).toBe(true);
  });

  test("esperar repuestos o repararse lo dice la entrada a taller abierta", () => {
    // Sin entrada, el equipo está en el banco o en su sitio: no hay orden de
    // taller que cerrar.
    expect(isIncidentInWorkshop({ status: "waitingParts" })).toBe(false);
    expect(isIncidentInWorkshop({ status: "repairing" })).toBe(false);
    // Con ella —el id o, en fichas antiguas, solo el nombre— está en taller.
    expect(
      isIncidentInWorkshop({
        status: "waitingParts",
        workshopAssigneeId: "u1",
      }),
    ).toBe(true);
    expect(
      isIncidentInWorkshop({
        status: "repairing",
        workshopAssigneeName: "Elena Vidal",
      }),
    ).toBe(true);
    // Un nombre en blanco no es una entrada a taller.
    expect(
      isIncidentInWorkshop({ status: "repairing", workshopAssigneeName: "  " }),
    ).toBe(false);
  });

  test("cada estado del ciclo se reconoce por su propia pregunta", () => {
    expect(isIncidentWaitingParts("waitingParts")).toBe(true);
    expect(isIncidentWaitingParts("repairing")).toBe(false);
    expect(isIncidentRepairing("repairing")).toBe(true);
    expect(isIncidentRepairing("waitingParts")).toBe(false);
    // Y las preguntas también aceptan texto que no es un estado del taller.
    expect(isIncidentWaitingParts("")).toBe(false);
    expect(isIncidentRepairing("REPAIRING")).toBe(false);
  });

  test("el cierre que toca lo decide el sitio, no el estado", () => {
    expect(incidentCloseStep("resolved", true)).toBe("closeResolved");
    expect(incidentCloseStep("unresolved", true)).toBe("closeUnresolved");
    expect(incidentCloseStep("resolved", false)).toBe("verifyOnsite");
    expect(incidentCloseStep("unresolved", false)).toBe("verifyUnresolved");
    // Y cada uno se puede dar desde donde la incidencia está cuando toca.
    expect(
      canAdvanceIncident("repairing", incidentCloseStep("resolved", true)),
    ).toBe(true);
    expect(
      canAdvanceIncident("repairing", incidentCloseStep("resolved", false)),
    ).toBe(true);
    expect(
      canAdvanceIncident("workshop", incidentCloseStep("resolved", true)),
    ).toBe(true);
  });

  test("una espera que se queda sin material vuelve a donde estaba", () => {
    expect(incidentWithoutPartsStep(true)).toBe("partsSettledWorkshop");
    expect(incidentWithoutPartsStep(false)).toBe("partsSettledOnsite");
    expect(canAdvanceIncident("waitingParts", "partsSettledWorkshop")).toBe(
      true,
    );
    expect(canAdvanceIncident("waitingParts", "partsSettledOnsite")).toBe(true);
  });

  test("el material se puede pedir mientras el caso se trabaja, y solo entonces", () => {
    for (const status of [
      "assigned",
      "workshop",
      "waitingParts",
      "repairing",
    ] as const) {
      expect(incidentTakesPartRequests(status), status).toBe(true);
    }
    for (const status of ["reported", "resolved", "unresolved"] as const) {
      expect(incidentTakesPartRequests(status), status).toBe(false);
    }
  });

  test("el camino con repuestos: pedir, esperar, recibir y reparar", () => {
    // Asignada → pedir material deja la incidencia esperando.
    expect(canAdvanceIncident("assigned", "waitParts")).toBe(true);
    expect(incidentStepStatus("waitParts")).toBe("waitingParts");
    // Con el material entregado, a reparación; y de ahí se cierra.
    expect(canAdvanceIncident("waitingParts", "partsArrived")).toBe(true);
    expect(incidentStepStatus("partsArrived")).toBe("repairing");
    expect(canAdvanceIncident("repairing", "closeResolved")).toBe(true);
    // Y en taller, el trabajo se cierra desde la orden de taller.
    expect(canAdvanceIncident("repairing", "verifyWorkshop")).toBe(true);
    expect(incidentStepStatus("verifyWorkshop")).toBe("workshop");
    // Devolver el material deja otra vez la incidencia sin la pieza.
    expect(canAdvanceIncident("repairing", "waitParts")).toBe(true);
  });

  test("el botón de cambiar de técnico de taller: estado, sitio y quién lo lleva", () => {
    const enTaller = {
      status: "repairing" as const,
      workshopAssigneeId: "u1",
    };
    // Quien coordina, siempre que haya orden abierta.
    expect(
      canChangeWorkshopTechnician(enTaller, { id: "u2", coordinates: true }),
    ).toBe(true);
    // El técnico que lleva la orden también, y solo si es la suya.
    expect(
      canChangeWorkshopTechnician(enTaller, { id: "u1", coordinates: false }),
    ).toBe(true);
    expect(
      canChangeWorkshopTechnician(enTaller, { id: "u3", coordinates: false }),
    ).toBe(false);
    // Esperando material pasa lo mismo: el estado no cambia, cambia quién lleva
    // el caso.
    expect(
      canChangeWorkshopTechnician(
        { status: "waitingParts", workshopAssigneeId: "u1" },
        { id: "u1", coordinates: false },
      ),
    ).toBe(true);
    // En el sitio no hay orden que reasignar aunque el estado lo permita…
    expect(
      canChangeWorkshopTechnician(
        { status: "repairing" },
        { id: "u1", coordinates: true },
      ),
    ).toBe(false);
    // …ni desde un estado en el que el paso no cabe.
    expect(
      canChangeWorkshopTechnician(
        { status: "assigned", workshopAssigneeId: "u1" },
        { id: "u1", coordinates: true },
      ),
    ).toBe(false);
    expect(
      canChangeWorkshopTechnician(
        { status: "resolved", workshopAssigneeId: "u1" },
        { id: "u1", coordinates: true },
      ),
    ).toBe(false);
  });

  test("cambiar el técnico de taller deja el caso donde estaba", () => {
    // El paso no tiene un destino escrito: devuelve el estado del que sale, que
    // es lo que impide que esperar repuestos se convierta en «en taller» al
    // reasignarlo.
    expect(nextIncidentStatus("workshop", "reassignWorkshop")).toBe("workshop");
    expect(nextIncidentStatus("waitingParts", "reassignWorkshop")).toBe(
      "waitingParts",
    );
    expect(nextIncidentStatus("repairing", "reassignWorkshop")).toBe(
      "repairing",
    );
    // Donde el paso no se puede dar no hay estado al que llegar.
    expect(nextIncidentStatus("assigned", "reassignWorkshop")).toBeNull();
    expect(nextIncidentStatus("resolved", "reassignWorkshop")).toBeNull();
    // Y para los demás pasos es el destino de siempre, también con el cierre.
    expect(nextIncidentStatus("assigned", "verifyWorkshop")).toBe("workshop");
    expect(nextIncidentStatus("waitingParts", "partsArrived")).toBe(
      "repairing",
    );
  });
});
