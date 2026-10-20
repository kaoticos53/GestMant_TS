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

/**
 * Los estados en los que la petición ya no espera a que el material llegue a
 * manos del técnico: o se entregó, o se cerró sin servir (rechazada, cancelada o
 * devuelta). Son los que cuentan para saber si una incidencia sigue esperando
 * repuestos (`convex/_partRequests/incidentSync`).
 */
const NO_LONGER_AWAITING_STATUSES: readonly RequestStatus[] = [
  "issued",
  "rejected",
  "cancelled",
  "returned",
];

/** ¿La petición sigue pendiente del material? */
export function isRequestAwaitingDelivery(status: string): boolean {
  return !NO_LONGER_AWAITING_STATUSES.some((settled) => settled === status);
}

/**
 * ¿El material está en manos del técnico? Lo devuelto no: salió del almacén, sí,
 * pero volvió, así que la incidencia no puede contar con él para reparar. Es la
 * pregunta que decide si una espera se cierra en «en reparación» o vuelve a
 * abrirse.
 */
export function isRequestDelivered(status: string): boolean {
  return status === "issued";
}

/**
 * Una línea de petición, en lo que a la entrega se refiere: cuánto se pidió y
 * cuánto ha salido ya del almacén.
 *
 * Estructural y no `RequestLine` del esquema a propósito: `src/lib/` no puede
 * importar Convex, y la ficha de la incidencia, el seguimiento y la petición
 * tienen cada uno su forma de traer la línea.
 */
export interface RequestLineProgress {
  quantity: number;
  /** Lo entregado de esta línea, si se ha apuntado. Sin apuntar, se lee abajo. */
  deliveredQuantity?: number;
}

/**
 * Lo entregado de una línea, en unidades.
 *
 * Las peticiones que se entregaron antes de que se apuntara por línea no tienen
 * el dato, y su estado dice que salió todo: se leen enteras para que el histórico
 * no aparezca de golpe «sin entregar». Y nunca más de lo pedido: una fila
 * corregida a mano no puede inventar material.
 */
export function lineDelivered(
  line: RequestLineProgress,
  status: string,
): number {
  if (line.deliveredQuantity !== undefined) {
    return Math.max(0, Math.min(line.deliveredQuantity, line.quantity));
  }
  return status === "issued" || status === "returned" ? line.quantity : 0;
}

/** Lo que queda por entregar de una línea: lo pedido menos lo entregado. */
export function lineRemaining(
  line: RequestLineProgress,
  status: string,
): number {
  return Math.max(0, line.quantity - lineDelivered(line, status));
}

/** El material de una petición, contado por líneas y por unidades. */
export interface RequestDelivery {
  /** Líneas que tiene la petición. */
  totalLines: number;
  /** Unidades pedidas en total. */
  totalUnits: number;
  /** Unidades que ya han salido del almacén. */
  deliveredUnits: number;
  /** Unidades que faltan por entregar. */
  pendingUnits: number;
  /** Líneas entregadas completas. */
  deliveredLines: number;
  /** ¿Ha salido algo ya? Es lo que distingue «parcial» de «sin entregar». */
  anyDelivered: boolean;
  /** ¿Está todo lo pedido en manos del técnico? */
  complete: boolean;
}

/**
 * La entrega de una petición, contada entera. Es la cuenta que comparten la
 * ficha de la petición, la de la incidencia y el seguimiento público: una entrega
 * de una en una no se puede contar distinto en cada pantalla.
 *
 * Se cuenta por unidades y por líneas porque las dos preguntas son distintas:
 * «¿cuánto falta?» se responde con unidades, y «¿qué líneas están completas?» con
 * las líneas. Una petición sin líneas no está completa: no hay nada que entregar.
 */
export function requestDelivery(
  lines: readonly RequestLineProgress[],
  status: string,
): RequestDelivery {
  let totalUnits = 0;
  let deliveredUnits = 0;
  let deliveredLines = 0;
  for (const line of lines) {
    const delivered = lineDelivered(line, status);
    totalUnits += line.quantity;
    deliveredUnits += delivered;
    if (line.quantity > 0 && delivered >= line.quantity) deliveredLines += 1;
  }
  return {
    totalLines: lines.length,
    totalUnits,
    deliveredUnits,
    pendingUnits: Math.max(0, totalUnits - deliveredUnits),
    deliveredLines,
    anyDelivered: deliveredUnits > 0,
    complete: totalUnits > 0 && deliveredUnits >= totalUnits,
  };
}

/**
 * Lo que salió en una tanda, escrito para la constancia: «2 × ALI-12024 Fuente de
 * alimentación 12 V».
 *
 * Es la nota que se guarda con cada entrega (`requestDecisions`), y cuenta lo que
 * se entregó en esa tanda —no lo que lleva la petición—: la constancia sirve para
 * saber quién entregó qué y cuándo, y eso solo se responde tanda a tanda. Va en
 * una línea para que quepa en el note de una decisión y se lea de un vistazo.
 */
export function deliveryNote(
  lines: readonly { code: string; name: string; quantity: number }[],
): string {
  return lines
    .map((line) => `${line.quantity} × ${line.code} ${line.name}`)
    .join(" · ");
}

/**
 * Las razones con las que una entrega deja constancia en la petición
 * (`requestDecisions`, en `convex/schema`).
 *
 * Son dos porque la constancia dice si con esa tanda salió lo último que faltaba
 * o si la petición sigue esperando al resto: «entregado» y «entregado en parte»
 * no cuentan lo mismo al leer el rastro.
 */
export const DELIVERY_REASONS = [
  "materialDelivered",
  "materialPartiallyDelivered",
] as const;

/** ¿Esta constancia es una entrega de material? */
export function isDeliveryReason(reason: string | undefined): boolean {
  return DELIVERY_REASONS.some((delivery) => delivery === reason);
}

/**
 * Qué se puede decir del material de una petición cuando se lee desde fuera —la
 * ficha de la incidencia que lo pidió—: si está en manos del técnico, si volvió,
 * si ya no va a llegar o si sigue esperando.
 *
 * `pending` es todo lo anterior a la entrega, también lo aprobado: el material
 * apartado sigue en el almacén, y decir «disponible» desde la incidencia daba a
 * entender que ya se había montado. `partial` es lo que trae la entrega de una en
 * una: salió parte del material y el resto sigue en el almacén. `dropped` recoge
 * lo rechazado y lo cancelado —lo devuelto tiene su propio caso, porque sí salió
 * del almacén—.
 *
 * La entrega se cuenta por línea (`requestDelivery`), así que quien la tenga a
 * mano la pasa y la ficha distingue «sin entregar» de «a medias». Sin la cuenta,
 * el estado de la petición es toda la información que hay.
 */
export type RequestMaterialState =
  "pending" | "partial" | "delivered" | "returned" | "dropped";

export function requestMaterialState(
  status: string,
  delivery?: RequestDelivery,
): RequestMaterialState {
  if (isRequestDelivered(status)) return "delivered";
  if (status === "returned") return "returned";
  if (!isRequestAwaitingDelivery(status)) return "dropped";
  return delivery?.anyDelivered ? "partial" : "pending";
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
  issue: "Entregar material",
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

/**
 * ¿La petición ya está resuelta (rechazada, cancelada o devuelta)?
 *
 * Lo devuelto cuenta como resuelto aunque el material sí saliera: se dio el paso
 * de devolverlo, así que no queda nada que decidir. La ficha lo usa para no
 * enumerar paso a paso lo que ya no se va a dar.
 */
export function isRequestSettled(status: string): boolean {
  return SETTLED_STATUSES.some((settled) => settled === status);
}

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
 * El motivo concreto que cuenta qué hay que hacer antes de dar el paso —devolver
 * el material, reanudar la suspensión—, o `null` cuando el bloqueo es solo «aquí
 * ya no toca». La diferencia importa para la ficha: lo genérico se calla cuando
 * la etapa ya se pasó, lo concreto se dice siempre.
 */
export function requestStepExcuse(
  status: RequestStatus,
  action: RequestAction,
): string | null {
  return REQUEST_STEP_EXCUSES[action]?.[status] ?? null;
}

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
  if (isRequestSettled(status)) return SETTLED_REASON;
  return requestStepExcuse(status, action) ?? REQUEST_STEP_NEEDS[action];
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
