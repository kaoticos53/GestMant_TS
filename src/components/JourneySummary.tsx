import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { Check, CircleDot, Minus } from "lucide-react";

import type { BlockedJourneyStep, JourneyStage } from "@/lib/journey";

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
}: {
  /** Cómo se anuncia el bloque para lectores de pantalla. */
  label: string;
  /** Las etapas, en orden, ya resueltas por la máquina del caso. */
  stages: JourneyStage[];
  /** El estado tal y como se cuenta en la ficha. */
  nowLabel: string;
  /** El paso que toca, si quien mira puede darlo. */
  nextLabel: string | null;
  /** Qué pasa cuando no hay paso: cerrada, no te toca, esperando material. */
  nextHint: string;
  /** Los pasos que la máquina no deja dar, con la etapa a la que pertenecen. */
  blocked: readonly BlockedJourneyStep[];
}) {
  const current = stages.findIndex((stage) => stage.state === "current");
  // Los motivos, agrupados por etapa y en el orden del recorrido: la etapa se
  // escribe una vez aunque bloquee dos pasos.
  const blockedByStage = stages
    .map((stage, index) => ({
      stage,
      index,
      steps: blocked.filter((step) => step.stage === stage.key),
    }))
    .filter((group) => group.steps.length > 0);

  return (
    <section
      aria-label={label}
      className="rounded-xl border border-border/70 bg-card p-3 shadow-sm"
    >
      <ol className="flex items-start gap-1.5">
        {stages.map((stage, index) => (
          <li
            key={stage.key}
            aria-current={stage.state === "current" ? "step" : undefined}
            className="flex min-w-0 flex-1 items-start gap-1.5 last:flex-none"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <StageDot state={stage.state} index={index} />
                <span
                  className={cn(
                    "line-clamp-2 text-[11px] font-medium leading-tight sm:text-xs",
                    stage.state === "current"
                      ? "text-signal"
                      : stage.state === "done"
                        ? "text-foreground"
                        : "text-muted-foreground",
                    stage.state === "skipped" && "text-muted-foreground/70",
                  )}
                  title={stage.label}
                >
                  {stage.label}
                </span>
              </div>
              <span className="sr-only">
                {stage.state === "current"
                  ? "Etapa actual"
                  : stage.state === "done"
                    ? "Etapa completada"
                    : stage.state === "skipped"
                      ? "Etapa que no se pasó"
                      : "Etapa pendiente"}
              </span>
            </div>
            {index < stages.length - 1 && (
              <span
                aria-hidden="true"
                className={cn(
                  // En el móvil no hay sitio para la línea: se quita y cada
                  // etapa se queda con el ancho que necesita su nombre.
                  "mt-2 hidden h-px w-5 shrink-0 sm:block",
                  stages[index + 1].state === "pending" ||
                    stages[index + 1].state === "skipped"
                    ? "bg-border"
                    : "bg-signal/40",
                )}
              />
            )}
          </li>
        ))}
      </ol>

      <p className="mt-2.5 flex flex-wrap items-baseline gap-x-1.5 text-sm">
        <span className="text-muted-foreground">
          Ahora
          {current >= 0 ? ` (paso ${current + 1} de ${stages.length})` : ""}:
        </span>
        <span className="font-medium">{nowLabel}</span>
      </p>
      <p className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 text-sm">
        <span className="text-muted-foreground">Siguiente:</span>
        {nextLabel !== null ? (
          <span className="font-medium text-signal">{nextLabel}</span>
        ) : (
          <span className="text-muted-foreground">{nextHint}</span>
        )}
      </p>

      {/* Cada motivo, junto a la etapa del paso que bloquea: la etapa hace de
          encabezado y el paso lleva su porqué al lado, sin lista aparte. */}
      {blockedByStage.length > 0 && (
        <div className="mt-2.5 border-t border-border/60 pt-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Aún no se puede
          </p>
          <dl className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-2 gap-y-1 text-xs leading-5">
            {blockedByStage.map((group) => (
              <Fragment key={group.stage.key}>
                <dt className="flex items-baseline gap-1.5 text-muted-foreground">
                  <StageDot state={group.stage.state} index={group.index} />
                  <span className="whitespace-nowrap">{group.stage.label}</span>
                </dt>
                <dd>
                  <ul className="space-y-0.5">
                    {group.steps.map((step) => (
                      <li key={step.action}>
                        <span className="font-medium text-foreground/80">
                          {step.label}
                        </span>{" "}
                        <span className="text-muted-foreground">
                          — {step.reason}.
                        </span>
                      </li>
                    ))}
                  </ul>
                </dd>
              </Fragment>
            ))}
          </dl>
        </div>
      )}
    </section>
  );
}

/** El punto de cada etapa: hecho, ahora, pendiente o no se pasó. */
function StageDot({
  state,
  index,
}: {
  state: JourneyStage["state"];
  index: number;
}) {
  const base =
    "flex size-4 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold leading-none";
  if (state === "done") {
    return (
      <span className={cn(base, "border-signal/40 bg-signal/15 text-signal")}>
        <Check className="size-2.5" aria-hidden="true" />
      </span>
    );
  }
  if (state === "current") {
    return (
      <span
        className={cn(base, "border-signal bg-signal text-primary-foreground")}
      >
        <CircleDot className="size-2.5" aria-hidden="true" />
      </span>
    );
  }
  if (state === "skipped") {
    return (
      <span
        className={cn(
          base,
          "border-dashed border-border bg-transparent text-muted-foreground/70",
        )}
      >
        <Minus className="size-2.5" aria-hidden="true" />
      </span>
    );
  }
  return (
    <span className={cn(base, "border-border bg-muted text-muted-foreground")}>
      {index + 1}
    </span>
  );
}
