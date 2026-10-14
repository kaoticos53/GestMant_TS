import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import { api } from "../src/convex/_generated/api";
import type { Id } from "../src/convex/_generated/dataModel";
import schema from "../src/convex/schema";
import { INCIDENT_STEPS, type IncidentAction } from "../src/lib/incidentFlow";
import { CAPABILITIES, type Capability } from "../src/lib/permissions";
import {
  PURCHASE_ORDER_STEPS,
  nextPurchaseRequestStatus,
  purchaseOrderStatusAfterReceiving,
  type PurchaseOrderAction,
  type PurchaseRequestAction,
} from "../src/lib/purchaseFlow";
import { nextRequestStatus, type RequestAction } from "../src/lib/requestFlow";
import { ROLE_META, STAFF_ROLES, type SystemRole } from "../src/lib/roles";
import type { IncidentStatus, RequestStatus } from "../src/lib/workshop";
import type {
  PurchaseOrderStatus,
  PurchaseRequestStatus,
} from "../src/lib/purchasing";
import { documentedRows } from "./machineDoc";

/**
 * Los pasos del diagrama —las tablas de `MAQUINAS.md`— contra el backend, rol
 * por rol: cada paso se intenta **de verdad**, con la sesión de cada rol y el
 * caso montado en el estado del que sale, y se comprueba que pasa quien el
 * documento dice que pasa y se queda fuera quien dice que se queda fuera.
 *
 * Lo que esto añade a `maquinas.test.ts`: allí se comprueba que el documento
 * dibuje las transiciones del código; aquí, que la columna «quién» no sea una
 * promesa. Un paso cuyo backend pidiera otra capacidad —o ninguna— se queda en
 * verde en el documento y en rojo aquí.
 *
 * De dónde sale lo que se espera:
 *
 * - Las **capacidades** que nombra cada fila, de la propia columna «quién» del
 *   documento (por eso el lector es el mismo que el de `maquinas.test.ts`).
 * - Lo que cada rol **puede** de verdad, preguntándoselo al backend con su
 *   sesión (`permissions.myPermissions`): no es una copia de `DEFAULT_GRANTS`,
 *   es el mismo resolutor que consultan las mutaciones antes de tocar nada.
 * - El **destino** del paso, de la tabla de su máquina: dar el paso tiene que
 *   dejar el caso donde dice el diagrama, no en otro sitio.
 *
 * Y lo que no se comprueba aquí: lo que pasa *además* del cambio de estado
 * (stock descontado, correo a quien notificó, ficha de mantenimiento). Eso es de
 * cada mutación, no de la puerta.
 */

/** Todos los módulos de funciones de la app (convex-test los levanta in-process). */
const modules = import.meta.glob("../src/convex/**/!(*.*.*)*.*s");

type Test = ReturnType<typeof convexTest>;
type Authed = ReturnType<Test["withIdentity"]>;

/** El repuesto con el que se montan todos los casos. */
const PIEZA = {
  code: "ALI-24015",
  name: "Fuente de alimentación",
  unit: "ud",
};

/**
 * Las capacidades que se reparten aquí, una por rol a medida: las que el
 * administrador puede conceder (las bloqueadas son suyas y no se conceden).
 *
 * Cuatro de ellas —`viewIncidents`, `manageIncidents`, `decideRequests` y
 * `managePurchasing`— son las únicas que el documento nombra en su columna
 * «quién». Las demás están a propósito: son la prueba de que **no** abren nada.
 * Sin ellas, aflojar una puerta del backend —dejar comprar a quien solo puede
 * ver las compras, por ejemplo— se quedaría en verde, porque ningún rol de los
 * del taller tiene esa capacidad suelta y ninguna de las de arriba la distingue.
 */
const CAPACIDADES_CEDIBLES: Capability[] = CAPABILITIES.filter(
  (item) => item.locked !== true,
).map((item) => item.id);

/** Una puerta que no es una capacidad: el caso puesto a nombre de quien actúa. */
type Puerta = "asignado" | "taller";

/** Una persona con la que se intenta dar el paso. */
interface Persona {
  /** Cómo se la nombra en los mensajes de la prueba. */
  nombre: string;
  /** Su cuenta: es a quien se le pone el caso cuando tiene la puerta del dueño. */
  id: Id<"users">;
  /** Su sesión: se entra como ella, no se simula el permiso. */
  sesion: Authed;
  /** Lo que el backend dice que puede. */
  grants: Record<Capability, boolean>;
  /** ¿Es la sesión anónima? (no puede llegar a tener el caso). */
  invitado: boolean;
}

/** El taller de la prueba, con su gente y su repuesto. */
interface Mundo {
  t: Test;
  personas: Persona[];
  /** El repuesto con existencias: para apartar, entregar y comprar. */
  pieza: Id<"spareParts">;
  /** Con quién se queda el caso cuando quien actúa no lo tiene. */
  otro: Id<"users">;
  /** El técnico de taller de otro turno. */
  otroDeTaller: Id<"users">;
}

/** Monta el taller: los roles del sistema, los cuatro a medida y un repuesto. */
async function taller(): Promise<Mundo> {
  const t = convexTest(schema, modules);
  const como = (id: Id<"users">): Authed =>
    t.withIdentity({ subject: `${id}|sesion` });

  const gente: { nombre: string; id: Id<"users">; invitado: boolean }[] = [];
  for (const rol of [...STAFF_ROLES, "guest"] as SystemRole[]) {
    const invitado = rol === "guest";
    const id = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: ROLE_META[rol].label,
        role: rol,
        active: true,
        ...(invitado ? { isAnonymous: true } : {}),
      }),
    );
    gente.push({ nombre: ROLE_META[rol].label, id, invitado });
  }

  // Un rol a medida por capacidad concedible, con esa y ninguna más.
  const ahora = Date.now();
  for (const capacidad of CAPACIDADES_CEDIBLES) {
    const clave = `solo-${capacidad.toLowerCase()}`;
    await t.run((ctx) =>
      ctx.db.insert("roles", {
        key: clave,
        label: `Solo ${capacidad}`,
        description: "Rol de la prueba: una capacidad suelta.",
        kind: "custom",
        grants: { [capacidad]: true },
        createdAt: ahora,
        updatedAt: ahora,
      }),
    );
    const id = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: `Solo ${capacidad}`,
        role: clave,
        active: true,
      }),
    );
    gente.push({ nombre: `solo ${capacidad}`, id, invitado: false });
  }

  const otro = await t.run((ctx) =>
    ctx.db.insert("users", { name: "Otro Técnico", role: "technician" }),
  );
  const otroDeTaller = await t.run((ctx) =>
    ctx.db.insert("users", { name: "Otro de taller", role: "technician" }),
  );
  const pieza = await t.run((ctx) =>
    ctx.db.insert("spareParts", {
      code: PIEZA.code,
      name: PIEZA.name,
      category: "Electrónica",
      unit: PIEZA.unit,
      // Holgura de sobra: la prueba intenta el mismo paso muchas veces y aprobar
      // descuenta stock de verdad.
      stock: 10_000,
      minStock: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
  );

  const personas: Persona[] = [];
  for (const { nombre, id, invitado } of gente) {
    const sesion = como(id);
    const { grants } = await sesion.query(api.permissions.myPermissions, {});
    personas.push({ nombre, id, sesion, grants, invitado });
  }

  return { t, personas, pieza, otro, otroDeTaller };
}

/* ------------------------------------------------------------------ */
/* Montar el caso en el estado del que sale cada paso                  */
/* ------------------------------------------------------------------ */

/** Un caso montado, listo para intentar el paso. */
interface Caso {
  /** Intenta el paso con la sesión de quien lo intenta. */
  dar: () => Promise<unknown>;
  /** En qué estado está el caso ahora mismo. */
  estado: () => Promise<string | undefined>;
}

/** La petición de repuestos, tal y como nace: una línea de una unidad. */
async function peticionBase(
  mundo: Mundo,
  status: RequestStatus,
): Promise<Id<"partRequests">> {
  return await mundo.t.run((ctx) =>
    ctx.db.insert("partRequests", {
      reference: "PET-0001",
      requesterName: "Teo Técnico",
      priority: "normal",
      status,
      lines: [
        {
          sparePartId: mundo.pieza,
          code: PIEZA.code,
          name: PIEZA.name,
          quantity: 1,
        },
      ],
      // De dónde salió la suspensión: al reanudar se vuelve ahí, así que se
      // apunta para saber dónde tiene que acabar la petición.
      ...(status === "onHold" ? { heldFrom: HELD_FROM } : {}),
      createdAt: Date.now(),
    }),
  );
}

/** De dónde salió la suspensión de las peticiones que se suspenden en la prueba. */
const HELD_FROM: RequestStatus = "pending";

/** La petición de compra de esa petición de repuestos. */
async function compraBase(
  mundo: Mundo,
  requestId: Id<"partRequests">,
  status: PurchaseRequestStatus,
): Promise<Id<"purchaseRequests">> {
  const ahora = Date.now();
  return await mundo.t.run((ctx) =>
    ctx.db.insert("purchaseRequests", {
      reference: "PC-0001",
      requestId,
      requestReference: "PET-0001",
      requestDate: ahora,
      requesterName: "Teo Técnico",
      sparePartId: mundo.pieza,
      code: PIEZA.code,
      name: PIEZA.name,
      unit: PIEZA.unit,
      quantity: 1,
      supplier: "Electro Suministros",
      status,
      reason: "noStock",
      requestedAt: ahora,
      requestedBy: "Rita Repuestos",
      createdAt: ahora,
    }),
  );
}

/**
 * La orden que lleva dentro esa petición de compra, con una línea de `cantidad`
 * unidades. Las de una unidad se recepcionan de una vez; la de la máquina de la
 * orden pide dos, para poder dejarla a medias y recepcionar desde `partial`.
 */
async function ordenBase(
  mundo: Mundo,
  compra: Id<"purchaseRequests">,
  requestId: Id<"partRequests">,
  status: PurchaseOrderStatus,
  cantidad = 1,
): Promise<Id<"purchaseOrders">> {
  const ahora = Date.now();
  const recibido = status === "partial" ? cantidad - 1 : 0;
  return await mundo.t.run((ctx) =>
    ctx.db.insert("purchaseOrders", {
      reference: "OC-0001",
      supplier: "Electro Suministros",
      status,
      orderedAt: ahora,
      orderedBy: "Rita Repuestos",
      requestRefs: [{ reference: "PET-0001", requestedAt: ahora }],
      lines: [
        {
          purchaseRequestId: compra,
          requestId,
          requestReference: "PET-0001",
          requestDate: ahora,
          sparePartId: mundo.pieza,
          code: PIEZA.code,
          name: PIEZA.name,
          unit: PIEZA.unit,
          quantity: cantidad,
          receivedQuantity: recibido,
        },
      ],
      createdAt: ahora,
      updatedAt: ahora,
    }),
  );
}

/** El albarán que exige una recepción. */
async function albaranDe(mundo: Mundo) {
  const storageId = await mundo.t.run((ctx) =>
    ctx.storage.store(new Blob(["albarán"], { type: "application/pdf" })),
  );
  return { storageId, name: "albaran-2026-10.pdf", kind: "document" as const };
}

/** La petición de repuestos y el paso que la mueve. */
async function montarPeticion(
  mundo: Mundo,
  persona: Persona,
  from: RequestStatus,
  action: RequestAction,
): Promise<Caso> {
  const requestId = await peticionBase(mundo, from);
  const estado = async () =>
    (await mundo.t.run((ctx) => ctx.db.get(requestId)))?.status;

  if (action === "receiveMaterial") {
    // Este paso no tiene botón: lo da la recepción de la orden que trae lo
    // comprado, que es lo que el documento cuenta en su columna «quién».
    const compra = await compraBase(mundo, requestId, "ordered");
    const orden = await ordenBase(mundo, compra, requestId, "pending");
    const albaran = await albaranDe(mundo);
    return {
      dar: () =>
        persona.sesion.mutation(api.purchasing.receive, {
          orderId: orden,
          items: [{ purchaseRequestId: compra, quantity: 1 }],
          deliveryNote: albaran,
        }),
      estado,
    };
  }

  const dar: Record<
    Exclude<RequestAction, "receiveMaterial">,
    () => Promise<unknown>
  > = {
    approve: () =>
      persona.sesion.mutation(api.partRequests.approve, { requestId }),
    reject: () =>
      persona.sesion.mutation(api.partRequests.reject, { requestId }),
    hold: () => persona.sesion.mutation(api.partRequests.onHold, { requestId }),
    resume: () =>
      persona.sesion.mutation(api.partRequests.resume, { requestId }),
    issue: () =>
      persona.sesion.mutation(api.partRequests.markIssued, { requestId }),
    returnMaterial: () =>
      persona.sesion.mutation(api.partRequests.returnMaterial, { requestId }),
    cancel: () =>
      persona.sesion.mutation(api.partRequests.cancel, { requestId }),
    requestQuote: () =>
      persona.sesion.mutation(api.partRequests.requestQuote, { requestId }),
  };

  return { dar: dar[action], estado };
}

/** La incidencia y el paso que la mueve, con la puerta del dueño si toca. */
async function montarIncidencia(
  mundo: Mundo,
  persona: Persona,
  from: IncidentStatus,
  dueno: Puerta | null,
  action: IncidentAction,
): Promise<Caso> {
  const ahora = Date.now();
  const incidentId = await mundo.t.run((ctx) =>
    ctx.db.insert("incidents", {
      reference: "INC-0001",
      reporterName: "Laura Peña",
      description: "El monitor pierde la señal cada pocos minutos.",
      reportedAt: ahora,
      status: from,
      history: [],
      // Recién notificada no es de nadie; a partir de ahí el caso tiene técnico,
      // y con la puerta de dueño puesta es quien actúa.
      ...(from === "reported"
        ? {}
        : {
            assigneeId: dueno === "asignado" ? persona.id : mundo.otro,
            assigneeName:
              dueno === "asignado" ? persona.nombre : "Otro Técnico",
          }),
      ...(from === "workshop"
        ? {
            workshopAssigneeId:
              dueno === "taller" ? persona.id : mundo.otroDeTaller,
            workshopAssigneeName:
              dueno === "taller" ? persona.nombre : "Otro de taller",
          }
        : {}),
      createdAt: ahora,
      updatedAt: ahora,
    }),
  );

  const dar: Record<IncidentAction, () => Promise<unknown>> = {
    assign: () =>
      persona.sesion.mutation(api.incidents.assign, {
        incidentId,
        assigneeId: mundo.otro,
      }),
    selfAssign: () =>
      persona.sesion.mutation(api.incidents.selfAssign, { incidentId }),
    verifyOnsite: () =>
      persona.sesion.mutation(api.incidents.verify, {
        incidentId,
        outcome: "onsite",
      }),
    verifyWorkshop: () =>
      persona.sesion.mutation(api.incidents.verify, {
        incidentId,
        outcome: "workshop",
      }),
    verifyUnresolved: () =>
      persona.sesion.mutation(api.incidents.verify, {
        incidentId,
        outcome: "unresolved",
      }),
    reassignWorkshop: () =>
      persona.sesion.mutation(api.incidents.assignWorkshop, {
        incidentId,
        assigneeId: mundo.otroDeTaller,
      }),
    closeResolved: () =>
      persona.sesion.mutation(api.incidents.close, {
        incidentId,
        outcome: "resolved",
      }),
    closeUnresolved: () =>
      persona.sesion.mutation(api.incidents.close, {
        incidentId,
        outcome: "unresolved",
      }),
  };

  return {
    dar: dar[action],
    estado: async () =>
      (await mundo.t.run((ctx) => ctx.db.get(incidentId)))?.status,
  };
}

/** La petición de compra y el paso que la mueve. */
async function montarCompra(
  mundo: Mundo,
  persona: Persona,
  from: PurchaseRequestStatus,
  action: PurchaseRequestAction,
): Promise<Caso> {
  const requestId = await peticionBase(mundo, "pending");
  const compra = await compraBase(mundo, requestId, from);
  const estado = async () =>
    (await mundo.t.run((ctx) => ctx.db.get(compra)))?.status;

  if (action === "order") {
    return {
      dar: () =>
        persona.sesion.mutation(api.purchasing.createOrder, {
          purchaseRequestIds: [compra],
        }),
      estado,
    };
  }
  if (action === "cancel") {
    return {
      dar: () =>
        persona.sesion.mutation(api.purchasing.cancelPurchaseRequest, {
          id: compra,
          note: "Ya no se compra",
        }),
      estado,
    };
  }

  // `unorder` y `receive` no tienen botón en la ficha de la compra: los mueve la
  // orden que la lleva dentro, que es lo que cuenta el documento.
  const orden = await ordenBase(mundo, compra, requestId, "pending");
  if (action === "unorder") {
    return {
      dar: () =>
        persona.sesion.mutation(api.purchasing.cancelOrder, {
          orderId: orden,
          note: "El proveedor ya no sirve",
        }),
      estado,
    };
  }
  const albaran = await albaranDe(mundo);
  return {
    dar: () =>
      persona.sesion.mutation(api.purchasing.receive, {
        orderId: orden,
        items: [{ purchaseRequestId: compra, quantity: 1 }],
        deliveryNote: albaran,
      }),
    estado,
  };
}

/** La orden de compra y el paso que la mueve. */
async function montarOrden(
  mundo: Mundo,
  persona: Persona,
  from: PurchaseOrderStatus,
  action: PurchaseOrderAction,
): Promise<Caso> {
  const requestId = await peticionBase(mundo, "pending");
  const compra = await compraBase(mundo, requestId, "ordered");
  // Dos unidades, para que la orden pueda estar a medias. `falta` es lo que
  // queda por llegar, que es lo que hay que recepcionar para dejarla entera.
  const orden = await ordenBase(mundo, compra, requestId, from, 2);
  const estado = async () =>
    (await mundo.t.run((ctx) => ctx.db.get(orden)))?.status;

  if (action === "cancel") {
    return {
      dar: () =>
        persona.sesion.mutation(api.purchasing.cancelOrder, {
          orderId: orden,
          note: "Se anula: ya no hace falta",
        }),
      estado,
    };
  }

  // Lo que falta por llegar, para que la recepción deje la orden completada.
  const falta = from === "partial" ? 1 : 2;

  const albaran = await albaranDe(mundo);
  return {
    dar: () =>
      persona.sesion.mutation(api.purchasing.receive, {
        orderId: orden,
        items: [{ purchaseRequestId: compra, quantity: falta }],
        deliveryNote: albaran,
      }),
    estado,
  };
}

/* ------------------------------------------------------------------ */
/* Qué espera el documento de cada paso                                */
/* ------------------------------------------------------------------ */

/**
 * Las puertas de dueño que reconoce cada paso de la incidencia: la del técnico
 * asignado y la del técnico de la orden de taller. Son las que el documento
 * escribe en negrita —«`manageIncidents` **o el técnico asignado**»— y las que
 * mira el backend en su lugar. Los demás pasos no tienen: quien los da lo hace
 * por su capacidad.
 */
const PUERTAS_DE_LA_INCIDENCIA: Partial<Record<IncidentAction, Puerta[]>> = {
  verifyOnsite: ["asignado"],
  verifyWorkshop: ["asignado"],
  verifyUnresolved: ["asignado"],
  reassignWorkshop: ["taller"],
  closeResolved: ["asignado", "taller"],
  closeUnresolved: ["asignado", "taller"],
};

/** Con qué reparto se intenta cada paso: sin dueño, y con cada puerta puesta. */
function repartos(machine: string, action: string): (Puerta | null)[] {
  if (machine !== "incident") return [null];
  return [null, ...(PUERTAS_DE_LA_INCIDENCIA[action as IncidentAction] ?? [])];
}

/** Monta el caso de la máquina que toque. */
async function montar(
  mundo: Mundo,
  persona: Persona,
  machine: string,
  from: string,
  dueno: Puerta | null,
  action: string,
): Promise<Caso> {
  switch (machine) {
    case "incident":
      return await montarIncidencia(
        mundo,
        persona,
        from as IncidentStatus,
        dueno,
        action as IncidentAction,
      );
    case "request":
      return await montarPeticion(
        mundo,
        persona,
        from as RequestStatus,
        action as RequestAction,
      );
    case "purchaseRequest":
      return await montarCompra(
        mundo,
        persona,
        from as PurchaseRequestStatus,
        action as PurchaseRequestAction,
      );
    case "purchaseOrder":
      return await montarOrden(
        mundo,
        persona,
        from as PurchaseOrderStatus,
        action as PurchaseOrderAction,
      );
  }
  throw new Error(`Máquina desconocida: ${machine}`);
}

/**
 * A dónde deja el caso este paso, según la tabla de su máquina. Dar el paso
 * tiene que llegar exactamente ahí: si el backend moviera la incidencia a otro
 * sitio, el documento estaría dibujando algo que no pasa.
 */
function destinoDelDiagrama(
  machine: string,
  action: string,
  from: string,
): string {
  if (machine === "incident") {
    return INCIDENT_STEPS[action as IncidentAction].to;
  }
  if (machine === "request") {
    const destino = nextRequestStatus(
      from as RequestStatus,
      action as RequestAction,
      HELD_FROM,
    );
    if (destino === null) {
      throw new Error(`La máquina no permite ${action} desde ${from}.`);
    }
    return destino;
  }
  if (machine === "purchaseRequest") {
    const destino = nextPurchaseRequestStatus(
      from,
      action as PurchaseRequestAction,
    );
    if (destino === null) {
      throw new Error(`La máquina no permite ${action} desde ${from}.`);
    }
    return destino;
  }
  if (machine === "purchaseOrder") {
    // Recepcionar la orden entera la deja completada; lo que llega a medias es
    // el otro final posible (`allReceived` en su tabla).
    return action === "receive"
      ? purchaseOrderStatusAfterReceiving([
          { quantity: 1, receivedQuantity: 1 },
        ])
      : PURCHASE_ORDER_STEPS[action as PurchaseOrderAction].to;
  }
  throw new Error(`Máquina desconocida: ${machine}`);
}

/**
 * El motivo por el que el backend cierra la puerta: permiso o cuenta. Es lo que
 * distingue un «no puedes» de un «ahora no toca» —«la incidencia debe estar
 * asignada para verificarla», «ya está completada»—, que en esta prueba no
 * debería aparecer nunca: el caso se monta en el estado del que sale el paso.
 */
const FRENO_POR_PERMISO =
  /No tienes permisos para|Debes iniciar sesión con una cuenta registrada|Solo el coordinador|Solo quien ve la cola|Solo el técnico/;

/** El texto del error, venga envuelto en `ConvexError` o no. */
function mensajeDe(error: unknown): string {
  return error instanceof ConvexError ? String(error.data) : String(error);
}

const tablas = documentedRows();

describe("los pasos del diagrama, rol por rol, contra el backend", () => {
  test("el reparto es el de los roles del taller, el invitado y los a medida", async () => {
    const mundo = await taller();
    expect(mundo.personas.map((persona) => persona.nombre)).toEqual([
      ...[...STAFF_ROLES, "guest"].map((rol) => ROLE_META[rol].label),
      ...CAPACIDADES_CEDIBLES.map((capacidad) => `solo ${capacidad}`),
    ]);

    // El invitado no puede nada, y es de donde sale media tabla.
    const invitado = mundo.personas.find((persona) => persona.invitado);
    expect(invitado, "sin sesión de invitado en el reparto").toBeDefined();
    expect(Object.values(invitado!.grants).some(Boolean)).toBe(false);

    // Y cada rol a medida tiene la suya y solo la suya: si esto dejara de ser
    // así, la prueba estaría midiendo el rol equivocado.
    for (const capacidad of CAPACIDADES_CEDIBLES) {
      const persona = mundo.personas.find(
        (item) => item.nombre === `solo ${capacidad}`,
      )!;
      expect(persona.grants[capacidad]).toBe(true);
      expect(
        CAPACIDADES_CEDIBLES.filter((otra) => persona.grants[otra]),
      ).toEqual([capacidad]);
    }
  });

  for (const [machine, filas] of Object.entries(tablas)) {
    describe(machine, () => {
      for (const fila of filas) {
        test(`${fila.from} → ${fila.action}: quién pasa y quién se queda fuera`, async () => {
          const mundo = await taller();
          const destino = destinoDelDiagrama(machine, fila.action, fila.from);
          const puertas = repartos(machine, fila.action);

          for (const dueno of puertas) {
            for (const persona of mundo.personas) {
              // El invitado no llega a tener un caso a su nombre: quedárselo se
              // lo frena el backend (y el paso `selfAssign`, más abajo, lo
              // comprueba). Montarle el caso sería probar un estado que no se
              // alcanza desde la aplicación.
              if (dueno !== null && persona.invitado) continue;

              const donde = `${machine} ${fila.from}→${fila.action}${
                dueno === null ? "" : ` con el caso de ${dueno}`
              } · ${persona.nombre}`;
              const conPermiso = fila.caps.some(
                (cap) => persona.grants[cap as Capability],
              );
              // La regla del documento: la capacidad, o —si el paso tiene esa
              // segunda puerta— tener el caso puesto.
              const esperado =
                conPermiso ||
                (dueno !== null &&
                  Object.keys(PUERTAS_DE_LA_INCIDENCIA).includes(fila.action));

              const caso = await montar(
                mundo,
                persona,
                machine,
                fila.from,
                dueno,
                fila.action,
              );
              const antes = await caso.estado();

              if (esperado) {
                await caso.dar();
                expect(await caso.estado(), donde).toBe(destino);
                continue;
              }

              const error = await caso.dar().then(
                () => null,
                (err: unknown) => err,
              );
              expect(error, donde).not.toBeNull();
              expect(mensajeDe(error), donde).toMatch(FRENO_POR_PERMISO);
              // Y el caso se queda donde estaba: un «no puedes» no mueve nada.
              expect(await caso.estado(), donde).toBe(antes);
            }
          }
        });
      }
    });
  }
});
