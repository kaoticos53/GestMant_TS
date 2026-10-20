import { describe, expect, test } from "vitest";
import {
  INCIDENT_STEP_LABELS,
  incidentStepBlocker,
  type IncidentStatus,
} from "@/lib/incidentFlow";
import {
  blockedJourneySteps,
  incidentJourney,
  isWorkshopStage,
  nextIncidentAction,
} from "@/lib/incidentJourney";

/** Las etapas resumidas como «clave:estado», que es lo que se quiere comprobar. */
function resumen(status: IncidentStatus, inWorkshop: boolean): string[] {
  return incidentJourney(status, { inWorkshop }).map(
    (stage) => `${stage.key}:${stage.state}`,
  );
}

describe("el recorrido de una incidencia", () => {
  test("recién notificada: la primera etapa es la de ahora y el resto espera", () => {
    expect(resumen("reported", false)).toEqual([
      "reported:current",
      "assigned:pending",
      "workshop:pending",
      "closed:pending",
    ]);
  });

  test("asignada: la notificación queda hecha y el taller espera", () => {
    expect(resumen("assigned", false)).toEqual([
      "reported:done",
      "assigned:current",
      "workshop:pending",
      "closed:pending",
    ]);
  });

  test("en taller: la etapa de taller es la de ahora y se llama por su estado", () => {
    const [reported, assigned, workshop] = incidentJourney("workshop", {
      inWorkshop: true,
    });
    expect(reported.state).toBe("done");
    expect(assigned.state).toBe("done");
    expect(workshop.state).toBe("current");
    expect(workshop.label).toBe("En taller");
  });

  test("esperando repuestos y reparación se cuentan dentro de la etapa de taller", () => {
    expect(isWorkshopStage("waitingParts")).toBe(true);
    expect(isWorkshopStage("repairing")).toBe(true);
    expect(isWorkshopStage("assigned")).toBe(false);

    // La etapa se llama «En taller» en los tres casos: el detalle —espera de
    // material, reparación— va en la línea de «Ahora», que es la que lo cuenta.
    const waiting = incidentJourney("waitingParts", { inWorkshop: true });
    expect(waiting[2]).toMatchObject({ state: "current", label: "En taller" });

    const repairing = incidentJourney("repairing", { inWorkshop: true });
    expect(repairing[2]).toMatchObject({
      state: "current",
      label: "En taller",
    });
  });

  test("resuelta: el cierre es la etapa de ahora", () => {
    const stages = incidentJourney("resolved", { inWorkshop: true });
    expect(stages.map((stage) => stage.state)).toEqual([
      "done",
      "done",
      "done",
      "current",
    ]);
    expect(stages[3].label).toBe("Resuelta");
  });

  test("sin resolución no se pinta como un cierre feliz", () => {
    const stages = incidentJourney("unresolved", { inWorkshop: true });
    expect(stages[3].state).toBe("current");
    expect(stages[3].label).toBe("Sin resolución");
  });

  test("cerrada en el sitio: la etapa de taller no se cuenta como pasada", () => {
    expect(resumen("resolved", false)[2]).toBe("workshop:skipped");
  });

  test("archivada: el cierre queda hecho y el archivo pasa a ser la etapa de ahora", () => {
    const stages = incidentJourney("resolved", {
      inWorkshop: true,
      archived: true,
    });
    expect(stages.map((stage) => `${stage.key}:${stage.state}`)).toEqual([
      "reported:done",
      "assigned:done",
      "workshop:done",
      "closed:done",
      "archived:current",
    ]);
    expect(stages[4].label).toBe("Archivada");

    // Un caso cerrado sin resolución conserva su etiqueta bajo el archivo: lo
    // que pasó no se maquilla por haberlo guardado.
    const sinResolver = incidentJourney("unresolved", {
      inWorkshop: true,
      archived: true,
    });
    expect(sinResolver[3]).toMatchObject({
      label: "Sin resolución",
      state: "done",
    });
  });
});

describe("los motivos de los pasos que no se pueden dar", () => {
  test("recién notificada: los motivos se reparten por la etapa del paso", () => {
    expect(
      blockedJourneySteps("reported").map(
        (step) => `${step.stage}:${step.action}`,
      ),
    ).toEqual([
      "assigned:verifyWorkshop",
      "workshop:reassignWorkshop",
      "workshop:closeResolved",
    ]);
  });

  test("en taller: lo que ya se puede dar no aparece como bloqueado", () => {
    const steps = blockedJourneySteps("repairing");
    const acciones = steps.map((step) => step.action);
    expect(acciones).not.toContain("closeResolved");
    expect(acciones).not.toContain("reassignWorkshop");
    // Lo que sí queda bloqueado es volver a asignarla desde cero: en taller el
    // técnico se cambia desde la orden, no repartiendo el caso otra vez.
    expect(acciones).toEqual(["selfAssign", "assign"]);
    expect(steps.map((step) => step.stage)).toEqual(["reported", "reported"]);
  });

  test("el motivo es el que da la máquina, sin reescribirlo aquí", () => {
    for (const status of [
      "reported",
      "assigned",
      "workshop",
      "waitingParts",
      "repairing",
      "resolved",
      "unresolved",
    ] satisfies IncidentStatus[]) {
      for (const step of blockedJourneySteps(status)) {
        expect(step.reason).toBe(incidentStepBlocker(status, step.action));
        expect(step.label).toBe(INCIDENT_STEP_LABELS[step.action]);
      }
    }
  });

  test("el orden es el del recorrido, no el de la ficha", () => {
    const etapas = blockedJourneySteps("reported").map((step) => step.stage);
    expect([...etapas].sort()).toEqual(etapas);
  });

  test("un caso cerrado lo explica todo con el motivo del cierre", () => {
    const steps = blockedJourneySteps("resolved");
    expect(steps.length).toBeGreaterThan(0);
    for (const step of steps) {
      expect(step.reason).toContain("ya está cerrada");
    }
  });

  test("se pueden pedir solo los pasos que enseña la ficha", () => {
    expect(blockedJourneySteps("reported", ["verifyWorkshop"])).toHaveLength(1);
    expect(blockedJourneySteps("reported", [])).toEqual([]);
  });
});

describe("el siguiente paso del recorrido", () => {
  test("sin coger: quien coordina la asigna y el técnico se la queda", () => {
    expect(
      nextIncidentAction("reported", {
        canWork: true,
        canAssign: true,
        inWorkshop: false,
      }),
    ).toBe("assign");
    expect(
      nextIncidentAction("reported", {
        canWork: true,
        canAssign: false,
        inWorkshop: false,
      }),
    ).toBe("selfAssign");
  });

  test("asignada en el sitio: toca verificarla", () => {
    expect(
      nextIncidentAction("assigned", {
        canWork: true,
        canAssign: false,
        inWorkshop: false,
      }),
    ).toBe("verifyWorkshop");
  });

  test("en taller: toca cerrar el trabajo", () => {
    expect(
      nextIncidentAction("repairing", {
        canWork: true,
        canAssign: false,
        inWorkshop: true,
      }),
    ).toBe("closeResolved");
  });

  test("sin permiso sobre el caso no hay siguiente paso", () => {
    expect(
      nextIncidentAction("assigned", {
        canWork: false,
        canAssign: false,
        inWorkshop: false,
      }),
    ).toBeNull();
  });

  test("cerrada: no hay nada que dar", () => {
    expect(
      nextIncidentAction("resolved", {
        canWork: true,
        canAssign: true,
        inWorkshop: true,
      }),
    ).toBeNull();
  });
});
