import {
  INCIDENT_STEP_LABELS,
  INCIDENT_STEPS,
  blockedIncidentSteps,
} from "./incidentFlow";
import {
  PURCHASE_ORDER_STEP_LABELS,
  PURCHASE_ORDER_STEPS,
  PURCHASE_REQUEST_STEP_LABELS,
  PURCHASE_REQUEST_STEPS,
  blockedPurchaseOrderSteps,
} from "./purchaseFlow";
import {
  PURCHASE_ORDER_STATUS_META,
  PURCHASE_REQUEST_STATUS_META,
  type PurchaseOrderStatus,
} from "./purchasing";
import {
  REQUEST_STEP_LABELS,
  REQUEST_STEPS,
  blockedRequestSteps,
} from "./requestFlow";
import {
  INCIDENT_STATUS_META,
  STATUS_META,
  type IncidentStatus,
  type RequestStatus,
} from "./workshop";

/**
 * La ficha de las cuatro máquinas del taller —la incidencia, la petición de
 * repuestos y las dos de la compra—, tal y como la pinta la pantalla de
 * «Máquinas del taller».
 *
 * Aquí no hay ni una transición escrita a mano: se recorre la **tabla** de cada
 * máquina (`incidentFlow`, `requestFlow`, `purchaseFlow`), se cruza con los
 * estados que ya usa el panel (`lib/workshop`, `lib/purchasing`) y con los
 * motivos que da la propia máquina cuando un paso no se puede dar
 * (`*StepBlocker`). Es la misma verdad que `MAQUINAS.md`, con la diferencia de
 * que el documento hay que abrirlo: esto sale del código que decide de verdad
 * —el mismo que consulta el backend antes de tocar una ficha—, así que la
 * pantalla no puede quedarse atrás sin que se note.
 *
 * Lo que **no** sale de aquí: quién puede dar cada paso. Eso son capacidades que
 * cada mutación comprueba antes de tocar nada y que no están escritas junto a la
 * tabla de transiciones (lo dice la cabecera de `incidentFlow`); quien las
 * quiera ver tiene la matriz de «Roles y permisos». Y lo que tampoco se inventa:
 * una máquina que no sabe explicar por qué no se puede dar un paso —la petición
 * de compra no tiene motivos escritos— se queda sin esa línea, en vez de
 * escribirla aquí a mano.
 *
 * Se prueba en `tests/machineSheet.test.ts`, que recorre las tablas por su lado
 * y exige que la ficha diga exactamente lo mismo, y en
 * `tests/machinesView.test.tsx`, que la pinta.
 */

/** Un estado, tal y como lo llama la pantalla (con la píldora de su color). */
export interface SheetStateInfo {
  readonly key: string;
  readonly label: string;
  readonly description?: string;
  readonly badgeClassName?: string;
}

/**
 * A dónde lleva un paso: a un estado, o a lo que la máquina decide al darlo
 * —reanudar vuelve al estado del que salió la suspensión, y recepcionar deja la
 * orden completada o parcial según lo que haya llegado—.
 */
export type SheetDestination =
  | {
      readonly kind: "status";
      readonly status: string;
      readonly label: string;
      readonly badgeClassName?: string;
    }
  | { readonly kind: "decided"; readonly note: string };

/** Un paso, tal y como se puede dar desde un estado concreto. */
export interface SheetStep {
  /** Cómo lo llama la máquina. */
  readonly action: string;
  /** Su nombre corto, el mismo que usa la ficha para ofrecerlo. */
  readonly label: string;
  readonly to: SheetDestination;
}

/** Un estado de la máquina, con lo que se puede hacer desde él y lo que no. */
export interface SheetState extends SheetStateInfo {
  readonly steps: readonly SheetStep[];
  /** Los pasos que no se pueden dar desde aquí, con el motivo, agrupado. */
  readonly blocked: readonly {
    readonly reason: string;
    readonly labels: readonly string[];
  }[];
}

/** Una máquina, lista para pintar. */
export interface SheetMachine {
  readonly id: string;
  readonly title: string;
  readonly note: string;
  readonly states: readonly SheetState[];
}

/**
 * Los dos destinos que no son un estado: la tabla los escribe como un nombre
 * —`heldFrom`, `allReceived`— porque quien resuelve a dónde va cada uno es una
 * función de su módulo. Aquí solo se cuenta con qué palabras se leen, y el test
 * de la ficha exige que no haya ninguno más.
 */
const DECIDED_DESTINATIONS: Record<string, string> = {
  // `resume` no vuelve siempre a «pendiente»: vuelve al estado del que salió
  // (`resumedStatus`), que es lo que evita aprobar dos veces lo mismo.
  heldFrom: "El estado del que salió, o pendiente si no se apuntó",
  // «Recepcionar» no deja un estado fijo: mira artículo a artículo lo que ha
  // llegado (`purchaseOrderStatusAfterReceiving`).
  allReceived: "Completada o parcial, según lo que haya llegado",
};

/** Traduce el destino de una fila de la tabla a como se lee en pantalla. */
function destinoDe(
  to: string,
  etiquetas: Record<string, SheetStateInfo>,
): SheetDestination {
  const note = DECIDED_DESTINATIONS[to];
  if (note !== undefined) return { kind: "decided", note };
  const estado = etiquetas[to];
  return {
    kind: "status",
    status: to,
    label: estado?.label ?? to,
    ...(estado?.badgeClassName
      ? { badgeClassName: estado.badgeClassName }
      : {}),
  };
}

/** Los estados de una máquina, en el orden en que están declarados. */
function estadosDe<K extends string>(
  meta: Record<
    K,
    {
      label: string;
      description?: string;
      badgeClassName?: string;
    }
  >,
): SheetStateInfo[] {
  return (Object.keys(meta) as K[]).map((key) => ({
    key,
    label: meta[key].label,
    ...(meta[key].description ? { description: meta[key].description } : {}),
    ...(meta[key].badgeClassName
      ? { badgeClassName: meta[key].badgeClassName }
      : {}),
  }));
}

/**
 * Cruza una tabla con sus estados: un bloque por estado, con los pasos que salen
 * de él y los que no (y por qué, si la máquina lo sabe decir).
 */
function hojaDe<A extends string>(
  estados: readonly SheetStateInfo[],
  pasos: Record<A, { readonly from: readonly string[]; readonly to: string }>,
  nombres: Record<A, string>,
  motivos?: (
    status: string,
    acciones: readonly A[],
  ) => readonly { reason: string; actions: readonly A[] }[],
): SheetState[] {
  const acciones = Object.keys(nombres) as A[];
  const etiquetas: Record<string, SheetStateInfo> = {};
  for (const estado of estados) etiquetas[estado.key] = estado;

  return estados.map((estado) => ({
    ...estado,
    steps: acciones
      .filter((accion) =>
        pasos[accion].from.some((desde) => desde === estado.key),
      )
      .map((accion) => ({
        action: accion,
        label: nombres[accion],
        to: destinoDe(pasos[accion].to, etiquetas),
      })),
    blocked: (motivos?.(estado.key, acciones) ?? []).map((grupo) => ({
      reason: grupo.reason,
      labels: grupo.actions.map((accion) => nombres[accion]),
    })),
  }));
}

/** Las cuatro máquinas del taller, en el orden en que se cuentan. */
export const MACHINE_SHEET: readonly SheetMachine[] = [
  {
    id: "incident",
    title: "Cómo avanza una incidencia",
    note: "Entra por el formulario público —la notifica quien está en el plató, sin cuenta— y nace nueva, sin dueño: el primer paso es que alguien la coja.",
    states: hojaDe(
      estadosDe(INCIDENT_STATUS_META),
      INCIDENT_STEPS,
      INCIDENT_STEP_LABELS,
      (status, acciones) =>
        blockedIncidentSteps(status as IncidentStatus, acciones),
    ),
  },
  {
    id: "request",
    title: "Cómo avanza una petición de repuestos",
    note: "Nace pendiente cuando alguien pide material. Si el almacén no lo tiene, se compra: cuando llega, la petición pasa a material recibido y ya se puede aprobar.",
    states: hojaDe(
      estadosDe(STATUS_META),
      REQUEST_STEPS,
      REQUEST_STEP_LABELS,
      (status, acciones) =>
        blockedRequestSteps(status as RequestStatus, acciones),
    ),
  },
  {
    id: "purchaseRequest",
    title: "Cómo avanza una petición de compra",
    note: "Lo que el almacén no puede cubrir, apartado para comprarlo. No la mueve nadie a mano de punta a punta: entra en una orden y la cierra la recepción.",
    states: hojaDe(
      estadosDe(PURCHASE_REQUEST_STATUS_META),
      PURCHASE_REQUEST_STEPS,
      PURCHASE_REQUEST_STEP_LABELS,
    ),
  },
  {
    id: "purchaseOrder",
    title: "Cómo avanza una orden de compra",
    note: "Lo que se manda al proveedor, con las peticiones de compra dentro. La cierra la recepción —completada cuando entra todo— y anularla devuelve sus peticiones a la cola.",
    states: hojaDe(
      estadosDe(PURCHASE_ORDER_STATUS_META),
      PURCHASE_ORDER_STEPS,
      PURCHASE_ORDER_STEP_LABELS,
      (status, acciones) =>
        blockedPurchaseOrderSteps(status as PurchaseOrderStatus, acciones),
    ),
  },
];
