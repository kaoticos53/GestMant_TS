import { CONTENEDOR, ETIQUETA, SECCION } from "../constants";
import { useLandingStatsSummary } from "../hooks/useLandingStatsSummary";

/**
 * Sección '#taller' con estadísticas cuantitativas públicas agregadas del último mes.
 * Solo se muestra en escritorio (`hidden lg:block`).
 */
export function LandingStatsSection() {
  const { figuras, updateSubtitle, showMinSampleNotice, minClosedForMean } =
    useLandingStatsSummary();

  return (
    <section
      id="taller"
      className={`hidden scroll-mt-20 border-y border-border/60 bg-muted/20 lg:block ${SECCION}`}
    >
      <div className={CONTENEDOR}>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className={ETIQUETA}>El taller en cifras</span>
            <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
              Un mes de trabajo, en cuatro números
            </h2>
          </div>
          <div className="max-w-sm">
            <p className="text-xs leading-relaxed text-muted-foreground">
              {updateSubtitle}
            </p>
            {showMinSampleNotice && (
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                La media de resolución se publica a partir de{" "}
                {minClosedForMean} incidencias cerradas.
              </p>
            )}
          </div>
        </div>

        <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-8 sm:mt-10 sm:grid-cols-4 sm:gap-x-0">
          {figuras.map((cifra, indice) => (
            <div
              key={cifra.label}
              className={`flex flex-col-reverse ${
                indice === 0
                  ? "sm:border-l-0 sm:pl-0"
                  : "sm:border-l sm:border-border/60 sm:pl-6"
              }`}
            >
              <dt className="mt-1.5 text-xs leading-snug text-muted-foreground">
                {cifra.label}
              </dt>
              <dd className="text-3xl font-extrabold tabular-nums tracking-tight text-foreground sm:text-4xl">
                {cifra.valor}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
