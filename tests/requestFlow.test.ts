import { describe, expect, test } from "vitest";
import type { RequestStatus } from "../src/convex/schema";
import {
  REQUEST_STEP_LABELS,
  blockedRequestSteps,
  canBuyForRequest,
  canEditRequest,
  canRequestStep,
  DELIVERY_REASONS,
  isDeliveryReason,
  isRequestInMotion,
  lineDelivered,
  lineRemaining,
  nextRequestStatus,
  requestDelivery,
  requestMaterialState,
  deliveryNote,
  requestStepBlocker,
  resumedStatus,
  type RequestAction,
  type RequestMaterialState,
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

/**
 * La misma tabla, escrita con el tipo del esquema: si se añade un estado a la
 * petición sin decidir qué se dice de su material, esto no compila.
 */
const MATERIAL_DESDE: Record<RequestStatus, RequestMaterialState> = {
  pending: "pending",
  approved: "pending",
  rejected: "dropped",
  issued: "delivered",
  onHold: "pending",
  returned: "returned",
  cancelled: "dropped",
  pendingSupplierQuote: "pending",
  materialReceived: "pending",
};

describe("qué se puede decir del material — la ficha de la incidencia", () => {
  test("cada estado cuenta lo mismo desde cualquier pantalla", () => {
    for (const [status, expected] of Object.entries(MATERIAL_DESDE) as [
      RequestStatus,
      RequestMaterialState,
    ][]) {
      expect(requestMaterialState(status), status).toBe(expected);
    }
  });

  test("solo lo entregado cuenta como entregado, y lo apartado no", () => {
    // Aprobada no es «ya está»: el material sigue en el almacén. Es el error que
    // la ficha de la incidencia no puede cometer, porque de ahí sale el paso
    // siguiente del técnico.
    expect(requestMaterialState("approved")).toBe("pending");
    expect(requestMaterialState("issued")).toBe("delivered");
    // Lo devuelto salió y volvió: no se puede montar, así que no cuenta como
    // entregado aunque pasara por el taller.
    expect(requestMaterialState("returned")).toBe("returned");
  });
});

describe("la entrega de una en una — lo que ha salido y lo que queda", () => {
  const linea = (quantity: number, deliveredQuantity?: number) => ({
    quantity,
    ...(deliveredQuantity === undefined ? {} : { deliveredQuantity }),
  });

  test("cada línea cuenta lo suyo, y nunca más de lo pedido", () => {
    expect(lineDelivered(linea(5, 2), "approved")).toBe(2);
    expect(lineRemaining(linea(5, 2), "approved")).toBe(3);
    // Sin nada apuntado no se ha entregado nada…
    expect(lineDelivered(linea(5), "approved")).toBe(0);
    // …salvo en las peticiones entregadas antes de que se apuntara por línea:
    // su estado dice que salió todo, y así se siguen leyendo.
    expect(lineDelivered(linea(5), "issued")).toBe(5);
    expect(lineDelivered(linea(5), "returned")).toBe(5);
    // Una fila corregida a mano no puede inventar material ni devolverlo.
    expect(lineDelivered(linea(5, 9), "approved")).toBe(5);
    expect(lineDelivered(linea(5, -1), "approved")).toBe(0);
    expect(lineRemaining(linea(5, 9), "approved")).toBe(0);
  });

  test("la petición se cuenta por unidades y por líneas", () => {
    const lines = [linea(5, 2), linea(1), linea(4, 4)];
    expect(requestDelivery(lines, "approved")).toEqual({
      totalLines: 3,
      totalUnits: 10,
      deliveredUnits: 6,
      pendingUnits: 4,
      deliveredLines: 1,
      anyDelivered: true,
      complete: false,
    });

    // Entregado todo, la petición está completa…
    const todo = lines.map((line) => ({
      ...line,
      deliveredQuantity: line.quantity,
    }));
    expect(requestDelivery(todo, "approved")).toMatchObject({
      deliveredUnits: 10,
      pendingUnits: 0,
      deliveredLines: 3,
      complete: true,
    });

    // …y una petición sin líneas no lo está: no hay nada que entregar.
    expect(requestDelivery([], "approved")).toMatchObject({
      totalUnits: 0,
      anyDelivered: false,
      complete: false,
    });
  });

  test("la constancia de una tanda cuenta lo que salió en ella, no lo que lleva la petición", () => {
    // Dos piezas en una tanda y una en otra: el rastro de cada entrega tiene que
    // decir qué salió esa vez —las líneas solo guardan el acumulado—.
    expect(
      deliveryNote([
        {
          code: "ALI-12024",
          name: "Fuente de alimentación 12 V",
          quantity: 2,
        },
        { code: "FIL-00042", name: "Filtro de aire", quantity: 1 },
      ]),
    ).toBe(
      "2 × ALI-12024 Fuente de alimentación 12 V · 1 × FIL-00042 Filtro de aire",
    );
    // Sin líneas no hay nada que apuntar (una tanda en cero no llega al servidor).
    expect(deliveryNote([])).toBe("");
  });

  test("las razones de entrega se distinguen del resto de decisiones", () => {
    expect(DELIVERY_REASONS).toHaveLength(2);
    expect(isDeliveryReason("materialDelivered")).toBe(true);
    expect(isDeliveryReason("materialPartiallyDelivered")).toBe(true);
    // Lo que no es una entrega no se cuela en el rastro de entregas.
    for (const otra of [
      "materialReturned",
      "requestCancelled",
      "other",
      undefined,
      "",
    ]) {
      expect(isDeliveryReason(otra), String(otra)).toBe(false);
    }
  });

  test("una entrega a medias se ve como tal, no como entregada ni como nada", () => {
    const aMedias = requestDelivery([linea(5, 2)], "approved");
    // El estado de la petición sigue siendo aprobada, pero el material ya no está
    // entero en el almacén: quien lee la ficha de la incidencia tiene que verlo.
    expect(requestMaterialState("approved", aMedias)).toBe("partial");
    // Y sin nada entregado, sigue siendo «sin entregar», que es lo que permite
    // decirle al técnico que espere.
    expect(
      requestMaterialState("approved", requestDelivery([linea(5)], "approved")),
    ).toBe("pending");
    // Lo ya entregado no cambia lo que se dice de un cierre.
    expect(requestMaterialState("issued", aMedias)).toBe("delivered");
    expect(requestMaterialState("cancelled", aMedias)).toBe("dropped");
    expect(requestMaterialState("returned", aMedias)).toBe("returned");
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
