import logo from "@/assets/logo.svg";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import {
  Archive,
  ArrowRight,
  BellRing,
  BookOpen,
  Boxes,
  Check,
  ClipboardList,
  FileClock,
  ListChecks,
  Mail,
  Search,
  ShieldCheck,
  ShoppingCart,
  Siren,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router";
import { FULL_VERSION, DETAILED_VERSION } from "@/version";

const reveal = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.45, ease: "easeOut" },
} as const;

const features: {
  icon: LucideIcon;
  title: string;
  description: string;
}[] = [
  {
    icon: Siren,
    title: "Incidencias de principio a fin",
    description:
      "Cualquiera notifica una avería desde el formulario público; el coordinador la asigna y el técnico la trabaja hasta cerrarla con su parte.",
  },
  {
    icon: FileClock,
    title: "Cuaderno y expediente",
    description:
      "Notas con formato e imágenes en el hilo de cada incidencia, y los documentos del expediente con su rastro de cambios.",
  },
  {
    icon: ClipboardList,
    title: "Mantenimiento del equipo",
    description:
      "El historial de cada equipo del inventario —averías y revisiones preventivas— con el aviso de la que toca por calendario.",
  },
  {
    icon: BookOpen,
    title: "Manuales del taller",
    description:
      "Del fabricante o notas del taller, buscables por tipo, marca, modelo y equipo, con descarga y la versión anterior a mano.",
  },
  {
    icon: ListChecks,
    title: "Cola de peticiones",
    description:
      "Cada petición entra con prioridad, quién la pide, el equipo afectado y sus líneas. Nada se pierde en el correo del turno.",
  },
  {
    icon: Check,
    title: "Aprobación con stock real",
    description:
      "Aprobar descuenta el material del catálogo, así que el stock de la pantalla es el del almacén; rechazar deja el motivo firmado.",
  },
  {
    icon: ShoppingCart,
    title: "Compras y recepción",
    description:
      "Lo que el almacén no cubre se aparta por proveedor, se arma la orden de compra y la recepción del albarán deja el material recibido.",
  },
  {
    icon: Boxes,
    title: "Catálogo e inventario",
    description:
      "Repuestos con código, ubicación, proveedor y stock mínimo; equipos con su ficha, su nº de serie y la compatibilidad entre ambos.",
  },
  {
    icon: Archive,
    title: "Archivado y auditoría",
    description:
      "Lo terminado se archiva solo cada noche —nunca se borra—, y el expediente guarda quién movió cada documento.",
  },
];

/** Lo que redondea el producto, en una línea por cosa: lo que no cabe en la
 * rejilla de funciones, pero cambia el día a día. */
const extras: { icon: LucideIcon; label: string }[] = [
  {
    icon: BellRing,
    label: "Avisos de stock bajo y de trabajo sin constancia",
  },
  { icon: Mail, label: "Resumen semanal del taller por correo" },
  { icon: Users, label: "Roles y permisos, persona a persona" },
  { icon: ShieldCheck, label: "El expediente deja su rastro de cambios" },
  { icon: Search, label: "Búsqueda única desde la barra de arriba" },
  { icon: Sparkles, label: "Datos de ejemplo o taller vacío, a tu elección" },
];

/** El recorrido de una incidencia, de la avería al parte. */
const incidentSteps = [
  {
    title: "Se notifica",
    description:
      "Cualquiera abre el formulario público y cuenta la avería; queda como incidencia con su número para el taller y su código para seguirla desde fuera.",
  },
  {
    title: "Se asigna y diagnostica",
    description:
      "El coordinador la asigna —o el técnico se autoasigna— y el cuaderno recoge notas, fotos y documentos.",
  },
  {
    title: "Entra a taller",
    description:
      "Se vincula al equipo del inventario y se piden los repuestos que falten para repararla.",
  },
  {
    title: "Se cierra con su parte",
    description:
      "Resuelta o sin resolución: la intervención queda en el historial del equipo y el parte, listo para entregar.",
  },
];

/** El recorrido de una petición de repuestos, de la solicitud a la entrega. */
const requestSteps = [
  {
    title: "El técnico pide",
    description:
      "Elige repuestos y cantidades, indica el equipo afectado y la prioridad.",
  },
  {
    title: "El responsable revisa",
    description:
      "La petición entra en la cola con el stock disponible y todo el contexto.",
  },
  {
    title: "Aprueba o rechaza",
    description:
      "Aprobar descuenta stock del catálogo; si falta, se aparta para comprar. Rechazar deja el motivo.",
  },
  {
    title: "Se entrega y se archiva",
    description:
      "El material queda en manos del técnico y lo terminado pasa al archivo del taller.",
  },
];

const heroChecks = [
  "Incidencias de principio a fin",
  "Peticiones con el stock descontado",
  "Mantenimiento y manuales por equipo",
  "Muestra de ejemplo o taller vacío",
];

function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-sm font-medium text-signal">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-base leading-7 text-muted-foreground">
        {subtitle}
      </p>
    </div>
  );
}

/** Un recorrido del taller, paso a paso: el mismo armazón para la incidencia y
 * para la petición, que es lo que hace que las dos se lean igual. */
function FlowTrack({
  eyebrow,
  title,
  subtitle,
  steps,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  steps: { title: string; description: string }[];
}) {
  return (
    <div>
      <SectionHeading eyebrow={eyebrow} title={title} subtitle={subtitle} />
      <ol className="mt-8 grid gap-4 md:grid-cols-4">
        {steps.map((step, index) => (
          <motion.li
            key={step.title}
            {...reveal}
            transition={{
              duration: 0.45,
              ease: "easeOut",
              delay: index * 0.07,
            }}
            className="relative rounded-xl border border-border/70 bg-card p-5 shadow-sm"
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {index + 1}
            </span>
            <h3 className="mt-4 text-sm font-semibold tracking-tight">
              {step.title}
            </h3>
            <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
              {step.description}
            </p>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}

export default function Landing() {
  const { isLoading, isAuthenticated } = useAuth();
  const signedIn = isAuthenticated && !isLoading;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ---------------------------------------------------------------- */}
      {/* Navegación                                                       */}
      {/* ---------------------------------------------------------------- */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <a href="#inicio" className="flex items-center gap-2.5">
            <img
              src={logo}
              alt="Pulso Taller"
              className="size-8 rounded-lg ring-1 ring-border"
            />
            <span className="text-sm font-semibold tracking-tight">
              Pulso Taller
            </span>
          </a>

          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a
              href="#funciones"
              className="transition-colors hover:text-foreground"
            >
              Funciones
            </a>
            <a
              href="#flujo"
              className="transition-colors hover:text-foreground"
            >
              Cómo funciona
            </a>
            <a
              href="#responsable"
              className="transition-colors hover:text-foreground"
            >
              El puesto del responsable
            </a>
            <Link
              to="/reportar"
              className="transition-colors hover:text-foreground"
            >
              Reportar incidencia
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            {signedIn ? (
              <Button asChild size="sm" className="gap-1.5">
                <Link to="/dashboard">
                  Ir al panel
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/auth">Acceder</Link>
                </Button>
                <Button asChild size="sm" className="gap-1.5">
                  <Link to="/auth">
                    Entrar al taller
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------------------- */}
      {/* Hero                                                             */}
      {/* ---------------------------------------------------------------- */}
      <section id="inicio" className="relative overflow-hidden scroll-mt-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-tech-grid opacity-70"
        />
        <div
          aria-hidden
          className="glow-signal pointer-events-none absolute -right-32 -top-40 h-[36rem] w-[36rem] rounded-full"
        />

        <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:pb-24 lg:pt-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
              <span className="size-1.5 rounded-full bg-signal" />
              Taller audiovisual · Cadena de televisión
            </span>

            <h1 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.4rem]">
              El taller audiovisual,{" "}
              <span className="text-signal">bajo control</span>.
            </h1>

            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              Pulso Taller reúne lo que hoy vive en correos, hojas de cálculo y
              cuadernos de papel: las incidencias y su reparación, las peticiones
              de repuestos, el stock del almacén y el mantenimiento de cada
              equipo, en una sola pantalla.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="gap-2">
                <Link to={signedIn ? "/dashboard" : "/auth"}>
                  {signedIn ? "Ir al panel" : "Acceder al taller"}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a href="#flujo">Ver cómo funciona</a>
              </Button>
            </div>

            <ul className="mt-9 grid gap-2.5 text-sm text-muted-foreground sm:grid-cols-2">
              {heroChecks.map((check) => (
                <li key={check} className="flex items-center gap-2">
                  <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-signal/10">
                    <Check className="size-3 text-signal" />
                  </span>
                  {check}
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Vista previa del producto */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
            className="relative"
          >
            <div className="relative rounded-2xl border border-border/70 bg-card shadow-xl shadow-foreground/[0.05]">
              <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
                <div className="flex items-center gap-2">
                  <img
                    src={logo}
                    alt=""
                    className="size-6 rounded-md ring-1 ring-border"
                  />
                  <span className="text-xs font-semibold tracking-tight">
                    Peticiones pendientes
                  </span>
                </div>
                <span className="rounded-full bg-signal/10 px-2 py-0.5 text-[10px] font-semibold text-signal">
                  2 en cola
                </span>
              </div>

              <div className="space-y-3 p-4">
                <div className="rounded-xl border border-border/70 bg-background/60 p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-semibold text-muted-foreground">
                        PET-0001
                      </span>
                      <span className="rounded-full border border-destructive/25 bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                        Urgente
                      </span>
                      <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                        Pendiente
                      </span>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      hace 2 h
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-semibold tracking-tight">
                    Sandra Ruiz
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      · Cámara
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Equipo: Cámara de estudio HDC-3500
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <span className="rounded-md border border-border/70 bg-muted/60 px-2 py-1 font-mono text-[10px]">
                      ALI-24015 <span className="font-sans">×1</span>
                    </span>
                    <span className="rounded-md border border-border/70 bg-muted/60 px-2 py-1 font-mono text-[10px]">
                      BAT-19001 <span className="font-sans">×1</span>
                    </span>
                  </div>
                  <div className="mt-3 flex justify-end gap-1.5">
                    <span className="rounded-md px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                      Ver detalle
                    </span>
                    <span className="rounded-md border border-border/70 px-2.5 py-1 text-[11px] font-medium">
                      Rechazar
                    </span>
                    <span className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground">
                      Aprobar
                    </span>
                  </div>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/60 p-3.5 opacity-90">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-semibold text-muted-foreground">
                        PET-0002
                      </span>
                      <span className="rounded-full border border-signal/25 bg-signal/10 px-2 py-0.5 text-[10px] font-semibold text-signal">
                        Normal
                      </span>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      hace 1 d
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-semibold tracking-tight">
                    Marcos Vega
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      · Realización
                    </span>
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <span className="rounded-md border border-border/70 bg-muted/60 px-2 py-1 font-mono text-[10px]">
                      AUD-AUR01 <span className="font-sans">×2</span>
                    </span>
                    <span className="rounded-md border border-border/70 bg-muted/60 px-2 py-1 font-mono text-[10px]">
                      AUD-XLR10 <span className="font-sans">×2</span>
                    </span>
                  </div>
                </div>{" "}
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-background/60 px-3 py-2.5">
                  <span className="font-mono text-[11px]">ILU-LED60</span>
                  <span className="text-[11px] text-muted-foreground">
                    Panel LED60 W bicolor
                  </span>
                  <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                    3 /4 ud · stock bajo
                  </span>
                </div>
              </div>
            </div>

            <div className="absolute -left-4 bottom-16 hidden items-center gap-2 rounded-lg border border-emerald-600/25 bg-card px-3 py-2 text-xs font-medium shadow-md md:flex">
              <span className="size-1.5 rounded-full bg-emerald-600" />
              PET-0005 entregada · historial al día
            </div>
          </motion.div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Funciones                                                        */}
      {/* ---------------------------------------------------------------- */}
      <section
        id="funciones"
        className="scroll-mt-20 border-y border-border/60 bg-muted/30 py-20"
      >
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <motion.div {...reveal}>
            <SectionHeading
              eyebrow="Funciones"
              title="Todo el taller, no solo el almacén"
              subtitle="Desde la avería que alguien notifica hasta el repuesto que se entrega: incidencias, peticiones, compras, manuales y mantenimiento, cada uno con su registro."
            />
          </motion.div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                {...reveal}
                transition={{
                  duration: 0.45,
                  ease: "easeOut",
                  delay: index * 0.05,
                }}
                className="group rounded-xl border border-border/70 bg-card p-5 shadow-sm transition-colors hover:border-signal/40"
              >
                <span className="flex size-9 items-center justify-center rounded-lg bg-signal/10 text-signal transition-colors group-hover:bg-signal group-hover:text-primary-foreground">
                  <feature.icon className="size-4" />
                </span>
                <h3 className="mt-4 font-semibold tracking-tight">
                  {feature.title}
                </h3>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {extras.map((extra) => (
              <motion.div
                key={extra.label}
                {...reveal}
                className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-card px-3 py-2.5 text-sm text-muted-foreground"
              >
                <extra.icon className="size-4 shrink-0 text-signal" />
                {extra.label}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Cómo funciona                                                    */}
      {/* ---------------------------------------------------------------- */}
      <section id="flujo" className="scroll-mt-20 py-20">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-14 px-4 sm:px-6">
          <FlowTrack
            eyebrow="Cómo funciona"
            title="Una incidencia, de la avería al parte"
            subtitle="Quien sufre la avería la notifica, el taller la trabaja y cada paso deja su registro en el cuaderno y en el historial del equipo."
            steps={incidentSteps}
          />

          <FlowTrack
            eyebrow="Y una petición"
            title="Del almacén al técnico, sin perderse"
            subtitle="Un flujo corto y trazable, pensado para que el responsable decida en segundos y el técnico sepa siempre dónde está su material."
            steps={requestSteps}
          />

          <motion.div
            {...reveal}
            className="mt-8 flex flex-wrap items-center justify-center gap-3 rounded-xl border border-border/70 bg-card px-5 py-4 shadow-sm"
          >
            <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700">
              Pendiente
            </span>
            <ArrowRight className="size-4 text-muted-foreground" />
            <span className="rounded-full border border-signal/25 bg-signal/10 px-3 py-1 text-xs font-semibold text-signal">
              Aprobada
            </span>
            <ArrowRight className="size-4 text-muted-foreground" />
            <span className="rounded-full border border-emerald-600/25 bg-emerald-600/10 px-3 py-1 text-xs font-semibold text-emerald-700">
              Entregada
            </span>
            <span className="text-xs text-muted-foreground">
              o rechazada, siempre con motivo y autor
            </span>
          </motion.div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Puesto del responsable                                           */}
      {/* ---------------------------------------------------------------- */}
      <section
        id="responsable"
        className="scroll-mt-20 border-y border-border/60 bg-muted/30 py-20"
      >
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
          <motion.div {...reveal}>
            <SectionHeading
              eyebrow="Tu primera pantalla"
              title="El puesto de trabajo del responsable de repuestos"
              subtitle="Al entrar no hay gráficos decorativos: hay un resumen del taller y una cola de decisiones."
            />
            <ul className="mt-6 space-y-3 text-sm leading-6 text-muted-foreground">
              {[
                "El resumen al abrir: peticiones pendientes, repuestos con stock bajo y material entregado.",
                "Las peticiones en cola con su prioridad, su solicitante y el equipo afectado.",
                "Stock disponible junto a cada línea, para aprobar sin sorpresas.",
                "La incidencia que avanza sin dejar constancia, señalada en el panel.",
                "Un botón para aprobar —descontando stock— y otro para rechazar con motivo.",
                "Historial de decisiones y entregas con fecha y autor.",
              ].map((item) => (
                <li key={item} className="flex gap-2.5">
                  <span className="mt-1 flex size-4 shrink-0 items-center justify-center rounded-full bg-signal/10">
                    <Check className="size-3 text-signal" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <Button asChild size="lg" className="mt-8 gap-2">
              <Link to={signedIn ? "/dashboard" : "/auth"}>
                {signedIn ? "Ir al panel" : "Acceder al taller"}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </motion.div>

          <motion.div
            {...reveal}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
            className="rounded-2xl border border-border/70 bg-card p-4 shadow-xl shadow-foreground/[0.05]"
          >
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: "4", label: "pendientes", tone: "text-signal" },
                { value: "5", label: "stock bajo", tone: "text-amber-700" },
                { value: "15", label: "repuestos", tone: "text-foreground" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-border/70 bg-background/60 p-3 text-center"
                >
                  <p
                    className={`text-2xl font-semibold tabular-nums tracking-tight ${stat.tone}`}
                  >
                    {stat.value}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-3 overflow-hidden rounded-xl border border-border/70">
              <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-border/70 bg-background/60 px-3 py-2 text-[11px] font-medium text-muted-foreground">
                <span>Repuesto</span>
                <span className="text-right">Stock</span>
                <span className="text-right">Estado</span>
              </div>{" "}
              {[
                {
                  code: "ILU-LED60",
                  name: "Panel LED 60 W bicolor",
                  stock: "3 ud",
                  state: "Stock bajo",
                  stateClass:
                    "border-amber-500/25 bg-amber-500/10 text-amber-700",
                },
                {
                  code: "VID-CAR04",
                  name: "Tarjeta de salida SDI 4K",
                  stock: "0 ud",
                  state: "Agotado",
                  stateClass:
                    "border-destructive/25 bg-destructive/10 text-destructive",
                },
                {
                  code: "VID-SDI30",
                  name: "Cable SDI 12G 30 m",
                  stock: "12 ud",
                  state: "Disponible",
                  stateClass:
                    "border-emerald-600/25 bg-emerald-600/10 text-emerald-700",
                },
              ].map((row) => (
                <div
                  key={row.code}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-border/60 px-3 py-2.5 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {row.code}
                    </p>
                    <p className="truncate text-xs font-medium">{row.name}</p>
                  </div>
                  <span className="text-right text-xs tabular-nums">
                    {row.stock}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${row.stateClass}`}
                  >
                    {row.state}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Llamada a la acción                                              */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative overflow-hidden py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-tech-grid opacity-60"
        />
        <div
          aria-hidden
          className="glow-signal pointer-events-none absolute bottom-[-14rem] left-1/2 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full"
        />
        <motion.div
          {...reveal}
          className="relative mx-auto max-w-3xl px-4 text-center sm:px-6"
        >
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Tu taller, con tus datos desde el primer día.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-muted-foreground">
            Un taller nuevo arranca con la base vacía y da de alta lo suyo, o
            carga los datos de ejemplo para recorrer el flujo completo en dos
            minutos: notificar, reparar, pedir, aprobar y entregar. Los datos de
            ejemplo se pueden vaciar cuando ya no hagan falta.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="gap-2">
              <Link to={signedIn ? "/dashboard" : "/auth"}>
                {signedIn ? "Ir al panel" : "Acceder al taller"}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href="#funciones">Ver funciones</a>
            </Button>
            <Button asChild variant="outline" size="lg" className="gap-2">
              <Link to="/reportar">
                <Siren className="size-4" />
                Reportar una incidencia
              </Link>
            </Button>
          </div>
        </motion.div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Pie                                                              */}
      {/* ---------------------------------------------------------------- */}
      <footer className="border-t border-border/60 py-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-2.5">
            <img
              src={logo}
              alt=""
              className="size-7 rounded-lg ring-1 ring-border"
            />
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-tight">
                Pulso Taller
              </p>
              <p className="text-xs text-muted-foreground">
                Mantenimiento de equipo audiovisual · Cadena de televisión
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground" title={DETAILED_VERSION}>
            {FULL_VERSION} · Gestión del taller audiovisual · © 2026 Pulso Taller
          </p>
        </div>
      </footer>
    </div>
  );
}
