import { useState } from "react";
import logo from "@/assets/logo.svg";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { ChangelogDialog } from "@/components/changelog/ChangelogDialog";
import { ArrowRight, CheckCircle2, Search, Siren } from "lucide-react";
import { Link } from "react-router";
import { FULL_VERSION, DETAILED_VERSION } from "@/version";
import { IncidentLookup } from "./dashboard/IncidentLookup";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatRelativeTime } from "@/lib/workshop";
import {
  MEAN_WINDOW_DAYS,
  MIN_CLOSED_FOR_MEAN,
  formatCount,
  formatMinutes,
} from "@/lib/workshopStats";

/**
 * La portada, con un solo sistema visual.
 *
 * Antes cada bloque se había hecho a su aire —tres radios de esquina distintos,
 * sombras de tres tamaños, títulos de dos escalas y etiquetas con cuatro
 * recetas—, y la página se leía como una suma de piezas. Aquí las piezas siguen
 * siendo las mismas —el aviso público, el seguimiento por código, el panel—, pero
 * salen de cinco constantes que se declaran una vez:
 *
 * - `CONTENEDOR`: el ancho y los márgenes laterales de todo.
 * - `SECCION`: el aire vertical de un bloque de contenido (48 / 56 / 80).
 * - `TEXTO`: la escala tipográfica del texto de sección.
 * - `TARJETA`: la receta de tarjeta, con su borde, su radio y su sombra.
 * - `CTA`: el botón principal —el del titular y el del aviso—, con su color de
 *   texto resuelto por el tema.
 *
 * El ritmo vertical vive en las **secciones**, no en sus contenedores: cada
 * bloque trae su propio relleno, así que lo que separa dos bloques es siempre
 * «lo que respira uno por abajo más lo que respira el siguiente por arriba», y
 * eso es exactamente lo que mide `tests/landingRitmo.test.tsx`. Los bloques se
 * separan 96 px en móvil, 112 en tableta y 160 en escritorio, y las dos puertas
 * del taller cuentan como uno solo: son una tarjeta con dos mitades.
 *
 * Las cifras del taller son las de verdad, pero no se cuentan desde aquí: quien
 * abre la portada no tiene sesión y no debe poder recorrer las tablas del
 * taller. Lee la foto que el backend toma cada cuarto de hora
 * (`convex/publicStats`), que solo guarda agregados —ni nombres, ni
 * referencias, ni ubicaciones— y que dice cuándo se tomó. Por eso la banda
 * enseña la hora del último recuento y, cuando aún no hay muestra bastante para
 * publicar una media sin señalar un caso, un guion con su motivo.
 */

/* ------------------------------------------------------------------ */
/* El sistema visual, declarado una vez                               */
/* ------------------------------------------------------------------ */

const CONTENEDOR = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8";

/** El aire de un bloque de contenido, igual en todas las secciones. */
const SECCION = "py-12 sm:py-14 lg:py-20";

const TEXTO = "text-sm leading-relaxed text-muted-foreground sm:text-base";

const TARJETA = "rounded-2xl border border-border/70 bg-card shadow-xs"; // El texto del CTA sale de `primary-foreground`, no de un blanco fijo: el color
// de señal es oscuro en el tema claro y claro en el oscuro, y un blanco escrito a
// mano se queda sin contraste justo en el segundo.
const CTA =
  "bg-signal text-primary-foreground hover:bg-signal/90 font-semibold shadow-sm gap-2";

/** El chip de icono que comparten el aviso y el seguimiento. */
const CHIP =
  "flex size-9 shrink-0 items-center justify-center rounded-lg border border-signal/20 bg-signal/10 text-signal";

const ETIQUETA =
  "inline-flex items-center gap-2 rounded-full border border-signal/30 bg-signal/10 px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-signal";

/* ------------------------------------------------------------------ */
/* El contenido editorial                                             */
/* ------------------------------------------------------------------ */

/** El rótulo pequeño de una ficha: el mismo en el aviso y en la consulta. */
const ROTULO =
  "font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-signal";

/** Los tres pasos del aviso, en el mismo orden en que ocurren. */
const PASOS = [
  {
    numero: "01",
    titulo: "Avisas del equipo",
    texto:
      "Plató, cámara, intercom o sala de sonido: cuentas qué falla en un minuto.",
  },
  {
    numero: "02",
    titulo: "Recibes un código",
    texto:
      "Ocho caracteres para seguir el aviso sin crear cuenta ni contraseña.",
  },
  {
    numero: "03",
    titulo: "El taller responde",
    texto:
      "La incidencia entra en cola con su prioridad y un técnico asignado.",
  },
];

export default function Landing() {
  const [showChangelog, setShowChangelog] = useState(false);
  const { isLoading, isAuthenticated } = useAuth();
  const signedIn = isAuthenticated && !isLoading;
  // La foto pública del taller. Puede faltar —consulta en camino, o instalación
  // en la que el cron aún no ha pasado— y entonces la banda enseña guiones.
  const cifras = useQuery(api.publicStats.summary);

  // Las cuatro casillas de la banda. Con la foto todavía en camino —o sin ella—
  // el guion es la respuesta honesta: no es lo mismo un taller vacío que uno sin
  // contar.
  const figuras = [
    {
      valor: cifras ? formatCount(cifras.equipment) : "—",
      label: "Equipos en servicio",
    },
    {
      valor: cifras ? formatCount(cifras.spareParts) : "—",
      label: "Repuestos en catálogo",
    },
    {
      valor: cifras ? formatCount(cifras.openIncidents) : "—",
      label: "Incidencias abiertas",
    },
    {
      valor:
        cifras?.meanResolutionMinutes == null
          ? "—"
          : formatMinutes(cifras.meanResolutionMinutes),
      label: "Tiempo medio de resolución",
    },
  ];

  return (
    <div
      id="inicio"
      className="min-h-screen bg-background bg-tech-grid text-foreground antialiased selection:bg-signal/20 selection:text-signal"
    >
      {/* ---------------------------------------------------------------- */}
      {/* Cabecera: la marca y el acceso de los técnicos                    */}
      {/* ---------------------------------------------------------------- */}
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur-md">
        <div className={CONTENEDOR}>
          <div className="flex h-16 items-center justify-between gap-4">
            <a
              href="#inicio"
              className="group flex items-center gap-3 transition-opacity hover:opacity-95"
            >
              <img
                src={logo}
                alt="Pulso Taller"
                className="size-9 rounded-lg shadow-sm ring-1 ring-border transition-transform group-hover:scale-105"
              />
              <div className="flex flex-col">
                <span className="flex items-center gap-2 text-sm font-bold tracking-tight text-foreground">
                  Pulso Taller
                  <span className="hidden font-mono text-[10px] font-normal uppercase tracking-[0.14em] text-signal sm:inline-block">
                    Broadcast TV
                  </span>
                </span>
                <span className="hidden text-[11px] text-muted-foreground sm:block">
                  Mantenimiento de Televisión
                </span>
              </div>
            </a>

            <div className="flex items-center gap-2">
              {signedIn ? (
                <Button asChild size="sm" variant="outline" className="gap-1.5">
                  <Link to="/dashboard">
                    <span>Ir al panel</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              ) : (
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  <Link to="/auth">Acceso técnicos</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------------------- */}
      {/* Hero: la promesa del taller y la consola que la demuestra         */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative overflow-hidden border-b border-border/60 pb-12 pt-10 sm:pb-14 sm:pt-16 lg:pb-20 lg:pt-20">
        <div
          aria-hidden
          className="glow-signal pointer-events-none absolute -top-40 right-[-10%] h-[40rem] w-[40rem] rounded-full opacity-60"
        />

        <div className={`relative ${CONTENEDOR}`}>
          <div className="grid gap-12 lg:grid-cols-12 lg:items-center lg:gap-10">
            {/* Columna izquierda: qué es, para quién y por dónde se entra */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="lg:col-span-7"
            >
              <span className={ETIQUETA}>
                <span className="size-1.5 animate-pulse rounded-full bg-signal" />
                Plataforma del taller
              </span>

              <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-balance text-foreground sm:text-5xl lg:text-[3.75rem] lg:leading-[1.05]">
                Mantenimiento <span className="text-signal">TV</span>.
              </h1>

              <p className={`mt-5 max-w-xl ${TEXTO} sm:text-lg`}>
                Incidencias, equipos, peticiones de repuesto y partes de trabajo
                en un mismo panel. Del aviso del plató al parte cerrado, sin
                hojas de cálculo.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
                <Button
                  asChild
                  size="lg"
                  className={`w-full px-6 sm:w-auto ${CTA}`}
                >
                  <Link to="/reportar">
                    <Siren className="size-4.5" />
                    <span>Notificar incidencia</span>
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="w-full px-6 sm:w-auto"
                >
                  <a href="#seguimiento">
                    <Search className="mr-1.5 size-4" />
                    Seguimiento de incidencia
                  </a>
                </Button>
              </div>

              {/* Lo que la consola de al lado enseña de cerca, en una línea: en
                  un móvil la maqueta no cabe junto al titular. Va con las
                  cifras de verdad, no con una muestra: al lado de la banda de
                  abajo, un número inventado aquí se leería como el del taller. */}
              <div
                data-testid="resumen-movil"
                className={`mt-8 flex flex-col gap-1.5 px-4 py-3 text-xs lg:hidden ${TARJETA}`}
              >
                {cifras ? (
                  <>
                    <span className="flex items-center gap-2">
                      <span className="size-2 shrink-0 rounded-full bg-signal" />
                      <span className="font-semibold text-foreground">
                        {formatCount(cifras.openIncidents)} incidencias abiertas
                      </span>
                    </span>
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" />
                      <span>
                        {formatCount(cifras.equipment)} equipos en servicio
                      </span>
                    </span>
                  </>
                ) : (
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span className="size-2 shrink-0 animate-pulse rounded-full bg-muted-foreground/50" />
                    Consultando el taller…
                  </span>
                )}
              </div>
            </motion.div>

            {/* Columna derecha: la consola. Es una maqueta de lo que se ve en
                el panel, no el panel: por debajo de `lg` no cabe con el titular
                y estorba, así que solo aparece cuando hay dos columnas. */}
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
              data-testid="consola-tecnica"
              className="hidden lg:col-span-5 lg:block"
            >
              <div className="rounded-2xl border border-border/70 bg-card/95 p-1 shadow-lg backdrop-blur-xl">
                <div className="flex items-center justify-between rounded-t-xl border-b border-border/70 bg-muted/40 px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex gap-1.5">
                      <span className="size-2.5 rounded-full bg-destructive/80" />
                      <span className="size-2.5 rounded-full bg-amber-500/80" />
                      <span className="size-2.5 rounded-full bg-emerald-500/80" />
                    </div>
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Monitor técnico · Muestra
                    </span>
                  </div>
                  <Badge
                    variant="destructive"
                    className="gap-1.5 font-mono text-[10px] tracking-wider"
                  >
                    <span className="size-1.5 animate-pulse rounded-full bg-white" />
                    ON AIR
                  </Badge>
                </div>

                <div className="space-y-2.5 p-3">
                  {/* La incidencia que hay ahora mismo en el taller */}
                  <div className="rounded-xl border border-border/70 bg-background/80 p-3.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="inline-flex items-center gap-1.5 font-mono font-bold text-signal">
                        <Siren className="size-3.5" />
                        INC-0128
                      </span>
                      <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                        Prioridad alta
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      Pérdida de sincronismo SDI en Cadena 2
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Equipo: Cámara de estudio HDC-3500 · Plató Principal
                    </p>
                    <div className="mt-2.5 flex items-center justify-between border-t border-border/50 pt-2 text-[11px] text-muted-foreground">
                      <span>Técnico: A. Morales (guardia)</span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400">
                        En taller
                      </span>
                    </div>
                  </div>

                  {/* La petición de repuesto que se resolvió con ella */}
                  <div className="rounded-xl border border-border/70 bg-background/80 p-3.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-mono font-bold text-muted-foreground">
                        PET-0043
                      </span>
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                        Aprobada · stock descontado
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3 text-xs font-medium">
                      <span>Cable triaxial SMPTE 311M 50 m</span>
                      <span className="font-mono text-foreground">×1 ud</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Almacén: Pasillo B · Estantería 03 · Cajón 12
                    </p>
                  </div>

                  {/* Los dos estudios que están emitiendo */}
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
                      <span className="truncate font-medium">
                        Plató 1 (Informativos)
                      </span>
                      <span className="size-2 shrink-0 rounded-full bg-emerald-500" />
                    </div>
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
                      <span className="truncate font-medium">
                        Unidad Móvil HD 01
                      </span>
                      <span className="size-2 shrink-0 rounded-full bg-signal" />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* El taller en cifras: un mes de trabajo, resumido                  */}
      {/* ---------------------------------------------------------------- */}
      <section
        id="taller"
        className={`scroll-mt-20 border-y border-border/60 bg-muted/20 ${SECCION}`}
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
                {cifras
                  ? `Actualizado ${formatRelativeTime(cifras.computedAt)} · ${formatCount(cifras.closedLastMonth)} incidencias cerradas en ${MEAN_WINDOW_DAYS} días.`
                  : "Consultando las cifras del taller…"}
              </p>
              {cifras?.meanResolutionMinutes === null && (
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  La media de resolución se publica a partir de{" "}
                  {MIN_CLOSED_FOR_MEAN} incidencias cerradas.
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

      {/* ---------------------------------------------------------------- */}
      {/* Las dos puertas del taller, en una sola tarjeta                   */}
      {/* ---------------------------------------------------------------- */}
      <section className={`border-y border-border/70 bg-muted/20 ${SECCION}`}>
        <div className={CONTENEDOR}>
          {/* Una tarjeta y dos puertas dentro: avisar arriba y seguir el caso
              abajo, cada una con su rótulo, su icono y su rejilla 5/7, y una
              raya entre las dos para que se lean como lo que son. */}
          <div className={`${TARJETA} p-6 sm:p-8`}>
            <div id="avisar" className="scroll-mt-24">
              <div className="grid gap-6 lg:grid-cols-12 lg:items-start lg:gap-10">
                <div className="lg:col-span-5">
                  <div className="flex items-start gap-3">
                    <span className={CHIP}>
                      <Siren className="size-4.5" />
                    </span>
                    <div>
                      <p className={ROTULO}>Centro de aviso</p>
                      <h2 className="mt-1 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                        Notifica una incidencia al instante
                      </h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Sin credenciales de técnico, en un minuto.
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                    Si un equipo de plató, cámara, intercom o sala de sonido
                    presenta anomalías, avisa al taller y el equipo de
                    ingeniería recibirá la notificación de inmediato.
                  </p>

                  <ul className="mt-4 space-y-2">
                    {[
                      "Sin registro previo ni contraseña",
                      "Código de seguimiento automático",
                      "Adjunta fotografías y detalles técnicos del equipo",
                    ].map((ventaja) => (
                      <li
                        key={ventaja}
                        className="flex items-start gap-2 text-xs text-foreground"
                      >
                        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-signal" />
                        <span>{ventaja}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="lg:col-span-7">
                  {/* Los tres pasos, en el mismo orden en que ocurren */}
                  <ol className="space-y-3">
                    {PASOS.map((paso) => (
                      <li key={paso.numero} className="flex gap-3">
                        <span className="mt-0.5 font-mono text-[11px] font-bold tracking-wider text-signal">
                          {paso.numero}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {paso.titulo}
                          </p>
                          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                            {paso.texto}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <Button asChild size="lg" className={CTA}>
                      <Link to="/reportar">
                        <Siren className="size-4.5" />
                        <span>Notificar incidencia</span>
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* La segunda puerta: el formulario donde el aviso pone los pasos. */}
            <div
              id="seguimiento"
              className="mt-8 scroll-mt-24 border-t border-border/70 pt-8 lg:mt-10 lg:pt-10"
            >
              <div className="grid gap-6 lg:grid-cols-12 lg:items-start lg:gap-10">
                <div className="lg:col-span-5">
                  <div className="flex items-start gap-3">
                    <span className={CHIP}>
                      <Search className="size-4.5" />
                    </span>
                    <div>
                      <p className={ROTULO}>Seguimiento</p>
                      <h2 className="mt-1 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                        Consultar estado de tu incidencia
                      </h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Con el código de 8 caracteres que te dieron al
                        notificarla.
                      </p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                    Sin cuenta ni contraseña. Solo necesitas el código que te
                    dieron al crear una incidencia.
                  </p>
                </div>
                <div className="lg:col-span-7">
                  <IncidentLookup />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Pie: marca, recorrido y versión                                   */}
      {/* ---------------------------------------------------------------- */}
      <footer className="border-t border-border/70 py-12 sm:py-14 lg:py-20">
        <div className={CONTENEDOR}>
          <div className="flex flex-col items-center justify-between gap-2 text-xs text-muted-foreground sm:flex-row">
            <button
              type="button"
              onClick={() => setShowChangelog(true)}
              className="cursor-pointer text-left transition-colors hover:text-foreground"
              title={`${DETAILED_VERSION} · Ver bitácora de cambios entre versiones`}
            >
              {FULL_VERSION} · Sistema de Gestión de Mantenimiento Broadcast
            </button>
            <p>
              © {new Date().getFullYear()} RGLara. Todos los derechos
              reservados.
            </p>
          </div>
        </div>
      </footer>

      <ChangelogDialog open={showChangelog} onOpenChange={setShowChangelog} />
    </div>
  );
}
