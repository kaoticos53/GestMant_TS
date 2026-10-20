/**
 * Las piezas que comparten los recorridos de la incidencia y de la petición de
 * repuesto: dónde está el caso, qué etapa es la de ahora y qué pasos están
 * bloqueados con su motivo.
 *
 * No hay reglas aquí —cada máquina de estados las tiene en su módulo
 * (`incidentJourney`, `requestJourney`)—: esto es solo la forma en la que los dos
 * recorridos se pintan igual, para que la ficha de una incidencia y la de una
 * petición se lean de la misma manera.
 */

/** En qué punto está una etapa: hecha, la de ahora, pendiente o no se pasó. */
export type JourneyStageState = "done" | "current" | "pending" | "skipped";

/** Una etapa del recorrido, ya resuelta para pintarla. */
export interface JourneyStage {
  /** La clave estable de la etapa (para las pruebas y el `key` de React). */
  key: string;
  /** Cómo se llama en este caso: «En espera de repuestos · taller», «Rechazada»… */
  label: string;
  /** En qué punto está. */
  state: JourneyStageState;
}

/** Un paso que desde el estado actual no se puede dar, con su etapa y su motivo. */
export interface BlockedJourneyStep<Action extends string = string> {
  /** La etapa a la que pertenece el paso. */
  stage: string;
  /** El paso, por su nombre en la máquina. */
  action: Action;
  /** El nombre con el que se lee en la ficha. */
  label: string;
  /** El porqué, contado por la máquina de estados. */
  reason: string;
}
