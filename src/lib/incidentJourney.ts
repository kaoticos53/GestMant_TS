/**
 * El recorrido de una incidencia, en cuatro etapas, para leerlo de un vistazo.
 *
 * La ficha ya contaba el paso a paso en «Historial de estados», pero eso está al
 * final de una ficha larga: para saber dónde está el caso y qué toca ahora había
 * que bajar hasta el final. Esto resume lo mismo arriba, sin repetir la regla:
 * las etapas salen de los estados de `lib/incidentFlow` y los nombres de
 * `lib/workshop`, y quién puede dar el siguiente paso lo decide `canAdvanceIncident`
 * —aquí no hay ni una transición escrita a mano—.
 *
 * Son cuatro y no siete a propósito: «en taller», «esperando repuestos» y «en
 * reparación» son el mismo sitio —el equipo está en el taller— y se diferencian
 * en lo que le pasa al caso, que es lo que lleva el nombre de la etapa cuando
 * toca. Lo que el estado no dice es dónde está el equipo: eso lo dice la entrada
 * a taller abierta (`isIncidentInWorkshop`), y por eso entra como dato.
 */

import {
  canAdvanceIncident,
  INCIDENT_SHEET_STEPS,
  INCIDENT_STEP_LABELS,
  incidentStepBlocker,
  isClosedIncident,
  type IncidentAction,
} from "./incidentFlow";
import { INCIDENT_STATUS_META, type IncidentStatus } from "./workshop";
import type {
  BlockedJourneyStep,
  JourneyStage,
  JourneyStageState,
} from "./journey";

// La forma de las etapas y de los motivos es la que comparten los dos recorridos
// (`lib/journey`); lo que hay aquí es solo la máquina de la incidencia.
export type { BlockedJourneyStep, JourneyStage, JourneyStageState };

/** Cuál de las etapas del recorrido. */
export type JourneyStageKey =
  "reported" | "assigned" | "workshop" | "closed" | "archived";

/**
 * Los estados de taller que significan «el equipo está en el taller», con el
 * nombre que se le da al caso en cada uno.
 */
const WORKSHOP_STATUSES: readonly IncidentStatus[] = [
  "workshop",
  "waitingParts",
  "repairing",
];

/** ¿El caso está en la etapa de taller (derivado, esperando o reparándose)? */
export function isWorkshopStage(status: IncidentStatus): boolean {
  return WORKSHOP_STATUSES.some((workshop) => workshop === status);
}

/**
 * El recorrido de un caso: notificada → asignada → en taller → cerrada.
 *
 * `inWorkshop` es lo que el estado no lleva: si el equipo llegó al taller. Un
 * caso cerrado que nunca entró en taller deja esa etapa como «no se pasó» en vez
 * de contarla como hecha, y lo mismo con lo que se quedó sin resolución: no se
 * pinta como un cierre feliz.
 *
 * `archived` añade el último tramo, que no es del flujo sino de su vida: el caso
 * salió de la cola. Es el mismo tramo que lleva la petición de repuesto
 * (`lib/requestJourney`), para que las dos fichas del archivo se lean igual: lo
 * que estaba en su etapa de ahora se da por hecho y el último sitio es el
 * archivo.
 */
export function incidentJourney(
  status: IncidentStatus,
  { inWorkshop, archived = false }: { inWorkshop: boolean; archived?: boolean },
): JourneyStage[] {
  const closed = isClosedIncident(status);
  const inWorkshopStage = isWorkshopStage(status);

  const reported: JourneyStage = {
    key: "reported",
    label: INCIDENT_STATUS_META.reported.label,
    state: status === "reported" ? "current" : "done",
  };

  const assigned: JourneyStage = {
    key: "assigned",
    label: INCIDENT_STATUS_META.assigned.label,
    state:
      status === "reported"
        ? "pending"
        : status === "assigned"
          ? "current"
          : "done",
  };

  // La etapa de taller: es la de ahora mientras el caso esté dentro, y si ya
  // terminó se cuenta solo cuando el equipo llegó a entrar. Se llama «En taller»
  // en todas: lo que le pasa al caso dentro —espera de material, reparación— lo
  // dice la línea de «Ahora», que es donde cabe sin cortarse.
  const workshop: JourneyStage = {
    key: "workshop",
    label: INCIDENT_STATUS_META.workshop.label,
    state: inWorkshopStage
      ? "current"
      : closed
        ? inWorkshop
          ? "done"
          : "skipped"
        : "pending",
  };

  // El final: «Resuelta» mientras el caso siga abierto (es a donde va), y el
  // resultado de verdad cuando ya está cerrado.
  const closedStage: JourneyStage = {
    key: "closed",
    label: closed
      ? INCIDENT_STATUS_META[status].label
      : INCIDENT_STATUS_META.resolved.label,
    state: closed ? "current" : "pending",
  };

  const recorrido = [reported, assigned, workshop, closedStage];
  if (!archived) return recorrido;

  return [
    ...recorrido.map((stage) =>
      stage.state === "current" ? { ...stage, state: "done" as const } : stage,
    ),
    { key: "archived", label: "Archivada", state: "current" as const },
  ];
}

/**
 * El paso que toca dar ahora, de entre los que la ficha ofrece, para quien está
 * mirando. Devuelve `null` cuando no hay ninguno a su alcance —porque el caso
 * está cerrado o porque no le toca a esa persona—; el motivo lo pone la ficha.
 *
 * El orden es el de la ficha: primero coger el caso, luego verificarlo o
 * cerrarlo. Se pregunta a la máquina de estados, no al texto del estado.
 */
export function nextIncidentAction(
  status: IncidentStatus,
  {
    canWork,
    canAssign,
    inWorkshop,
  }: {
    /** La lleva quien mira (técnico asignado o coordinación). */
    canWork: boolean;
    /** Coordina las incidencias: puede asignar a otros. */
    canAssign: boolean;
    /** El equipo está en el taller (entrada abierta). */
    inWorkshop: boolean;
  },
): IncidentAction | null {
  // Coger el caso: lo primero cuando nadie lo ha mirado. Quien coordina lo
  // reparte («asignar»); el técnico se lo queda.
  if (canAssign && canAdvanceIncident(status, "assign")) return "assign";
  if (canWork && canAdvanceIncident(status, "selfAssign")) return "selfAssign";
  // Verificar es el paso que decide el final: resolver, derivar o cerrar sin
  // resolución. Con el equipo en el taller ya no se verifica: se cierra.
  if (canWork && !inWorkshop && canAdvanceIncident(status, "verifyWorkshop")) {
    return "verifyWorkshop";
  }
  if (canWork && inWorkshop && canAdvanceIncident(status, "closeResolved")) {
    return "closeResolved";
  }
  if (canWork && canAdvanceIncident(status, "closeUnresolved")) {
    return "closeUnresolved";
  }
  return null;
}

/**
 * En qué etapa se da cada paso: es la etapa en la que el caso tiene que estar
 * para que el paso exista. «Asignar» se da recién notificada, «verificar» con la
 * incidencia ya asignada y el resto del trabajo con el equipo en el taller. Se
 * usa para enseñar cada motivo pegado al paso que bloquea, sin repetir la lista
 * en un bloque aparte.
 */
const STAGE_OF_STEP: Record<IncidentAction, JourneyStageKey> = {
  assign: "reported",
  selfAssign: "reported",
  verifyOnsite: "assigned",
  verifyWorkshop: "assigned",
  verifyUnresolved: "assigned",
  reassignWorkshop: "workshop",
  waitParts: "workshop",
  partsArrived: "workshop",
  partsSettledOnsite: "workshop",
  partsSettledWorkshop: "workshop",
  closeResolved: "workshop",
  closeUnresolved: "workshop",
};

/** El orden del recorrido: los motivos se enseñan en ese mismo orden. */
const STAGE_ORDER: readonly JourneyStageKey[] = [
  "reported",
  "assigned",
  "workshop",
  "closed",
  "archived",
];

/**
 * Los pasos de la ficha que la máquina no deja dar desde aquí, cada uno con el
 * motivo que da ella y la etapa a la que pertenece: así el porqué se lee junto
 * al paso —y no en un bloque aparte al pie— y en el orden del recorrido.
 *
 * Un paso que sí se puede dar no aparece: esa es la diferencia con la lista de
 * botones, que los enseña todos.
 */
export function blockedJourneySteps(
  status: IncidentStatus,
  steps: readonly IncidentAction[] = INCIDENT_SHEET_STEPS,
): BlockedJourneyStep<IncidentAction>[] {
  return steps
    .flatMap((action) => {
      const reason = incidentStepBlocker(status, action);
      if (reason === null) return [];
      return [
        {
          stage: STAGE_OF_STEP[action],
          action,
          label: INCIDENT_STEP_LABELS[action],
          reason,
        },
      ];
    })
    .sort(
      (a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage),
    );
}

/**
 * Cómo se llama el paso en la ficha. Verificar es uno solo —el diálogo decide
 * luego—, así que aquí se nombra por lo que hace, no por su destino.
 */
export const NEXT_STEP_LABELS: Partial<Record<IncidentAction, string>> = {
  selfAssign: "Autoasignarte la incidencia",
  assign: "Asignarla a un técnico",
  verifyWorkshop: "Verificarla (resolver, derivar o cerrar sin resolución)",
  closeResolved: "Cerrar el trabajo de taller como resuelto",
  closeUnresolved: "Cerrar el trabajo de taller sin resolución",
};
