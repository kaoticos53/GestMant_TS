/**
 * El recorrido de una petición de repuesto, en etapas, para leerlo de un vistazo.
 *
 * La ficha ya contaba cada paso en sus decisiones y en el rastro de entregas,
 * pero eso está al final de una ficha larga: para saber dónde va la petición y
 * qué toca ahora había que bajar hasta el pie. Esto resume lo mismo arriba, sin
 * repetir la regla: las etapas son los estados de `lib/requestFlow` con sus
 * nombres de `lib/workshop`, y si un paso se puede dar lo decide `canRequestStep`
 * —aquí no hay ni una transición escrita a mano—.
 *
 * Son tres etapas y un cierre: **pendiente → aprobada → entregada**, y una cuarta
 * solo cuando la petición terminó sin entregarse —rechazada, cancelada o
 * devuelta—. No se inventa una etapa futura para un caso que ya se cerró: lo que
 * no se pasó se pinta en punteado.
 *
 * La suspensión no es una etapa: es un paréntesis. La petición sigue en la etapa
 * de la que salió, y por eso su sitio se lee de `heldFrom` —una suspendida que
 * venía de aprobada sigue estando en «aprobada»—, igual que hace la máquina al
 * reanudarla (`resumedStatus`).
 */

import {
  canRequestStep,
  REQUEST_SHEET_STEPS,
  REQUEST_STEP_LABELS,
  requestStepBlocker,
  requestStepExcuse,
  type RequestAction,
} from "./requestFlow";
import type { BlockedJourneyStep, JourneyStage } from "./journey";
import { STATUS_META, type RequestStatus } from "./workshop";

/** Cuál de las etapas del recorrido de una petición. */
export type RequestJourneyStageKey =
  "pending" | "approved" | "issued" | "closed" | "archived";

/** El orden del recorrido: los motivos se enseñan en ese mismo orden. */
const STAGE_ORDER: readonly string[] = [
  "pending",
  "approved",
  "issued",
  "closed",
  "archived",
];

/** Los finales que no son una entrega: la petición se cierra sin material. */
const NEGATIVE_OUTCOMES: readonly RequestStatus[] = [
  "rejected",
  "cancelled",
  "returned",
];

/**
 * En qué etapa está la petición ahora.
 *
 * `onHold` se lee de donde salió: una suspendida que venía de aprobada está en
 * «aprobada», no en «pendiente». `pendingSupplierQuote` y `materialReceived` son
 * la misma etapa —el caso espera una decisión— con otro matiz, y ese matiz lo
 * cuenta la línea de «Ahora», que es donde cabe sin cortarse.
 */
function currentStage(
  status: RequestStatus,
  heldFrom: RequestStatus | undefined,
): RequestJourneyStageKey {
  // El cierre es su propia etapa: si una rechazada se pintara como «pendiente»,
  // la ficha tendría dos etapas de ahora y diría que aún espera una decisión.
  if (NEGATIVE_OUTCOMES.some((outcome) => outcome === status)) return "closed";
  if (status === "issued") return "issued";
  if (status === "approved") return "approved";
  if (status === "onHold" && heldFrom === "approved") return "approved";
  return "pending";
}

/**
 * ¿Llegó a aprobarse? Lo necesitan los cierres: una petición cancelada después
 * de aprobarse pasó por la etapa de aprobación y no se puede pintar como si no.
 */
function passedApproval(
  status: RequestStatus,
  heldFrom: RequestStatus | undefined,
): boolean {
  if (status === "approved" || status === "issued" || status === "returned") {
    return true;
  }
  return status === "cancelled" && heldFrom === "approved";
}

/** ¿Salió el material del almacén? Lo devuelto sí salió —y volvió—. */
function passedDelivery(status: RequestStatus): boolean {
  return status === "issued" || status === "returned";
}

/**
 * El recorrido de una petición: pendiente → aprobada → entregada y, si terminó
 * sin entregarse, el cierre con el nombre que le da su estado.
 *
 * `archived` añade el último tramo, que no es del flujo sino de su vida: la
 * petición salió de la cola. Una entregada y archivada no se lee igual que una
 * entregada que sigue ahí esperando a que alguien la recoja, y esa diferencia es
 * justo lo que no se veía cuando el archivo solo era un aviso de texto.
 */
export function requestJourney(
  status: RequestStatus,
  {
    heldFrom,
    archived = false,
  }: { heldFrom?: RequestStatus; archived?: boolean } = {},
): JourneyStage[] {
  const current = currentStage(status, heldFrom);
  const closed = NEGATIVE_OUTCOMES.some((outcome) => outcome === status);

  const pending: JourneyStage = {
    key: "pending",
    label: STATUS_META.pending.label,
    // Para llegar aquí alguien la pidió: la etapa de la petición siempre se pasó.
    state: current === "pending" ? "current" : "done",
  };

  const approved: JourneyStage = {
    key: "approved",
    label: STATUS_META.approved.label,
    state:
      current === "approved"
        ? "current"
        : passedApproval(status, heldFrom)
          ? "done"
          : current === "pending" || status === "issued"
            ? "pending"
            : "skipped",
  };

  const issued: JourneyStage = {
    key: "issued",
    label: STATUS_META.issued.label,
    state:
      current === "issued"
        ? "current"
        : passedDelivery(status)
          ? "done"
          : closed
            ? "skipped"
            : "pending",
  };

  const stages = [pending, approved, issued];
  // El cierre: «Rechazada», «Cancelada» o «Devuelta», que es lo que de verdad
  // pasó. La etapa de entrega queda como «no se pasó» cuando no la hubo.
  const recorrido = closed
    ? [
        ...stages,
        {
          key: "closed",
          label: STATUS_META[status].label,
          state: "current" as const,
        },
      ]
    : stages;
  if (!archived) return recorrido;

  // El archivo: lo que estaba en su etapa de ahora se da por hecho —se acabó— y
  // el último tramo pasa a ser que ya no está en la cola.
  return [
    ...recorrido.map((stage) =>
      stage.state === "current" ? { ...stage, state: "done" as const } : stage,
    ),
    { key: "archived", label: "Archivada", state: "current" as const },
  ];
}

/**
 * El paso que toca dar ahora, de entre los que ofrece la ficha, para quien puede
 * gestionarlos. Pregunta a la máquina (`canRequestStep`), no al texto del estado.
 *
 * El orden es el del trabajo: primero decidir, luego entregar, y si está
 * suspendida, reanudarla antes de nada —la máquina no deja decidir en espera—.
 * Devuelve `null` cuando no hay ninguno a su alcance; el motivo lo pone la ficha.
 */
export function nextRequestAction(
  status: RequestStatus,
  { canManage }: { canManage: boolean },
): RequestAction | null {
  if (!canManage) return null;
  if (canRequestStep(status, "approve")) return "approve";
  if (canRequestStep(status, "issue")) return "issue";
  if (canRequestStep(status, "resume")) return "resume";
  return null;
}

/**
 * Cómo se lee el paso en la ficha. «Asociar repuesto» no es un paso de la
 * máquina —es lo que hay que hacer antes de aprobar una petición sin líneas—, así
 * que la ficha lo cuenta cuando toca.
 */
export const NEXT_REQUEST_STEP_LABELS: Partial<Record<RequestAction, string>> =
  {
    approve: "Aprobar la petición",
    issue: "Entregar el material al técnico",
    resume: "Reanudar la petición",
  };

/**
 * En qué etapa se da cada paso: la etapa en la que la petición tiene que estar
 * para que el paso exista. Así el motivo se lee junto al paso —y no en un bloque
 * aparte al pie— y bajo la etapa que ese paso desbloquea.
 *
 * Los pasos de la decisión y la espera se dan en «pendiente». Devolver el
 * material, en «entregada», que es justo el paso que la ficha nombra cuando una
 * entrega se quiere deshacer.
 */
const STAGE_OF_STEP: Record<RequestAction, RequestJourneyStageKey> = {
  approve: "pending",
  reject: "pending",
  hold: "pending",
  resume: "pending",
  cancel: "pending",
  requestQuote: "pending",
  receiveMaterial: "pending",
  issue: "approved",
  returnMaterial: "issued",
};

/**
 * Los pasos de la ficha que la máquina no deja dar desde aquí, cada uno con el
 * motivo que da ella y la etapa a la que pertenece, en el orden del recorrido.
 *
 * De las etapas ya pasadas solo se enseñan los pasos que cuentan algo que hacer
 * —«para cancelarla, primero devuélvela»—: repetir «se aprueba lo que espera
 * decisión» en una petición ya entregada no ayuda a nadie.
 */
export function blockedJourneySteps(
  status: RequestStatus,
  {
    heldFrom,
    steps = REQUEST_SHEET_STEPS,
  }: { heldFrom?: RequestStatus; steps?: readonly RequestAction[] } = {},
): BlockedJourneyStep<RequestAction>[] {
  const current = STAGE_ORDER.indexOf(currentStage(status, heldFrom));
  return steps
    .flatMap((action) => {
      const reason = requestStepBlocker(status, action);
      if (reason === null) return [];
      const stage = STAGE_OF_STEP[action];
      const passed = STAGE_ORDER.indexOf(stage) < current;
      if (passed && requestStepExcuse(status, action) === null) return [];
      return [{ stage, action, label: REQUEST_STEP_LABELS[action], reason }];
    })
    .sort(
      (a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage),
    );
}
