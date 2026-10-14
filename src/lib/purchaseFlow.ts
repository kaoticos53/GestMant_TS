import type { PurchaseOrderStatus, PurchaseRequestStatus } from "./purchasing";

/**
 * Lo que se puede hacer con una compra y desde qué estado: la máquina de la
 * petición de compra y la de la orden, escritas una sola vez.
 *
 * Es la tercera máquina del taller, hermana de `requestFlow` (la petición de
 * repuestos) e `incidentFlow` (la incidencia), y nace por lo mismo: la regla
 * estaba repartida entre los `if` de cada mutación del backend y lo que decidía
 * la pantalla por su cuenta. Antes de esto:
 *
 * - El backend comprobaba a pelo que solo se cambia el proveedor de una petición
 *   «sin tratar», que no se retira lo que ya está en una orden y que no se
 *   recepciona de una orden completada o anulada.
 * - La ficha de compras ofrecía **Nota**, **Proveedor** y **Retirar** en
 *   cualquier petición de compra: también en las ya recibidas o retiradas, donde
 *   el servidor las rechaza. Se podía pulsar y comerse un error.
 * - «¿Sigue viva esta petición de compra?» —lo que evita comprar dos veces lo
 *   mismo— estaba escrito de dos formas distintas: una en la cola de la pantalla
 *   y otra en la pasada que cierra las peticiones al recepcionar.
 *
 * Lo que no está aquí: quién puede dar cada paso (las capacidades, en
 * `lib/permissions`) ni lo que hace el paso además de cambiar el estado —el
 * stock que entra, el albarán, los avisos, devolver las peticiones a la cola al
 * anular—. Esto solo dice **de dónde a dónde**.
 *
 * El dibujo de estas dos máquinas —con quién puede dar cada paso— está en
 * `MAQUINAS.md`, en la raíz, junto a los de la incidencia y la petición; quien lo
 * lee contra estas tablas es `tests/maquinas.test.ts`, que falla si se separan.
 */

/** Los pasos que mueven una petición de compra de un estado a otro. */
export type PurchaseRequestAction =
  | "order" // entra en una orden: se manda al proveedor
  | "unorder" // la vuelta: anular la orden la devuelve a la cola
  | "cancel" // se retira: ya no se compra
  | "receive"; // ha llegado todo lo que se pidió de ella

/**
 * El estado en el que queda una petición de compra: `cancelled` cuando se
 * retira y `received` cuando llega entera. Lo apunta la recepción de la orden,
 * que es quien sabe cuánto ha entrado de cada artículo.
 *
 * Se exporta —como las otras tres tablas— para que la pantalla de «Máquinas del
 * taller» la lea tal cual (`lib/machineSheet`): allí no hay ni una transición
 * escrita a mano.
 */
export const PURCHASE_REQUEST_STEPS: Record<
  PurchaseRequestAction,
  {
    readonly from: readonly PurchaseRequestStatus[];
    readonly to: PurchaseRequestStatus;
  }
> = {
  order: { from: ["pending"], to: "ordered" },
  // `unorder` no lo da nadie a mano: es lo que le pasa a la petición cuando se
  // anula su orden. Está aquí porque es la vuelta de `order`, y sin ella el
  // «¿estaba dentro de la orden?» del backend sería un `status === "ordered"` a
  // pelo. Lo que ya entró en el almacén no vuelve: desde `received` no hay paso.
  unorder: { from: ["ordered"], to: "pending" },
  cancel: { from: ["pending"], to: "cancelled" },
  receive: { from: ["ordered"], to: "received" },
};

/** Los pasos de la orden que se manda al proveedor. */
export type PurchaseOrderAction =
  | "receive" // ha llegado material: parte o todo
  | "cancel"; // se anula: sus peticiones vuelven a la cola

/**
 * La tabla de la orden. El destino de «recepcionar» no es un estado fijo —una
 * orden está completada o parcial según lo que haya llegado, y eso depende de
 * sus artículos—, así que se resuelve con `purchaseOrderStatusAfterReceiving`.
 */
export const PURCHASE_ORDER_STEPS: Record<
  PurchaseOrderAction,
  {
    readonly from: readonly PurchaseOrderStatus[];
    readonly to: PurchaseOrderStatus | "allReceived";
  }
> = {
  receive: { from: ["pending", "partial"], to: "allReceived" },
  cancel: { from: ["pending", "partial"], to: "cancelled" },
};

/** Los estados en los que una petición de compra ya no se toca. */
const CLOSED_PURCHASE_REQUEST_STATUSES: readonly PurchaseRequestStatus[] = [
  "received",
  "cancelled",
];

/** Los estados en los que una orden ya no se toca. */
const CLOSED_PURCHASE_ORDER_STATUSES: readonly PurchaseOrderStatus[] = [
  "completed",
  "cancelled",
];

/**
 * ¿Se puede dar este paso desde este estado? Acepta cualquier texto, como los
 * demás predicados del taller: quien pregunta puede tener en la mano una fila
 * ligera o un estado que no sea suyo.
 */
export function canAdvancePurchaseRequest(
  status: string,
  action: PurchaseRequestAction,
): boolean {
  return PURCHASE_REQUEST_STEPS[action].from.some((from) => from === status);
}

/**
 * El estado en el que queda la petición de compra al dar este paso, o `null` si
 * ese paso no es legal desde donde está. Quien llama decide qué contar cuando es
 * `null`: la regla es la misma, el aviso lo escribe el sitio que lo sabe
 * explicar.
 */
export function nextPurchaseRequestStatus(
  status: string,
  action: PurchaseRequestAction,
): PurchaseRequestStatus | null {
  if (!canAdvancePurchaseRequest(status, action)) return null;
  return PURCHASE_REQUEST_STEPS[action].to;
}

/**
 * El estado con el que queda una petición de compra de la que ha llegado todo lo
 * que pedía: `receive`, que es desde «pedida».
 *
 * Y una fila que sigue «sin tratar» dentro de una orden —datos de antes de que
 * se apuntara el orden, o de una petición que se metió a mano— se cierra igual:
 * su material ha llegado, y dejarla abierta la haría comprarse otra vez. Lo que
 * ya se retiró o se recibió no revive: de ahí no hay paso.
 */
export function purchaseRequestReceivedStatus(
  status: string,
): PurchaseRequestStatus | null {
  const settled = nextPurchaseRequestStatus(status, "receive");
  if (settled !== null) return settled;
  return isPurchaseRequestUntreated(status)
    ? PURCHASE_REQUEST_STEPS.receive.to
    : null;
}

/**
 * ¿Está sin tratar? Es lo que espera a que alguien monte la orden —y por eso es
 * también de donde se puede pedir, cambiar el proveedor o retirar—. El estado
 * deja de estar sin tratar en cuanto entra en una orden: ahí manda la orden.
 */
export function isPurchaseRequestUntreated(status: string): boolean {
  return canAdvancePurchaseRequest(status, "order");
}

/**
 * ¿Ya está cerrada? Lo recibido no se reescribe y lo retirado tampoco: en las
 * dos, la nota de la compra se queda como está.
 */
export function isPurchaseRequestClosed(status: string): boolean {
  return CLOSED_PURCHASE_REQUEST_STATUSES.some((closed) => closed === status);
}

/** Un renglón de compra, con lo que se pidió y lo que ha llegado. */
export interface PurchaseLineProgress {
  readonly quantity: number;
  readonly receivedQuantity: number;
}

/**
 * ¿Sigue en camino esta petición de compra: se pidió al proveedor y todavía no
 * ha entrado? Es la pregunta que evita comprar dos veces lo mismo —una línea que
 * ya está en camino no se aparta otra vez— y la que decide si la petición de
 * repuestos que hay detrás ya puede darse por abastecida.
 *
 * Se apoya en el estado —lo que no está cerrado sigue en camino: lo que espera
 * orden y lo que está en una— y, además, deja fuera lo que ya tiene fecha de
 * recepción: una fila a la que le falta el estado pero ya entró no se compra de
 * nuevo, que es lo que pasaría si solo se mirara el estado.
 */
export function isPurchaseRequestAwaitingDelivery(row: {
  status: string;
  receivedAt?: number;
}): boolean {
  if (row.receivedAt !== undefined) return false;
  return !isPurchaseRequestClosed(row.status);
}

/**
 * ¿Se puede dar este paso desde este estado? En la orden, lo mismo que en la
 * petición de compra.
 */
export function canAdvancePurchaseOrder(
  status: string,
  action: PurchaseOrderAction,
): boolean {
  return PURCHASE_ORDER_STEPS[action].from.some((from) => from === status);
}

/**
 * El estado de una orden después de una recepción: completada si ha llegado todo
 * lo pedido, parcial si queda algo por llegar. Se mira artículo a artículo, no
 * el total, porque recibir 100 de un artículo y 0 de otro no es haber recibido
 * la mitad.
 */
export function purchaseOrderStatusAfterReceiving(
  lines: readonly PurchaseLineProgress[],
): PurchaseOrderStatus {
  const everything = lines.every(
    (line) => line.receivedQuantity >= line.quantity,
  );
  return everything ? "completed" : "partial";
}

/**
 * ¿Ya está cerrada la orden? Completada —no queda nada por recibir— o anulada
 * —sus peticiones han vuelto a la cola—: en ninguna de las dos se anota ni se
 * recepciona nada más.
 */
export function isPurchaseOrderClosed(status: string): boolean {
  return CLOSED_PURCHASE_ORDER_STATUSES.some((closed) => closed === status);
}

/* ------------------------------------------------------------------ */
/* Por qué no se puede tocar una orden                                 */
/* ------------------------------------------------------------------ */

/**
 * El nombre corto de cada paso de la petición de compra, para poder leerlos
 * juntos —la ficha de las máquinas del taller los enseña— y para tener la lista
 * de pasos de esa máquina tipada: una acción nueva sin nombre no compila.
 */
export const PURCHASE_REQUEST_STEP_LABELS: Record<
  PurchaseRequestAction,
  string
> = {
  order: "Meter en una orden",
  unorder: "Volver a la cola",
  cancel: "Retirar",
  receive: "Material recibido",
};

/** El nombre corto de cada paso de la orden, para explicarlo cuando no se puede. */
export const PURCHASE_ORDER_STEP_LABELS: Record<PurchaseOrderAction, string> = {
  receive: "Recepcionar material",
  cancel: "Anular la orden",
};

/** Los pasos que la orden enseña, en su orden. */
export const PURCHASE_ORDER_SHEET_STEPS: readonly PurchaseOrderAction[] = [
  "receive",
  "cancel",
];

/** Qué necesita cada paso, cuando no hay un motivo más concreto que contar. */
const PURCHASE_ORDER_STEP_NEEDS: Record<PurchaseOrderAction, string> = {
  receive: "se recepciona lo que todavía está por llegar",
  cancel: "se anula una orden a la que aún le falta material",
};

/** Los motivos de lo ya cerrado, uno por final. */
const CLOSED_PURCHASE_ORDER_REASONS: Partial<
  Record<PurchaseOrderStatus, string>
> = {
  completed: "ya está completada: entró todo lo que se pidió",
  cancelled: "ya está anulada: sus peticiones volvieron a la cola",
};

/**
 * Por qué no se puede dar este paso desde aquí, o `null` si sí se puede. Es la
 * misma regla que consulta el servidor (`canAdvancePurchaseOrder`) contada para
 * que la lea una persona: la ficha de la orden la enseña en vez de esconder el
 * botón sin más.
 */
export function purchaseOrderStepBlocker(
  status: PurchaseOrderStatus,
  action: PurchaseOrderAction,
): string | null {
  if (canAdvancePurchaseOrder(status, action)) return null;
  return (
    CLOSED_PURCHASE_ORDER_REASONS[status] ?? PURCHASE_ORDER_STEP_NEEDS[action]
  );
}

/**
 * Los pasos que no se pueden dar desde aquí, agrupados por motivo: una orden
 * completada los explica los dos con la misma frase, y se dice una vez.
 */
export function blockedPurchaseOrderSteps(
  status: PurchaseOrderStatus,
  steps: readonly PurchaseOrderAction[] = PURCHASE_ORDER_SHEET_STEPS,
): { reason: string; actions: PurchaseOrderAction[] }[] {
  const groups: { reason: string; actions: PurchaseOrderAction[] }[] = [];
  for (const action of steps) {
    const reason = purchaseOrderStepBlocker(status, action);
    if (reason === null) continue;
    const already = groups.find((group) => group.reason === reason);
    if (already) already.actions.push(action);
    else groups.push({ reason, actions: [action] });
  }
  return groups;
}
