import { describe, expect, test } from "vitest";
import type { RequestStatus } from "../src/convex/schema";
import {
  REQUEST_STEP_LABELS,
  blockedRequestSteps,
  canBuyForRequest,
  canEditRequest,
  canRequestStep,
  isRequestInMotion,
  nextRequestStatus,
  requestStepBlocker,
  resumedStatus,
  type RequestAction,
} from "../src/lib/requestFlow";

/**
 * La tabla esperada, escrita con el tipo del esquema: si se añade un estado a la
 * base sin decidir por dónde pasa, esto no compila y hay que decidirlo. Lo mismo
 * con las acciones, en `DESTINOS`.
 */
const DESDE: Record<RequestStatus, readonly RequestAction[]> = {
  pending: [
    "approve",
    "reject",
    "hold",
    "cancel",
    "requestQuote",
    "receiveMaterial",
  ],
  approved: ["hold", "issue"],
  rejected: [],
  issued: ["returnMaterial"],
  onHold: ["resume", "cancel", "requestQuote", "receiveMaterial"],
  returned: [],
  cancelled: [],
  pendingSupplierQuote: ["hold", "cancel", "receiveMaterial"],
  materialReceived: ["approve"],
};

/** Y a dónde lleva cada paso. `resume` no está: no vuelve a un estado fijo. */
const DESTINOS: Record<Exclude<RequestAction, "resume">, RequestStatus> = {
  approve: "approved",
  reject: "rejected",
  hold: "onHold",
  issue: "issued",
  returnMaterial: "returned",
  cancel: "cancelled",
  requestQuote: "pendingSupplierQuote",
  receiveMaterial: "materialReceived",
};

const ACCIONES = Object.keys(DESDE).flatMap(
  (status) => DESDE[status as RequestStatus],
);
const TODAS: RequestAction[] = [...new Set([...ACCIONES, "resume"])];

describe("la máquina de la petición — qué se puede hacer desde cada estado", () => {
  test("desde cada estado se puede dar exactamente lo que está decidido", () => {
    for (const [status, actions] of Object.entries(DESDE) as [
      RequestStatus,
      readonly RequestAction[],
    ][]) {
      for (const action of TODAS) {
        expect(
          canRequestStep(status, action),
          `${action} desde ${status}`,
        ).toBe(actions.includes(action));
      }
    }
  });

  test("cada paso lleva a donde dice, y sale de algún sitio", () => {
    for (const [action, to] of Object.entries(DESTINOS) as [
      Exclude<RequestAction, "resume">,
      RequestStatus,
    ][]) {
      const from = (Object.keys(DESDE) as RequestStatus[]).find((status) =>
        DESDE[status].includes(action),
      );
      // Un paso que no sale de ningún estado es un paso muerto: nadie puede
      // darlo nunca.
      expect(from, `«${action}» no sale de ningún estado`).toBeDefined();
      if (from === undefined) continue;
      expect(nextRequestStatus(from, action, undefined), action).toBe(to);
    }
  });
});

describe("suspender y reanudar — un paréntesis, no un paso atrás", () => {
  test("se reanuda al estado del que se salió", () => {
    // Lo que evita el fallo: una petición aprobada —con el material ya descontado
    // del almacén— volvía a «pendiente» y se podía aprobar otra vez.
    expect(nextRequestStatus("onHold", "resume", "approved")).toBe("approved");
    expect(nextRequestStatus("onHold", "resume", "pendingSupplierQuote")).toBe(
      "pendingSupplierQuote",
    );
    expect(nextRequestStatus("onHold", "resume", "pending")).toBe("pending");
  });

  test("una petición suspendida antes de que se apuntara de dónde salía vuelve a pendiente", () => {
    // Lo que hacía el taller entonces: no hay nada que recordar.
    expect(resumedStatus(undefined)).toBe("pending");
    expect(nextRequestStatus("onHold", "resume", undefined)).toBe("pending");
  });

  test("solo se reanuda lo que está en espera", () => {
    for (const status of [
      "pending",
      "approved",
      "issued",
      "rejected",
      "cancelled",
      "returned",
      "pendingSupplierQuote",
      "materialReceived",
    ] as RequestStatus[]) {
      expect(canRequestStep(status, "resume"), status).toBe(false);
      expect(
        nextRequestStatus(status, "resume", "approved"),
        status,
      ).toBeNull();
    }
  });

  test("lo que se puede suspender es lo que enseña el botón: pendiente, aprobada o esperando presupuesto", () => {
    for (const status of [
      "pending",
      "approved",
      "pendingSupplierQuote",
    ] as RequestStatus[]) {
      expect(canRequestStep(status, "hold"), status).toBe(true);
    }
    // Ni lo ya entregado, ni lo devuelto, ni lo ya rechazado o cancelado: una
    // petición entregada se devuelve antes de tocarla.
    for (const status of [
      "issued",
      "returned",
      "rejected",
      "cancelled",
      "onHold",
      "materialReceived",
    ] as RequestStatus[]) {
      expect(canRequestStep(status, "hold"), status).toBe(false);
    }
  });
});

describe("cancelar y aprobar — lo que ya tiene material comprometido no se cancela", () => {
  test("se cancela lo pendiente, lo suspendido y lo que espera presupuesto", () => {
    for (const status of [
      "pending",
      "onHold",
      "pendingSupplierQuote",
    ] as RequestStatus[]) {
      expect(canRequestStep(status, "cancel"), status).toBe(true);
    }
  });

  test("no se cancela lo aprobado, lo entregado ni lo devuelto", () => {
    for (const status of [
      "approved",
      "issued",
      "returned",
      "cancelled",
      "rejected",
      "materialReceived",
    ] as RequestStatus[]) {
      expect(canRequestStep(status, "cancel"), status).toBe(false);
    }
  });

  test("se aprueba desde pendiente o desde lo que acaba de entrar en el almacén", () => {
    expect(canRequestStep("pending", "approve")).toBe(true);
    expect(canRequestStep("materialReceived", "approve")).toBe(true);
    expect(canRequestStep("approved", "approve")).toBe(false);
    expect(canRequestStep("onHold", "approve")).toBe(false);
  });

  test("lo comprado pasa a material recibido desde lo que aún esperaba, y no dos veces", () => {
    for (const status of [
      "pending",
      "onHold",
      "pendingSupplierQuote",
    ] as RequestStatus[]) {
      expect(canRequestStep(status, "receiveMaterial"), status).toBe(true);
    }
    expect(canRequestStep("materialReceived", "receiveMaterial")).toBe(false);
    expect(canRequestStep("approved", "receiveMaterial")).toBe(false);
  });
});

describe("comprar material para la petición", () => {
  test("se compra para lo que aún espera decisión, y para nada más", () => {
    // Lo que espera: pendiente, suspendida —suspender es un paréntesis— y
    // esperando presupuesto. Lo ya decidido tiene su material o su motivo.
    for (const status of [
      "pending",
      "onHold",
      "pendingSupplierQuote",
    ] as const) {
      expect(canBuyForRequest(status), status).toBe(true);
    }
    for (const status of [
      "approved",
      "issued",
      "rejected",
      "returned",
      "cancelled",
      "materialReceived",
    ] as const) {
      expect(canBuyForRequest(status), status).toBe(false);
    }
    // Un estado que no es del taller tampoco se compra.
    expect(canBuyForRequest("reported")).toBe(false);
  });
});

describe("edición y archivo", () => {
  test("solo se edita lo que espera decisión", () => {
    expect(canEditRequest("pending")).toBe(true);
    for (const status of [
      "approved",
      "rejected",
      "issued",
      "onHold",
      "returned",
      "cancelled",
      "pendingSupplierQuote",
      "materialReceived",
    ]) {
      expect(canEditRequest(status), status).toBe(false);
    }
  });

  test("lo que aún se mueve no va al archivo", () => {
    expect(isRequestInMotion("pending")).toBe(true);
    expect(isRequestInMotion("onHold")).toBe(true);
    for (const status of [
      "approved",
      "rejected",
      "issued",
      "returned",
      "cancelled",
      "pendingSupplierQuote",
      "materialReceived",
    ]) {
      expect(isRequestInMotion(status), status).toBe(false);
    }
  });

  test("un estado que no es del taller no se está moviendo", () => {
    for (const text of ["", "pending ", "PENDING", "withdrawn"]) {
      expect(isRequestInMotion(text), `«${text}»`).toBe(false);
    }
  });
});

describe("por qué no se puede dar un paso — lo que explica la ficha", () => {
  const ESTADOS: RequestStatus[] = [
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
  const PASOS = Object.keys(REQUEST_STEP_LABELS) as RequestAction[];

  test("hay motivo exactamente cuando el paso no es legal", () => {
    for (const status of ESTADOS) {
      for (const action of PASOS) {
        const reason = requestStepBlocker(status, action);
        expect(reason === null, `${action} desde ${status}`).toBe(
          canRequestStep(status, action),
        );
        // Y cuando lo hay, dice algo: un hueco en la ficha no explicaría nada.
        if (reason !== null) expect(reason.trim(), action).not.toBe("");
      }
    }
  });

  test("lo que tiene arreglo se cuenta con lo que hay que hacer antes", () => {
    // Los dos casos que la ficha necesita decir: devolver el material y no
    // cancelar lo que ya está comprometido.
    expect(requestStepBlocker("issued", "cancel")).toContain(
      "primero devuélvela",
    );
    expect(requestStepBlocker("approved", "cancel")).toContain(
      "material comprometido",
    );
    expect(requestStepBlocker("onHold", "approve")).toContain("reanúdala");
    expect(requestStepBlocker("issued", "hold")).toContain(
      "se devuelve antes de suspenderla",
    );
  });

  test("lo ya resuelto se dice una vez, no paso a paso", () => {
    // Rechazada, cancelada o devuelta comparten motivo: cualquier paso de la
    // ficha se explica con la misma frase, así que va todo junto.
    for (const status of [
      "rejected",
      "cancelled",
      "returned",
    ] as RequestStatus[]) {
      const groups = blockedRequestSteps(status);
      expect(groups, status).toHaveLength(1);
      expect(groups[0].reason, status).toContain("ya está resuelta");
      expect(groups[0].actions).toContain("cancel");
      expect(groups[0].actions).toContain("approve");
    }
  });

  test("lo que sí se puede dar no aparece en la explicación", () => {
    // Pendiente: aprobar, rechazar, suspender, cancelar y pedir presupuesto se
    // pueden; lo que no se puede, se explica, y solo eso.
    const bloqueados = blockedRequestSteps("pending").flatMap(
      (group) => group.actions,
    );
    expect(bloqueados).not.toContain("approve");
    expect(bloqueados).not.toContain("reject");
    expect(bloqueados).not.toContain("cancel");
    for (const action of bloqueados) {
      expect(canRequestStep("pending", action), action).toBe(false);
    }
  });
});
