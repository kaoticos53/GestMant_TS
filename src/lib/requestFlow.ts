import type { RequestStatus } from "./workshop";

/**
 * Lo que se puede hacer con una petición de repuestos y desde qué estado: la
 * máquina de la petición, escrita una sola vez.
 *
 * Antes esto estaba repartido en tres sitios que no siempre decían lo mismo: los
 * `if` de cada mutación del backend, dos listas de la ficha del panel
 * (`HOLDABLE` y `CANCELLABLE`, con un comentario que decía «los mismos que deja
 * el servidor» —y no lo eran: el servidor dejaba suspender una petición ya
 * rechazada o una ya entregada—) y el bucle de la recepción, que decidía por su
 * cuenta desde qué estados se pasa a «material recibido». Aquí está la regla; el
 * backend la consulta antes de tocar nada y el panel la consulta para decidir qué
 * botones enseña.
 *
 * Lo que no está aquí: quién puede dar cada paso (eso son capacidades, en
 * `lib/permissions`) ni qué hace el paso además de cambiar el estado (descontar
 * stock, avisar, apuntar el motivo...). Esto solo dice **de dónde a dónde**.
 *
 * El dibujo de esta máquina —con quién puede dar cada paso— está en
 * `MAQUINAS.md`, en la raíz, junto a los de la incidencia y la compra; quien lo
 * lee contra esta tabla es `tests/maquinas.test.ts`, que falla si se separan.
 *
 * Y una cosa que sí es de aquí y no era obvia: suspender una petición no es un
 * paso hacia atrás. `resume` devuelve al estado del que salió la suspensión,
 * porque volver siempre a «pendiente» tenía dos consecuencias malas: una petición
 * que esperaba presupuesto externo lo olvidaba al reanudarse, y una aprobada
 * —con el material ya descontado del almacén— volvía a poder aprobarse, con lo
 * que el material se descontaba **dos veces**.
 */

/** Los pasos que mueven una petición de un estado a otro. */
export type RequestAction =
  | "approve" // aparta material y descuenta el stock
  | "reject" // dice que no, sin tocar el stock
  | "hold" // suspende: paréntesis, no paso atrás
  | "resume" // levanta la suspensión, al estado del que salió
  | "issue" // entregada al técnico
  | "returnMaterial" // devuelta por el técnico
  | "cancel" // ya no se va a atender
  | "requestQuote" // esperando presupuesto externo
  | "receiveMaterial"; // lo comprado ha entrado en el almacén

/** Un paso: desde qué estados se puede dar y a cuál lleva. */
type RequestStep = {
  readonly from: readonly RequestStatus[];
  /**
   * A dónde lleva. `"heldFrom"` es el único destino que no es un estado fijo:
   * `resume` vuelve al estado del que salió la suspensión (`resumedStatus`).
   */
  readonly to: RequestStatus | "heldFrom";
};

/**
 * La tabla. Que esté tipada con todas las acciones y todos los estados
 * (`RequestStatus`) es a propósito: una acción nueva sin decidir sus estados, o
 * un estado que no aparezca en ningún paso, no compilan.
 *
 * Se exporta para que la pantalla de «Máquinas del taller» la lea tal cual
 * (`lib/machineSheet`): allí no hay ni una transición escrita a mano.
 */
export const REQUEST_STEPS = {
  approve: { from: ["pending", "materialReceived"], to: "approved" },
  reject: { from: ["pending"], to: "rejected" },
  hold: {
    from: ["pending", "approved", "pendingSupplierQuote"],
    to: "onHold",
  },
  resume: { from: ["onHold"], to: "heldFrom" },
  issue: { from: ["approved"], to: "issued" },
  returnMaterial: { from: ["issued"], to: "returned" },
  cancel: {
    from: ["pending", "onHold", "pendingSupplierQuote"],
    to: "cancelled",
  },
  requestQuote: { from: ["pending", "onHold"], to: "pendingSupplierQuote" },
  receiveMaterial: {
    from: ["pending", "onHold", "pendingSupplierQuote"],
    to: "materialReceived",
  },
} as const satisfies Record<RequestAction, RequestStep>;

/** Los estados desde los que se puede editar una petición: solo mientras espera
 * decisión. Lo que ya se decidió no se reescribe —se devuelve, se cancela o se
 * retira—, y con la muestra cargada a medias no se tocan fichas ya resueltas. */
const EDITABLE_STATUSES: readonly RequestStatus[] = ["pending"];

/** Los estados de una petición que aún se mueve; ninguna se archiva. */
const MOVING_STATUSES: readonly RequestStatus[] = ["pending", "onHold"];

/**
 * Los estados desde los que se puede comprar material para una petición: los que
 * aún esperan decisión —pendiente, suspendida, esperando presupuesto—. De una ya
 * aprobada o entregada no se compra nada (tiene su material), y de una rechazada,
 * retirada o devuelta tampoco: si vuelve a hacer falta, se pide de nuevo.
 */
const BUYABLE_STATUSES: readonly RequestStatus[] = [
  "pending",
  "onHold",
  "pendingSupplierQuote",
];

/** ¿Se puede dar este paso desde este estado? */
export function canRequestStep(
  status: RequestStatus,
  action: RequestAction,
): boolean {
  return REQUEST_STEPS[action].from.some((from) => from === status);
}

/**
 * El estado en el que queda la petición al dar este paso, o `null` si ese paso no
 * es legal desde donde está. Quien llama decide qué contar cuando es `null`: la
 * regla es la misma, el aviso lo escribe el sitio que lo sabe explicar.
 *
 * `heldFrom` es lo que la petición recuerda de su última suspensión y solo se usa
 * al reanudar.
 */
export function nextRequestStatus(
  status: RequestStatus,
  action: RequestAction,
  heldFrom?: RequestStatus,
): RequestStatus | null {
  if (!canRequestStep(status, action)) return null;
  const to = REQUEST_STEPS[action].to;
  return to === "heldFrom" ? resumedStatus(heldFrom) : to;
}

/**
 * A dónde vuelve una petición suspendida: al estado del que salió. Las que se
 * suspendieron antes de que se apuntara de dónde salían no lo guardan —volvieron
 * a «pendiente»— y siguen volviendo ahí: es lo que hacía el taller entonces.
 */
export function resumedStatus(
  heldFrom: RequestStatus | undefined,
): RequestStatus {
  return heldFrom ?? "pending";
}

/**
 * ¿Se puede editar la petición (asociar repuestos, cambiar la descripción)?
 * Acepta cualquier texto, como los demás predicados: quien pregunta puede tener
 * solo una fila ligera (`ArchivableRequest`) en la mano.
 */
export function canEditRequest(status: string): boolean {
  return EDITABLE_STATUSES.some((editable) => editable === status);
}

/**
 * ¿Sigue en movimiento? Una petición pendiente o en espera no se archiva ni a
 * mano ni por la pasada de la noche: «en espera» es una decisión a medias, no un
 * trabajo terminado.
 */
export function isRequestInMotion(status: string): boolean {
  return MOVING_STATUSES.some((moving) => moving === status);
}

/**
 * ¿Se puede comprar material para esta petición? Es la pregunta de la cola de
 * compras antes de apartar una línea —lo que no espera nada ya no se compra— y la
 * del backend antes de generar una petición de compra. Estaba escrita tres veces
 * —negada en una, con los tres estados repetidos en las otras dos— y por eso vive
 * aquí, con el resto de la máquina.
 *
 * Una petición «en espera» sí puede comprarse: suspenderla es un paréntesis, y el
 * material que necesita sigue faltando.
 */
export function canBuyForRequest(status: string): boolean {
  return BUYABLE_STATUSES.some((buyable) => buyable === status);
}

/* ------------------------------------------------------------------ */
/* Por qué no se puede dar un paso                                     */
/* ------------------------------------------------------------------ */

/** El nombre corto de cada paso, para poder explicarlo cuando no se puede dar. */
export const REQUEST_STEP_LABELS: Record<RequestAction, string> = {
  approve: "Aprobar",
  reject: "Rechazar",
  hold: "Poner en espera",
  resume: "Reanudar",
  issue: "Marcar entregada",
  returnMaterial: "Devolver material",
  cancel: "Cancelar petición",
  requestQuote: "Pedir presupuesto",
  receiveMaterial: "Material recibido",
};

/**
 * Los pasos que la ficha de la petición enseña, en su orden. Devolver material
 * está aunque su botón falte a veces: es el «primero devuélvela» que explica por
 * qué no se cancela una petición entregada.
 */
export const REQUEST_SHEET_STEPS: readonly RequestAction[] = [
  "approve",
  "reject",
  "issue",
  "hold",
  "resume",
  "cancel",
  "returnMaterial",
];

/** Los estados en los que ya no queda ninguna decisión que tomar. */
const SETTLED_STATUSES: readonly RequestStatus[] = [
  "rejected",
  "cancelled",
  "returned",
];

/** Un mismo motivo para todos los pasos: lo que ya no se decide. */
const SETTLED_REASON =
  "ya está resuelta: no se vuelve a decidir, ni a entregar, ni a cancelar";

/** Qué necesita cada paso, cuando no hay un motivo más concreto que contar. */
const REQUEST_STEP_NEEDS: Record<RequestAction, string> = {
  approve:
    "se aprueba lo que espera decisión o lo que acaba de llegar del proveedor",
  reject: "se rechaza lo que espera decisión",
  hold: "se pone en espera lo que aún espera decisión o lo ya aprobado",
  resume: "se reanuda lo que está en espera",
  issue: "se entrega lo aprobado",
  returnMaterial: "se devuelve lo entregado",
  cancel: "se cancela lo que todavía no tiene material comprometido",
  requestQuote: "se pide presupuesto desde pendiente o en espera",
  receiveMaterial: "el material recibido entra desde lo que aún esperaba",
};

/**
 * Los motivos que sí cuentan algo que hacer: un paso bloqueado por una condición
 * se explica con lo que hay que hacer antes —devolver el material, reanudar la
 * suspensión—, que es lo que la ficha necesita decir.
 */
const REQUEST_STEP_EXCUSES: Partial<
  Record<RequestAction, Partial<Record<RequestStatus, string>>>
> = {
  approve: { onHold: "está en espera: reanúdala antes de decidirla" },
  reject: { onHold: "está en espera: reanúdala antes de decidirla" },
  hold: { issued: "una petición entregada se devuelve antes de suspenderla" },
  cancel: {
    approved:
      "tiene material comprometido: antes hay que devolverlo o reintegrar el stock",
    issued: "primero devuélvela desde «Devolver material»",
  },
};

/**
 * Por qué no se puede dar este paso desde aquí, o `null` si sí se puede. Es la
 * misma regla que consulta el servidor (`canRequestStep`) contada para que la lea
 * una persona: la ficha la enseña en vez de esconder el botón sin más.
 */
export function requestStepBlocker(
  status: RequestStatus,
  action: RequestAction,
): string | null {
  if (canRequestStep(status, action)) return null;
  if (SETTLED_STATUSES.some((settled) => settled === status)) {
    return SETTLED_REASON;
  }
  return REQUEST_STEP_EXCUSES[action]?.[status] ?? REQUEST_STEP_NEEDS[action];
}

/**
 * Los pasos que no se pueden dar desde aquí, agrupados por motivo: los que se
 * explican igual van juntos, para que la ficha diga una vez «ya está resuelta»
 * en vez de repetirlo en cada paso.
 */
export function blockedRequestSteps(
  status: RequestStatus,
  steps: readonly RequestAction[] = REQUEST_SHEET_STEPS,
): { reason: string; actions: RequestAction[] }[] {
  const groups: { reason: string; actions: RequestAction[] }[] = [];
  for (const action of steps) {
    const reason = requestStepBlocker(status, action);
    if (reason === null) continue;
    const already = groups.find((group) => group.reason === reason);
    if (already) already.actions.push(action);
    else groups.push({ reason, actions: [action] });
  }
  return groups;
}
