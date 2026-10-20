import { describe, expect, test } from "vitest";
import {
  REQUEST_STEP_LABELS,
  requestStepBlocker,
  type RequestAction,
  type RequestStatus,
} from "@/lib/requestFlow";
import {
  blockedJourneySteps,
  nextRequestAction,
  requestJourney,
} from "@/lib/requestJourney";

/** Las etapas resumidas como «clave:estado», que es lo que se quiere comprobar. */
function resumen(status: RequestStatus, heldFrom?: RequestStatus): string[] {
  return requestJourney(status, { heldFrom }).map(
    (stage) => `${stage.key}:${stage.state}`,
  );
}

const TODOS_LOS_ESTADOS: RequestStatus[] = [
  "pending",
  "approved",
  "rejected",
  "issued",
  "onHold",
  "returned",
  "cancelled",
  "pendingSupplierQuote",
  "materialReceived",
];

describe("el recorrido de una petición", () => {
  test("pendiente: espera decisión y las demás etapas quedan por delante", () => {
    expect(resumen("pending")).toEqual([
      "pending:current",
      "approved:pending",
      "issued:pending",
    ]);
  });

  test("lo que espera una decisión cuenta como pendiente, con su matiz", () => {
    // El matiz —presupuesto pedido, material ya recibido— lo cuenta la línea de
    // «Ahora» con el nombre del estado; la etapa es la misma.
    expect(resumen("pendingSupplierQuote")).toEqual(resumen("pending"));
    expect(resumen("materialReceived")).toEqual(resumen("pending"));
  });

  test("aprobada: la decisión está hecha y falta entregar", () => {
    expect(resumen("approved")).toEqual([
      "pending:done",
      "approved:current",
      "issued:pending",
    ]);
  });

  test("en espera no es una etapa: se lee de donde salió", () => {
    expect(resumen("onHold")).toEqual([
      "pending:current",
      "approved:pending",
      "issued:pending",
    ]);
    // Suspendida después de aprobarse: sigue estando en «aprobada».
    expect(resumen("onHold", "approved")).toEqual([
      "pending:done",
      "approved:current",
      "issued:pending",
    ]);
  });

  test("entregada: el material está en manos del técnico", () => {
    expect(resumen("issued")).toEqual([
      "pending:done",
      "approved:done",
      "issued:current",
    ]);
  });

  test("devuelta: se entregó y el cierre cuenta lo que pasó", () => {
    const stages = requestJourney("returned");
    expect(stages.map((stage) => stage.state)).toEqual([
      "done",
      "done",
      "done",
      "current",
    ]);
    expect(stages[3]).toMatchObject({ key: "closed", label: "Devuelta" });
  });

  test("rechazada y cancelada no fingen haber pasado por lo que no pasó", () => {
    const rechazada = resumen("rejected");
    expect(rechazada).toEqual([
      "pending:done",
      "approved:skipped",
      "issued:skipped",
      "closed:current",
    ]);
    expect(resumen("cancelled")).toEqual(rechazada);
    expect(requestJourney("rejected")[3].label).toBe("Rechazada");
    expect(requestJourney("cancelled")[3].label).toBe("Cancelada");
  });

  test("cancelada después de aprobarse conserva la aprobación", () => {
    expect(resumen("cancelled", "approved")).toEqual([
      "pending:done",
      "approved:done",
      "issued:skipped",
      "closed:current",
    ]);
  });

  test("toda petición tiene una etapa de ahora y una sola", () => {
    for (const status of TODOS_LOS_ESTADOS) {
      for (const archived of [false, true]) {
        const stages = requestJourney(status, { archived });
        expect(
          stages.filter((stage) => stage.state === "current"),
          `${status} · archived=${archived}`,
        ).toHaveLength(1);
      }
    }
  });

  test("archivada: el archivo es un tramo más, no un aviso de texto", () => {
    const stages = requestJourney("issued", { archived: true });
    expect(stages.map((stage) => `${stage.key}:${stage.state}`)).toEqual([
      "pending:done",
      "approved:done",
      "issued:done",
      "archived:current",
    ]);
    expect(stages[3].label).toBe("Archivada");
  });

  test("archivada tras un cierre: el cierre queda hecho y el archivo toma el relevo", () => {
    expect(
      requestJourney("rejected", { archived: true }).map(
        (stage) => `${stage.key}:${stage.state}`,
      ),
    ).toEqual([
      "pending:done",
      "approved:skipped",
      "issued:skipped",
      "closed:done",
      "archived:current",
    ]);
  });

  test("lo que sigue en la cola no lleva el tramo del archivo", () => {
    for (const status of ["pending", "approved", "issued"] as const) {
      expect(requestJourney(status).map((stage) => stage.key)).not.toContain(
        "archived",
      );
    }
  });
});

describe("el siguiente paso de la petición", () => {
  test("lo que espera decisión se aprueba", () => {
    expect(nextRequestAction("pending", { canManage: true })).toBe("approve");
    expect(nextRequestAction("materialReceived", { canManage: true })).toBe(
      "approve",
    );
  });

  test("con el presupuesto pedido al proveedor no se decide todavía", () => {
    // La máquina solo aprueba lo pendiente o lo que acaba de llegar: mientras el
    // proveedor no contesta, el paso es esperar, no aprobar.
    expect(
      nextRequestAction("pendingSupplierQuote", { canManage: true }),
    ).toBeNull();
  });

  test("aprobada: toca entregar; en espera: reanudar", () => {
    expect(nextRequestAction("approved", { canManage: true })).toBe("issue");
    expect(nextRequestAction("onHold", { canManage: true })).toBe("resume");
  });

  test("no hay paso después de entregarla ni en un cierre", () => {
    expect(nextRequestAction("issued", { canManage: true })).toBeNull();
    expect(nextRequestAction("rejected", { canManage: true })).toBeNull();
    expect(nextRequestAction("cancelled", { canManage: true })).toBeNull();
    expect(nextRequestAction("returned", { canManage: true })).toBeNull();
  });

  test("quien no la tramita no tiene siguiente paso", () => {
    for (const status of TODOS_LOS_ESTADOS) {
      expect(nextRequestAction(status, { canManage: false })).toBeNull();
    }
  });

  test("el paso que toca es uno que la máquina deja dar", () => {
    for (const status of TODOS_LOS_ESTADOS) {
      const action = nextRequestAction(status, { canManage: true });
      if (action === null) continue;
      // Si la máquina no lo dejara, `nextRequestAction` no podría ofrecerlo.
      expect(requestStepBlocker(status, action)).toBeNull();
    }
  });
});

describe("los motivos de los pasos que no se pueden dar", () => {
  test("pendiente: cada motivo va bajo la etapa de su paso", () => {
    expect(
      blockedJourneySteps("pending").map(
        (step) => `${step.stage}:${step.action}`,
      ),
    ).toEqual(["pending:resume", "approved:issue", "issued:returnMaterial"]);
  });

  test("un paso que sí se puede dar no aparece como bloqueado", () => {
    const acciones = blockedJourneySteps("approved").map((step) => step.action);
    expect(acciones).not.toContain("issue");
    expect(acciones).not.toContain("hold");
    // De la etapa ya pasada solo queda lo que cuenta algo que hacer —que el
    // material está comprometido— y lo que aún espera su etapa.
    expect(acciones).toEqual(["cancel", "returnMaterial"]);
  });

  test("entregada: no se enumeran los pasos que ya no tocan", () => {
    // Aprobar, rechazar o reanudar una petición entregada no dice nada; lo que sí
    // ayuda es saber que para suspenderla o cancelarla hay que devolverla.
    expect(blockedJourneySteps("issued").map((step) => step.action)).toEqual([
      "hold",
      "cancel",
    ]);
  });

  test("el motivo es el que da la máquina, sin reescribirlo aquí", () => {
    for (const status of TODOS_LOS_ESTADOS) {
      for (const step of blockedJourneySteps(status)) {
        expect(step.reason).toBe(requestStepBlocker(status, step.action));
        expect(step.label).toBe(REQUEST_STEP_LABELS[step.action]);
      }
    }
  });

  test("el orden es el del recorrido, no el de la ficha", () => {
    // Pendiente primero —cancelar es de la etapa de la decisión— y luego lo que
    // aún espera su etapa, aunque en la ficha «devolver» vaya al final.
    expect(blockedJourneySteps("approved").map((step) => step.stage)).toEqual([
      "pending",
      "issued",
    ]);
  });

  test("se pueden pedir solo los pasos que enseña la ficha", () => {
    expect(
      blockedJourneySteps("pending", {
        steps: ["issue"] satisfies RequestAction[],
      }),
    ).toHaveLength(1);
    expect(blockedJourneySteps("pending", { steps: [] })).toEqual([]);
  });
});
