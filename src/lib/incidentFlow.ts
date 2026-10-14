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
  | "closeResolved" // trabajo en taller terminado: resuelta
  | "closeUnresolved"; // trabajo en taller terminado: sin resolución

/** Un paso: desde qué estados se puede dar y a cuál lleva. */
type IncidentStep = {
  readonly from: readonly IncidentStatus[];
  readonly to: IncidentStatus;
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
  verifyOnsite: { from: ["assigned"], to: "resolved" },
  verifyWorkshop: { from: ["assigned"], to: "workshop" },
  verifyUnresolved: { from: ["assigned"], to: "unresolved" },
  reassignWorkshop: { from: ["workshop"], to: "workshop" },
  closeResolved: { from: ["workshop"], to: "resolved" },
  closeUnresolved: { from: ["workshop"], to: "unresolved" },
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
 */
export function incidentStepStatus<A extends IncidentAction>(
  action: A,
): IncidentStepStatus<A> {
  return INCIDENT_STEPS[action].to;
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
  verifyOnsite: "se verifica una incidencia asignada",
  verifyWorkshop: "se verifica una incidencia asignada",
  verifyUnresolved: "se verifica una incidencia asignada",
  reassignWorkshop: "la orden de taller se cambia mientras está en taller",
  closeResolved: "se cierra una incidencia que está en taller",
  closeUnresolved: "se cierra una incidencia que está en taller",
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
  },
  assign: {
    workshop: "está en taller: su técnico se cambia desde la orden de taller",
  },
  verifyOnsite: {
    reported:
      "todavía no la ha cogido nadie: asígnala (o autoasígnatela) antes de verificarla",
    workshop: "ya está en taller: el trabajo se cierra desde ahí",
  },
  verifyWorkshop: {
    reported:
      "todavía no la ha cogido nadie: asígnala (o autoasígnatela) antes de verificarla",
    workshop:
      "ya está en taller: se cierra desde ahí cuando el trabajo termine",
  },
  verifyUnresolved: {
    reported:
      "todavía no la ha cogido nadie: asígnala (o autoasígnatela) antes de verificarla",
    workshop:
      "ya está en taller: se cierra desde ahí cuando el trabajo termine",
  },
  closeResolved: {
    reported: "está recién notificada: primero alguien tiene que mirarla",
    assigned: "primero verifícala: no se cierra lo que no se ha verificado",
  },
  closeUnresolved: {
    reported: "está recién notificada: primero alguien tiene que mirarla",
    assigned: "primero verifícala: no se cierra lo que no se ha verificado",
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
