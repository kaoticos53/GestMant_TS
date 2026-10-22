import {
  JourneyBlockedSteps,
  JourneyNowNextStatus,
  JourneyStagesList,
  groupBlockedByStage,
  type JourneySummaryProps,
} from "./journeySummary/index";

/**
 * El recorrido de un caso, en la cabecera de su ficha: dónde está y qué toca
 * ahora, sin bajar hasta el historial.
 *
 * Las etapas llegan ya resueltas desde la máquina que toque (`lib/incidentJourney`
 * o `lib/requestJourney`), con la de ahora marcada y las que no se pasaron en
 * punteado: un caso cerrado en el sitio no finge haber estado en taller. Debajo,
 * el estado tal y como se cuenta en la ficha y el paso que toca; si no hay
 * ninguno al alcance de quien mira, se dice por qué.
 *
 * Los pasos que la máquina no deja dar no viven en un bloque aparte al pie: cada
 * uno aparece bajo su etapa, con su motivo al lado, para que se lea «no puedo
 * verificarla porque todavía no la ha cogido nadie» en el mismo sitio donde se ve
 * que la etapa de verificar es la siguiente.
 *
 * Es el mismo componente para la incidencia y para la petición de repuesto: si
 * una ficha explica su recorrido de una manera y la otra de otra, la comparación
 * se pierde.
 */
export function JourneySummary({
  label,
  stages,
  nowLabel,
  nextLabel,
  nextHint,
  blocked,
}: JourneySummaryProps) {
  const current = stages.findIndex((stage) => stage.state === "current");
  const blockedByStage = groupBlockedByStage(stages, blocked);

  return (
    <section
      aria-label={label}
      className="rounded-lg border border-border/80 bg-muted/20 p-3"
    >
      <JourneyStagesList stages={stages} />
      <JourneyNowNextStatus
        current={current}
        totalStages={stages.length}
        nowLabel={nowLabel}
        nextLabel={nextLabel}
        nextHint={nextHint}
      />
      <JourneyBlockedSteps blockedByStage={blockedByStage} />
    </section>
  );
}
