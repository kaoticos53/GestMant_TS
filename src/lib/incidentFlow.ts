import type { IncidentStatus } from "./workshop";

/**
 * Lo que se puede hacer con una incidencia y desde qué estado: la máquina del
 * ciclo de vida, escrita una sola vez.
 *
 * Antes estaba en dos sitios: los `if` de cada mutación del backend (asignar,
 * autoasignarse, verificar, cerrar, reasignar la orden de taller) y los botones de
 * la ficha, que decidían con el estado a pelo (`status === "reported"`,
 * `status === "assigned" && canWork`, `status === "workshop" && canWork`). Y había
 * además una tercera copia de una sola pregunta —«¿está cerrada?»—, una en
 * `lib/archive` y otra dentro de `incidents.ts`.
 *
 * Lo que no está aquí: quién puede dar cada paso (capacidades, en
 * `lib/permissions` — el coordinador asigna, el técnico asignado verifica) ni lo
 * que se apunta al darlo (historial, correo a quien notificó, ficha de
 * mantenimiento). Esto solo dice **de dónde a dónde**.
 *
 * El dibujo de esta máquina —con quién puede dar cada paso— está en
 * `MAQUINAS.md`, en la raíz, junto a los de la petición y la compra; quien lo
 * lee contra esta tabla es `tests/maquinas.test.ts`, que falla si se separan.
 */

/**
 * Los pasos que mueven una incidencia de un estado a otro.
 *
 * Verificar y cerrar son pasos distintos aunque el resultado se parezca: uno sale
 * de «asignada» —el técnico ha mirado el equipo— y el otro de «en taller» —el
 * trabajo de taller ha terminado—. Nombrarlos por su origen evita el error de
 * cerrar una incidencia que nunca entró en taller.
 */
export type IncidentAction =
  | "assign" // el coordinador pone o cambia el técnico
  | "selfAssign" // el técnico se la queda
  | "verifyOnsite" // verificada y resuelta sin taller
  | "verifyWorkshop" // derivada a taller
  | "verifyUnresolved" // cerrada sin resolución desde la verificación
  | "reassignWorkshop" // cambiar el técnico de la orden de taller
  | "waitParts" // se le abre una petición: queda a la espera de material
  | "partsArrived" // la última petición viva se entregó: a reparar
  | "partsSettledOnsite" // las peticiones se cerraron sin material: vuelve al sitio
  | "partsSettledWorkshop" // las peticiones se cerraron sin material: vuelve al taller
  | "closeResolved" // trabajo terminado: resuelta
  | "closeUnresolved"; // trabajo terminado: sin resolución

/**
 * Un paso: desde qué estados se puede dar y a cuál lleva.
 *
 * `"keptStatus"` es el único destino que no es un estado fijo: cambiar el técnico
 * de taller no mueve el caso —sigue en taller, esperando material o reparándose—,
 * solo cambia quién lo lleva. En qué estado queda lo resuelve
 * `nextIncidentStatus`, que devuelve el de partida.
 */
type IncidentStep = {
  readonly from: readonly IncidentStatus[];
  readonly to: IncidentStatus | "keptStatus";
};

/**
 * La tabla. Tipada con todas las acciones y todos los estados
 * (`IncidentStatus`) a propósito: una acción nueva sin decidir por dónde pasa
 * —o un estado al que nadie llega— no compila. Y ningún paso sale de un estado
 * cerrado: lo resuelto y lo que quedó sin resolución no se reabren desde aquí
 * (volver a por ello es una incidencia nueva, que deja su propio rastro).
 *
 * Se exporta para que la pantalla de «Máquinas del taller» la lea tal cual
 * (`lib/machineSheet`): allí no hay ni una transición escrita a mano.
 */
export const INCIDENT_STEPS = {
  assign: { from: ["reported", "assigned"], to: "assigned" },
  selfAssign: { from: ["reported"], to: "assigned" },
  verifyOnsite: { from: ["assigned", "repairing"], to: "resolved" },
  verifyWorkshop: { from: ["assigned", "repairing"], to: "workshop" },
  verifyUnresolved: { from: ["assigned", "repairing"], to: "unresolved" },
  // Cambiar el técnico de taller no mueve el caso: sigue donde estaba y solo
  // cambia quién lo lleva. Vale con el equipo en taller —derivado, esperando
  // material o ya reparándose—, pero el estado no dice dónde está el equipo: que
  // haya orden abierta lo comprueba quien da el paso (`isIncidentInWorkshop`).
  reassignWorkshop: {
    from: ["workshop", "waitingParts", "repairing"],
    to: "keptStatus",
  },
  // La abre la petición de repuestos (`partRequests.create`), y también vale
  // desde «en reparación»: devolver material deja otra vez la incidencia sin lo
  // que necesita para terminar.
  waitParts: {
    from: ["assigned", "workshop", "repairing"],
    to: "waitingParts",
  },
  // La cierra la entrega del material (`partRequests.markIssued`): la incidencia
  // deja de esperar y el trabajo puede seguir.
  partsArrived: { from: ["waitingParts"], to: "repairing" },
  // Y si las peticiones se cerraron sin servir material —rechazadas, canceladas
  // o devueltas—, la incidencia no se queda esperando lo que ya no va a llegar:
  // vuelve a donde estaba, que es lo que dice su entrada a taller abierta.
  partsSettledOnsite: { from: ["waitingParts"], to: "assigned" },
  partsSettledWorkshop: { from: ["waitingParts"], to: "workshop" },
  closeResolved: { from: ["workshop", "repairing"], to: "resolved" },
  closeUnresolved: { from: ["workshop", "repairing"], to: "unresolved" },
} as const satisfies Record<IncidentAction, IncidentStep>;

/** Los estados en los que la incidencia ya no se mueve. */
const CLOSED_STATUSES: readonly IncidentStatus[] = ["resolved", "unresolved"];

/** ¿Se puede dar este paso desde este estado? */
export function canAdvanceIncident(
  status: IncidentStatus,
  action: IncidentAction,
): boolean {
  return INCIDENT_STEPS[action].from.some((from) => from === status);
}

/**
 * El estado concreto al que lleva un paso, para quien necesite saberlo: cerrar
 * deja la incidencia en «resuelta» o «sin resolución», y no en cualquiera de los
 * cinco estados.
 */
export type IncidentStepStatus<A extends IncidentAction> =
  (typeof INCIDENT_STEPS)[A]["to"];

/**
 * A dónde lleva un paso. No mira dónde está la incidencia: un paso que no se
 * puede dar desde ahí no lleva a ningún sitio, y eso se pregunta aparte con
 * `canAdvanceIncident`. Aquí solo está escrito a dónde va cada uno.
 *
 * Los pasos que no mueven el caso —cambiar el técnico de taller— devuelven
 * `"keptStatus"` en vez de un estado: para saber en cuál queda hay que decir
 * desde cuál se da, y eso lo hace `nextIncidentStatus`.
 */
export function incidentStepStatus<A extends IncidentAction>(
  action: A,
): IncidentStepStatus<A> {
  return INCIDENT_STEPS[action].to;
}

/**
 * El estado en el que queda la incidencia al dar un paso, o `null` si ese paso no
 * se puede dar desde donde está. Es la cuenta que no vale para un solo estado: un
 * cierre deja el suyo, y cambiar el técnico de taller deja el caso donde estaba.
 *
 * El backend la usa donde el destino no se puede escribir de antemano —el cierre
 * de taller lo elige el sitio del equipo (`incidentCloseStep`)—, y las pruebas la
 * usan para comprobar que el documento y la ficha dicen lo mismo que la máquina.
 */
export function nextIncidentStatus(
  status: IncidentStatus,
  action: IncidentAction,
): IncidentStatus | null {
  if (!canAdvanceIncident(status, action)) return null;
  const to = INCIDENT_STEPS[action].to;
  return to === "keptStatus" ? status : to;
}

/**
 * ¿Está cerrada? El archivo es solo para lo ya terminado: lo resuelto y lo que
 * quedó sin resolución. Es la misma pregunta que hace el panel para ofrecer
 * «Archivar», y la que hace la pasada de la noche para saber qué se lleva.
 *
 * Acepta cualquier texto a propósito: quien pregunta por ella a veces solo tiene
 * una fila ligera del archivo (`ArchivableIncident`), no una incidencia entera. Lo
 * que no es un estado del taller no está cerrado.
 */
export function isClosedIncident(status: string): boolean {
  return CLOSED_STATUSES.some((closed) => closed === status);
}

/** Los estados en los que la incidencia ya es de alguien y sigue abierta. */
const IN_PROGRESS_STATUSES: readonly IncidentStatus[] = [
  "assigned",
  "workshop",
  "waitingParts",
  "repairing",
];

/**
 * ¿Está en curso? El trabajo ha empezado —tiene técnico, o técnico de taller— y
 * todavía no ha terminado: es «asignada» o «en taller», no otra cosa.
 *
 * Ni lo recién notificado —todavía no es de nadie, no ha empezado— ni lo cerrado
 * cuentan. Es la pregunta del aviso de trabajo sin constancia, que mide los días
 * desde que alguien la cogió; estaba escrita dentro de `lib/workshop` con el
 * estado a pelo, y vive aquí con el resto de la máquina.
 */
export function isIncidentInProgress(status: string): boolean {
  return IN_PROGRESS_STATUSES.some((inProgress) => inProgress === status);
}

/** ¿Está la incidencia esperando el material de una petición? */
export function isIncidentWaitingParts(status: string): boolean {
  return status === "waitingParts";
}

/** ¿Ya está el material en manos del técnico, en reparación? */
export function isIncidentRepairing(status: string): boolean {
  return status === "repairing";
}

/**
 * ¿El equipo está en el taller? Lo dicen la propia entrada a taller y su
 * responsable: la incidencia derivada está en taller por definición, y una que
 * espera repuestos o se está reparando lo está si conserva esa entrada abierta.
 *
 * Es la mitad de la respuesta que el estado no lleva: «en espera de repuestos»
 * dice qué le pasa al caso, no dónde está el equipo. Preguntarlo aquí evita que
 * el backend y la ficha lo averigüen cada uno a su manera.
 */
export function isIncidentInWorkshop(incident: {
  status: IncidentStatus;
  workshopAssigneeId?: unknown;
  workshopAssigneeName?: string;
}): boolean {
  return (
    incident.status === "workshop" ||
    Boolean(incident.workshopAssigneeId) ||
    Boolean(incident.workshopAssigneeName?.trim())
  );
}

/**
 * El paso de cierre que corresponde al sitio donde está el equipo: el trabajo de
 * taller se cierra desde la orden de taller y el que se hace en el sitio, desde
 * la verificación. La tabla deja los dos caminos abiertos desde «en reparación»
 * porque el estado no sabe dónde está el equipo; esta es la pregunta que lo
 * decide, escrita una vez.
 */
export function incidentCloseStep(
  outcome: "resolved" | "unresolved",
  inWorkshop: boolean,
): IncidentAction {
  if (outcome === "resolved")
    return inWorkshop ? "closeResolved" : "verifyOnsite";
  return inWorkshop ? "closeUnresolved" : "verifyUnresolved";
}

/**
 * ¿Este usuario puede cambiar el técnico de la orden de taller? Son las tres
 * preguntas que hace el backend antes de tocar nada, contadas para que la ficha
 * ofrezca el botón a quien de verdad puede darlo: el paso tiene que caber desde
 * el estado, la orden tiene que estar abierta —el estado no dice dónde está el
 * equipo—, y o se coordina o se es el técnico que la lleva.
 *
 * El técnico de taller entra por la última: siempre ha podido reasignarse la
 * orden desde el servidor (`assignWorkshop`), pero la ficha se la escondía.
 */
export function canChangeWorkshopTechnician(
  incident: { status: IncidentStatus; workshopAssigneeId?: unknown },
  actor: { id: string | null; coordinates: boolean },
): boolean {
  if (!canAdvanceIncident(incident.status, "reassignWorkshop")) return false;
  if (!isIncidentInWorkshop(incident)) return false;
  return (
    actor.coordinates ||
    (actor.id !== null && incident.workshopAssigneeId === actor.id)
  );
}

/**
 * A dónde vuelve una incidencia que esperaba repuestos cuando las peticiones se
 * cierran sin servir material: al taller si la entrada sigue abierta, y si no, a
 * la asignación de la que salió. Sin esto, cancelar la última petición dejaría
 * el caso esperando un material que ya no va a llegar.
 */
export function incidentWithoutPartsStep(
  inWorkshop: boolean,
): "partsSettledWorkshop" | "partsSettledOnsite" {
  return inWorkshop ? "partsSettledWorkshop" : "partsSettledOnsite";
}

/**
 * ¿Se le puede abrir una petición de repuestos? Mientras la incidencia se está
 * trabajando —asignada, en taller, esperando material o ya reparándose—, porque
 * es justo cuando se descubre que falta una pieza. Ni recién notificada —no la
 * ha mirado nadie— ni cerrada.
 */
export function incidentTakesPartRequests(status: IncidentStatus): boolean {
  return (
    canAdvanceIncident(status, "waitParts") ||
    canAdvanceIncident(status, "partsArrived")
  );
}

/* ------------------------------------------------------------------ */
/* Por qué no se puede dar un paso                                     */
/* ------------------------------------------------------------------ */

/** El nombre corto de cada paso, para poder explicarlo cuando no se puede dar. */
export const INCIDENT_STEP_LABELS: Record<IncidentAction, string> = {
  assign: "Asignar a un técnico",
  selfAssign: "Autoasignarme",
  verifyOnsite: "Verificar y resolver en el sitio",
  verifyWorkshop: "Verificar y derivar a taller",
  verifyUnresolved: "Verificar y cerrar sin resolución",
  reassignWorkshop: "Cambiar el técnico de taller",
  waitParts: "Quedar a la espera de repuestos",
  partsArrived: "Repuestos entregados",
  partsSettledOnsite: "Cerrar la espera sin material (en el sitio)",
  partsSettledWorkshop: "Cerrar la espera sin material (en taller)",
  closeResolved: "Cerrar como resuelta",
  closeUnresolved: "Cerrar sin resolución",
};

/**
 * Los pasos que la ficha de la incidencia enseña, en su orden. Son los que tienen
 * botón ahí: verificar es uno solo —la ficha decide luego resolver, derivar a
 * taller o cerrar sin resolución— y el trabajo de taller se cierra desde el
 * mismo sitio.
 */
export const INCIDENT_SHEET_STEPS: readonly IncidentAction[] = [
  "selfAssign",
  "assign",
  "verifyWorkshop",
  "reassignWorkshop",
  "closeResolved",
];

/** Un mismo motivo para todos los pasos: lo que ya está terminado. */
const CLOSED_REASON = "ya está cerrada: no se reabre desde aquí";

/** Qué necesita cada paso, cuando no hay un motivo más concreto que contar. */
const INCIDENT_STEP_NEEDS: Record<IncidentAction, string> = {
  assign: "se asigna mientras está notificada o ya asignada",
  selfAssign: "se la queda quien la ve notificada",
  verifyOnsite: "se verifica una incidencia asignada o en reparación",
  verifyWorkshop: "se verifica una incidencia asignada o en reparación",
  verifyUnresolved: "se verifica una incidencia asignada o en reparación",
  reassignWorkshop:
    "la orden de taller se cambia con el equipo en el taller: derivado, esperando material o reparándose",
  waitParts: "se espera material en una incidencia que se está trabajando",
  partsArrived: "se da por entregado lo que se estaba esperando",
  partsSettledOnsite: "se cierra una espera que se quedó sin material",
  partsSettledWorkshop: "se cierra una espera que se quedó sin material",
  closeResolved: "se cierra un trabajo terminado",
  closeUnresolved: "se cierra un trabajo terminado",
};

/**
 * Los motivos que sí cuentan algo que hacer, que son los que la ficha necesita
 * decir: «todavía no la ha cogido nadie», «primero verifícala».
 */
const INCIDENT_STEP_EXCUSES: Partial<
  Record<IncidentAction, Partial<Record<IncidentStatus, string>>>
> = {
  selfAssign: {
    assigned: "ya tiene técnico: se cambia desde «Asignar a un técnico»",
    workshop: "está en taller: la lleva el técnico de taller",
    waitingParts: "ya está en marcha: la lleva el técnico asignado",
    repairing: "ya está en marcha: la lleva el técnico asignado",
  },
  waitParts: {
    reported:
      "todavía no la ha cogido nadie: primero alguien tiene que mirarla",
  },
  assign: {
    workshop: "está en taller: su técnico se cambia desde la orden de taller",
    waitingParts:
      "está esperando repuestos: su técnico se cambia desde la ficha, no volviendo a asignarla",
    repairing: "está en reparación: no se vuelve a asignar desde cero",
  },
  verifyOnsite: {
    reported:
      "todavía no la ha cogido nadie: asígnala (o autoasígnatela) antes de verificarla",
    workshop: "ya está en taller: el trabajo se cierra desde ahí",
    waitingParts:
      "está esperando repuestos: primero tiene que llegar el material",
  },
  verifyWorkshop: {
    reported:
      "todavía no la ha cogido nadie: asígnala (o autoasígnatela) antes de verificarla",
    workshop:
      "ya está en taller: se cierra desde ahí cuando el trabajo termine",
    waitingParts:
      "está esperando repuestos: primero tiene que llegar el material",
  },
  verifyUnresolved: {
    reported:
      "todavía no la ha cogido nadie: asígnala (o autoasígnatela) antes de verificarla",
    workshop:
      "ya está en taller: se cierra desde ahí cuando el trabajo termine",
    waitingParts:
      "está esperando repuestos: primero tiene que llegar el material",
  },
  closeResolved: {
    reported: "está recién notificada: primero alguien tiene que mirarla",
    assigned: "primero verifícala: no se cierra lo que no se ha verificado",
    waitingParts:
      "está esperando repuestos: primero tiene que llegar el material",
  },
  closeUnresolved: {
    reported: "está recién notificada: primero alguien tiene que mirarla",
    assigned: "primero verifícala: no se cierra lo que no se ha verificado",
    waitingParts:
      "está esperando repuestos: primero tiene que llegar el material",
  },
};

/**
 * Por qué no se puede dar este paso desde aquí, o `null` si sí se puede. Es la
 * misma regla que consulta el servidor (`canAdvanceIncident`) contada para que la
 * lea una persona: la ficha la enseña en vez de esconder el botón sin más.
 */
export function incidentStepBlocker(
  status: IncidentStatus,
  action: IncidentAction,
): string | null {
  if (canAdvanceIncident(status, action)) return null;
  if (isClosedIncident(status)) return CLOSED_REASON;
  return INCIDENT_STEP_EXCUSES[action]?.[status] ?? INCIDENT_STEP_NEEDS[action];
}

/**
 * Los pasos que no se pueden dar desde aquí, agrupados por motivo: una incidencia
 * cerrada los explica todos con la misma frase, y se dice una vez.
 */
export function blockedIncidentSteps(
  status: IncidentStatus,
  steps: readonly IncidentAction[] = INCIDENT_SHEET_STEPS,
): { reason: string; actions: IncidentAction[] }[] {
  const groups: { reason: string; actions: IncidentAction[] }[] = [];
  for (const action of steps) {
    const reason = incidentStepBlocker(status, action);
    if (reason === null) continue;
    const already = groups.find((group) => group.reason === reason);
    if (already) already.actions.push(action);
    else groups.push({ reason, actions: [action] });
  }
  return groups;
}
