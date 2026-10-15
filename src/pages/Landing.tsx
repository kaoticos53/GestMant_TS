import logo from "@/assets/logo.svg";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import {
  Activity,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Cpu,
  FileCheck2,
  FileClock,
  Radio,
  Search,
  ShoppingCart,
  Siren,
  SlidersHorizontal,
  Tv,
  Video,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router";
import { FULL_VERSION, DETAILED_VERSION } from "@/version";
import { IncidentLookup } from "./dashboard/IncidentLookup";

const reveal = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.45, ease: "easeOut" },
} as const;

/** Áreas e infraestructuras técnicas cubiertas en una cadena broadcast. */
const broadcastAreas = [
  {
    icon: Video,
    title: "Plató y Control de Realización",
    description:
      "Cámaras de estudio SMPTE, mezcladores de vídeo, sistemas de intercomunicación, tally y cadenas de grafismo en tiempo real.",
    tag: "Producción en directo",
  },
  {
    icon: Tv,
    title: "Control Central (MCR) y Continuidad",
    description:
      "Matrices SDI/IP, servidores de emisión redundantes, procesadores de sincronismo, distribuidores y multiviewers de control.",
    tag: "Emisión 24/7",
  },
  {
    icon: Radio,
    title: "Unidades Móviles (OB Vans)",
    description:
      "Racks de transporte para retransmisiones exteriores, generadores auxiliares, encoders de enlace satelital y mochilas 5G.",
    tag: "Exteriores",
  },
  {
    icon: Cpu,
    title: "Sala de Aparatos (CAR) y Servidores",
    description:
      "Infraestructura de red troncal, matrices de enrutamiento 12G/ST 2110, almacenamiento SAN/NAS e ingesta continua.",
    tag: "Infraestructura",
  },
  {
    icon: SlidersHorizontal,
    title: "Postproducción y Sonido",
    description:
      "Salas de montaje no lineal, consolas de mezcla de audio broadcast, monitores de referencia calibrados y cabinas de locución.",
    tag: "Edición y Master",
  },
  {
    icon: Wrench,
    title: "Laboratorio Óptico y Electrónico",
    description:
      "Taller de calibración milimétrica para objetivos zoom broadcast, microfonía inalámbrica, iluminación LED y conexionado BNC.",
    tag: "Mantenimiento fino",
  },
];

/** Capacidades centrales del sistema de gestión técnica. */
const systemCapabilities: {
  icon: LucideIcon;
  title: string;
  description: string;
}[] = [
  {
    icon: Siren,
    title: "Notificación directa de incidencias",
    description:
      "Cualquier operador o técnico de plató notifica una incidencia sin pasar por login. El sistema genera un código público para seguimiento inmediato.",
  },
  {
    icon: Boxes,
    title: "Catálogo y almacén de repuestos",
    description:
      "Repuestos con nº de parte, ubicación exacta en el almacén, stock mínimo y compatibilidad directa con los equipos del inventario.",
  },
  {
    icon: Activity,
    title: "Aprobación con stock en tiempo real",
    description:
      "Al aprobar una petición, el material se descuenta automáticamente del catálogo. Cero discrepancias entre lo físico y el sistema.",
  },
  {
    icon: FileClock,
    title: "Cuaderno técnico y expediente",
    description:
      "Registro inmutable con notas formateadas, mediciones y fotografías del cuaderno de intervención hasta el cierre definitivo del caso.",
  },
  {
    icon: ShoppingCart,
    title: "Compras y recepción de albaranes",
    description:
      "Lo que el almacén no cubre se agrupa por proveedor en órdenes de compra. La recepción del albarán actualiza el material a recibido.",
  },
  {
    icon: FileCheck2,
    title: "Partes de trabajo homologados",
    description:
      "Generación de partes de trabajo oficiales en PDF, Markdown y ZIP por incidencia para auditorías técnicas y entrega de turnos.",
  },
];

/** Recorrido de una incidencia en el taller de broadcast. */
const incidentSteps = [
  {
    step: "01",
    title: "Notificación pública",
    description:
      "El operador de plató o control notifica la incidencia desde la web sin necesidad de cuenta. Obtiene un código único de seguimiento.",
  },
  {
    step: "02",
    title: "Asignación técnica",
    description:
      "El coordinador de guardia asigna la incidencia al técnico especialista según la criticidad (urgente, alta o normal).",
  },
  {
    step: "03",
    title: "Intervención en taller",
    description:
      "Se vincula al equipo del inventario, se solicitan repuestos al almacén y se anotan las mediciones en el cuaderno.",
  },
  {
    step: "04",
    title: "Cierre con parte de trabajo",
    description:
      "La intervención se registra en el historial del equipo y se emite el parte oficial para archivo y trazabilidad corporativa.",
  },
];

/** Recorrido de una petición de repuesto. */
const requestSteps = [
  {
    step: "01",
    title: "Petición del técnico",
    description:
      "El técnico solicita componentes indicando equipo afectado, prioridad y justificación diagnóstica.",
  },
  {
    step: "02",
    title: "Verificación de almacén",
    description:
      "El responsable de repuestos revisa la cola con visualización en tiempo real del stock disponible.",
  },
  {
    step: "03",
    title: "Aprobación o compra",
    description:
      "Aprobar descuenta el stock al momento. Si no hay existencias, la línea se aparta a la cola de compras del proveedor.",
  },
  {
    step: "04",
    title: "Entrega y archivo",
    description:
      "El material se entrega al técnico de guardia y la petición concluida pasa al archivo histórico del taller.",
  },
];

export default function Landing() {
  const { isLoading, isAuthenticated } = useAuth();
  const signedIn = isAuthenticated && !isLoading;

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-signal/20 selection:text-signal">
      {/* ---------------------------------------------------------------- */}
      {/* Barra de cabecera corporativa                                    */}
      {/* ---------------------------------------------------------------- */}
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <a
            href="#inicio"
            className="group flex items-center gap-3 transition-opacity hover:opacity-95"
          >
            <img
              src={logo}
              alt="Pulso Taller"
              className="size-9 rounded-lg ring-1 ring-border shadow-sm transition-transform group-hover:scale-105"
            />
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
                Pulso Taller
                <span className="hidden font-mono text-[10px] font-normal uppercase tracking-wider text-signal sm:inline-block">
                  Broadcast Engineering
                </span>
              </span>
              <span className="text-[11px] text-muted-foreground hidden sm:block">
                Mantenimiento de Televisión y Medios Audiovisuales
              </span>
            </div>
          </a>

          <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground lg:flex">
            <a
              href="#areas"
              className="transition-colors hover:text-foreground"
            >
              Áreas técnicas
            </a>
            <a
              href="#funciones"
              className="transition-colors hover:text-foreground"
            >
              Capacidades
            </a>
            <a
              href="#protocolo"
              className="transition-colors hover:text-foreground"
            >
              Protocolo técnico
            </a>
            <a
              href="#seguimiento"
              className="transition-colors hover:text-foreground"
            >
              Seguimiento
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            {/* BOTÓN PRINCIPAL PARA INVITADOS: Añadir/Notificar incidencia sin login */}
            <Button
              asChild
              variant="default"
              size="sm"
              className="bg-signal text-white hover:bg-signal/90 font-medium shadow-sm gap-1.5"
            >
              <Link to="/reportar">
                <Siren className="size-4 animate-pulse text-white" />
                <span>Añadir incidencia</span>
              </Link>
            </Button>

            {signedIn ? (
              <Button asChild size="sm" variant="outline" className="gap-1.5">
                <Link to="/dashboard">
                  <span>Ir al panel</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            ) : (
              <Button asChild variant="ghost" size="sm" className="text-xs">
                <Link to="/auth">Acceso técnicos</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------------------- */}
      {/* Hero Corporativo Broadcast                                       */}
      {/* ---------------------------------------------------------------- */}
      <section
        id="inicio"
        className="relative overflow-hidden border-b border-border/60 pb-16 pt-10 sm:pb-24 sm:pt-16 lg:pb-28"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-tech-grid opacity-50"
        />
        <div
          aria-hidden
          className="glow-signal pointer-events-none absolute -top-40 right-[-10%] h-[40rem] w-[40rem] rounded-full opacity-60"
        />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
            {/* Columna Izquierda: Mensaje y Acciones */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="lg:col-span-7"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/80 px-3 py-1 text-xs font-semibold text-foreground shadow-sm backdrop-blur-sm">
                <span className="flex size-2 rounded-full bg-signal animate-ping" />
                <span className="font-mono text-signal">DIVISIÓN TÉCNICA</span>
                <span className="text-muted-foreground">·</span>
                <span>Continuidad de Emisión y Plató</span>
              </div>

              <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl lg:leading-[1.1]">
                Ingeniería y mantenimiento para{" "}
                <span className="text-signal underline decoration-signal/30 underline-offset-4">
                  televisión broadcast
                </span>
                .
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                La plataforma de operaciones técnicas que centraliza el soporte a
                estudios, controles centrales y unidades móviles: notificación
                inmediata de incidencias, control milimétrico de repuestos con
                stock en tiempo real y homologación de partes de trabajo.
              </p>

              {/* Botonera de Acción Destacada */}
              <div className="mt-8 flex flex-wrap items-center gap-3.5">
                {/* Botón añadido para invitados sin pasar por login */}
                <Button
                  asChild
                  size="lg"
                  className="bg-signal text-white hover:bg-signal/90 px-6 font-semibold shadow-md gap-2"
                >
                  <Link to="/reportar">
                    <Siren className="size-4.5" />
                    <span>Añadir incidencia</span>
                  </Link>
                </Button>

                <Button asChild variant="outline" size="lg" className="px-5">
                  <Link to={signedIn ? "/dashboard" : "/auth"}>
                    {signedIn ? "Panel de control" : "Entrar al taller"}
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>

                <Button asChild variant="ghost" size="lg" className="px-4 text-muted-foreground hover:text-foreground">
                  <a href="#seguimiento">
                    <Search className="mr-1.5 size-4" />
                    Consultar con código
                  </a>
                </Button>
              </div>

              <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                <span>Acceso directo sin contraseña para personal de plató y colaboradores invitados.</span>
              </div>

              {/* SLAs y Garantías Corporativas */}
              <div className="mt-10 grid grid-cols-2 gap-4 border-t border-border/70 pt-6 sm:grid-cols-4">
                <div>
                  <p className="font-mono text-2xl font-bold text-foreground">99.98%</p>
                  <p className="text-xs text-muted-foreground">Disponibilidad técnica</p>
                </div>
                <div>
                  <p className="font-mono text-2xl font-bold text-signal">0 err</p>
                  <p className="text-xs text-muted-foreground">Control de stock real</p>
                </div>
                <div>
                  <p className="font-mono text-2xl font-bold text-foreground">100%</p>
                  <p className="text-xs text-muted-foreground">Trazabilidad por serie</p>
                </div>
                <div>
                  <p className="font-mono text-2xl font-bold text-emerald-600 dark:text-emerald-400">PDF/ZIP</p>
                  <p className="text-xs text-muted-foreground">Partes homologados</p>
                </div>
              </div>
            </motion.div>

            {/* Columna Derecha: Consola de Supervisión Técnica en Directo */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
              className="lg:col-span-5"
            >
              <div className="rounded-2xl border border-border/80 bg-card/95 p-1 shadow-2xl backdrop-blur-xl">
                {/* Cabecera del Rack de Monitorización */}
                <div className="flex items-center justify-between border-b border-border/70 bg-muted/40 px-4 py-3 rounded-t-xl">
                  <div className="flex items-center gap-2.5">
                    <div className="flex gap-1.5">
                      <span className="size-2.5 rounded-full bg-destructive/80" />
                      <span className="size-2.5 rounded-full bg-amber-500/80" />
                      <span className="size-2.5 rounded-full bg-emerald-500/80" />
                    </div>
                    <span className="font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      MONITOR TÉCNICO · MASTER CONTROL
                    </span>
                  </div>
                  <Badge variant="destructive" className="bg-red-600/90 text-[10px] font-mono tracking-wider animate-pulse">
                    ON AIR
                  </Badge>
                </div>

                {/* Líneas de Estado de Canales y Estudios */}
                <div className="space-y-3 p-4">
                  {/* Tarjeta de Incidencia Activa */}
                  <div className="rounded-xl border border-border/80 bg-background/80 p-3.5 shadow-sm">
                    <div className="flex items-center justify-between text-xs">
                      <span className="inline-flex items-center gap-1.5 font-mono font-bold text-signal">
                        <Siren className="size-3.5 text-signal" />
                        INC-0128
                      </span>
                      <span className="rounded-full bg-destructive/10 px-2 py-0.5 font-semibold text-destructive text-[10px]">
                        Prioridad Alta
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      Pérdida de sincronismo SDI en Cadena 2
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Equipo: Cámara de estudio HDC-3500 · Plató Principal
                    </p>
                    <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/50 pt-2">
                      <span>Técnico: A. Morales (Guardia)</span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400">En taller</span>
                    </div>
                  </div>

                  {/* Tarjeta de Petición de Repuesto Aprobada */}
                  <div className="rounded-xl border border-border/80 bg-background/80 p-3.5 shadow-sm">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-muted-foreground">
                        PET-0043
                      </span>
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-600 dark:text-emerald-400 text-[10px]">
                        Aprobada · Stock descontado
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs font-medium">
                      <span>Cable triaxial SMPTE 311M 50m</span>
                      <span className="font-mono text-foreground">x1 ud</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Almacén: Pasillo B · Estantería 03 · Cajón 12
                    </p>
                  </div>

                  {/* Estado de Estudios Broadcast */}
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
                      <span className="font-medium">Plató 1 (Informativos)</span>
                      <span className="size-2 rounded-full bg-emerald-500" />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
                      <span className="font-medium">Unidad Móvil HD 01</span>
                      <span className="size-2 rounded-full bg-signal" />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Sección: Áreas Técnicas de la Cadena Broadcast                   */}
      {/* ---------------------------------------------------------------- */}
      <section id="areas" className="scroll-mt-20 py-20 bg-muted/20 border-b border-border/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div {...reveal} className="max-w-3xl">
            <p className="font-mono text-xs font-bold uppercase tracking-wider text-signal">
              COBERTURA INTEGRAL
            </p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Infraestructura técnica bajo control continuo
            </h2>
            <p className="mt-3 text-base text-muted-foreground leading-relaxed">
              Diseñado para responder con rapidez a las exigencias críticas de una
              cadena de televisión: desde la producción en directo hasta la
              red troncal de emisión.
            </p>
          </motion.div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {broadcastAreas.map((area, index) => (
              <motion.div
                key={area.title}
                {...reveal}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                className="group relative rounded-xl border border-border/80 bg-card p-6 shadow-sm transition-all hover:border-signal/50 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-signal/10 text-signal group-hover:bg-signal group-hover:text-white transition-colors">
                    <area.icon className="size-5" />
                  </span>
                  <span className="font-mono text-[10px] font-semibold uppercase text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    {area.tag}
                  </span>
                </div>
                <h3 className="mt-4 text-base font-bold text-foreground">
                  {area.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {area.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Sección: Capacidades y Funciones del Sistema                     */}
      {/* ---------------------------------------------------------------- */}
      <section id="funciones" className="scroll-mt-20 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div {...reveal} className="max-w-3xl">
            <p className="font-mono text-xs font-bold uppercase tracking-wider text-signal">
              CAPACIDADES DEL TALLER
            </p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Todo el ciclo del material y el equipo
            </h2>
            <p className="mt-3 text-base text-muted-foreground leading-relaxed">
              Gestión centralizada de averías, piezas, almacén y compras para que
              ninguna orden se pierda en llamadas o correos de cambio de turno.
            </p>
          </motion.div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {systemCapabilities.map((cap, index) => (
              <motion.div
                key={cap.title}
                {...reveal}
                transition={{ duration: 0.45, delay: index * 0.06 }}
                className="rounded-xl border border-border/70 bg-card p-6 shadow-sm"
              >
                <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <cap.icon className="size-5" />
                </span>
                <h3 className="mt-4 text-base font-bold text-foreground">
                  {cap.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {cap.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Sección: Protocolo Técnico (Flujos Sincronizados)                */}
      {/* ---------------------------------------------------------------- */}
      <section
        id="protocolo"
        className="scroll-mt-20 border-y border-border/70 bg-muted/30 py-20"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div {...reveal} className="text-center max-w-3xl mx-auto">
            <p className="font-mono text-xs font-bold uppercase tracking-wider text-signal">
              PROCEDIMIENTO HOMOLOGADO
            </p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              El protocolo de actuación técnica
            </h2>
            <p className="mt-3 text-base text-muted-foreground">
              Dos circuitos paralelos y estrictamente trazables que garantizan la
              resolución del fallo sin fisuras documentales.
            </p>
          </motion.div>

          <div className="mt-14 grid gap-12 lg:grid-cols-2">
            {/* Flujo 1: Incidencia */}
            <div className="rounded-2xl border border-border/80 bg-card p-7 shadow-sm">
              <div className="flex items-center justify-between border-b border-border/70 pb-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-signal/15 text-signal font-bold">
                    <Siren className="size-5" />
                  </span>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">
                      Ciclo de la Incidencia
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      De la notificación de plató al parte de trabajo cerrado
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {incidentSteps.map((st) => (
                  <div
                    key={st.step}
                    className="flex gap-4 rounded-xl border border-border/60 bg-muted/20 p-4"
                  >
                    <span className="font-mono text-sm font-bold text-signal shrink-0">
                      {st.step}
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-foreground">
                        {st.title}
                      </h4>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                        {st.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Flujo 2: Petición de Repuesto */}
            <div className="rounded-2xl border border-border/80 bg-card p-7 shadow-sm">
              <div className="flex items-center justify-between border-b border-border/70 pb-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary font-bold">
                    <Boxes className="size-5" />
                  </span>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">
                      Ciclo de Repuestos
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Del stock del almacén a la entrega en mano
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {requestSteps.map((st) => (
                  <div
                    key={st.step}
                    className="flex gap-4 rounded-xl border border-border/60 bg-muted/20 p-4"
                  >
                    <span className="font-mono text-sm font-bold text-primary shrink-0">
                      {st.step}
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-foreground">
                        {st.title}
                      </h4>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                        {st.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Sección: Autoservicio para Invitados y Operadores                */}
      {/* ---------------------------------------------------------------- */}
      <section id="seguimiento" className="scroll-mt-20 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-border/80 bg-gradient-to-br from-card via-card to-muted/40 p-8 shadow-xl sm:p-12">
            <div className="grid gap-12 lg:grid-cols-12 lg:items-start">
              {/* Columna Izquierda: Botón directo para añadir incidencia */}
              <div className="lg:col-span-5">
                <Badge variant="outline" className="border-signal/40 bg-signal/10 text-signal font-mono text-[11px]">
                  CENTRO DE AUTOSERVICIO INVITADOS
                </Badge>
                <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                  Notifica una incidencia al instante
                </h2>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                  Si un equipo de plató, cámara, intercom o sala de sonido presenta
                  anomalías, no necesitas credenciales de técnico para avisar al
                  taller. Rellena el formulario público en un minuto y el equipo
                  de ingeniería recibirá la notificación de inmediato.
                </p>

                <div className="mt-8 space-y-4">
                  <div className="flex items-center gap-3 text-sm text-foreground">
                    <CheckCircle2 className="size-4.5 text-signal shrink-0" />
                    <span>Sin registro previo ni contraseña</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-foreground">
                    <CheckCircle2 className="size-4.5 text-signal shrink-0" />
                    <span>Generación automática de código de seguimiento</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-foreground">
                    <CheckCircle2 className="size-4.5 text-signal shrink-0" />
                    <span>Adjunta fotografías y detalles técnicos del equipo</span>
                  </div>
                </div>

                <div className="mt-8">
                  <Button
                    asChild
                    size="lg"
                    className="w-full sm:w-auto bg-signal text-white hover:bg-signal/90 font-semibold shadow-md gap-2"
                  >
                    <Link to="/reportar">
                      <Siren className="size-4.5" />
                      <span>Abrir formulario de incidencia</span>
                    </Link>
                  </Button>
                </div>
              </div>

              {/* Columna Derecha: Consulta de Seguimiento por Código */}
              <div className="lg:col-span-7 rounded-2xl border border-border/80 bg-background/90 p-6 shadow-sm">
                <div className="flex items-center gap-3 border-b border-border/60 pb-4">
                  <Search className="size-5 text-signal" />
                  <div>
                    <h3 className="text-base font-bold text-foreground">
                      Consultar estado de tu incidencia
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Introduce tu código público de 8 caracteres (ej. A7K2-QX9M)
                    </p>
                  </div>
                </div>

                <div className="mt-6">
                  <IncidentLookup />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Sección de Llamada a la Acción Final                             */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative overflow-hidden py-20 border-t border-border/60 bg-muted/20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-tech-grid opacity-40"
        />
        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
          <Badge variant="outline" className="font-mono text-xs text-signal border-signal/30">
            EMISIÓN CONTINUA
          </Badge>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
            El taller técnico que tu canal de televisión necesita.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground leading-relaxed">
            Elimina las hojas de cálculo y las comunicaciones aisladas. Organiza
            el inventario de equipos audiovisuales, el catálogo de repuestos y las
            intervenciones con el estándar de la industria.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
            {/* Botón directo de añadir incidencia sin login */}
            <Button
              asChild
              size="lg"
              className="bg-signal text-white hover:bg-signal/90 font-semibold shadow-md gap-2"
            >
              <Link to="/reportar">
                <Siren className="size-4.5" />
                <span>Añadir incidencia</span>
              </Link>
            </Button>

            <Button asChild variant="outline" size="lg">
              <Link to={signedIn ? "/dashboard" : "/auth"}>
                {signedIn ? "Acceder al panel" : "Acceso técnicos"}
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Pie de página corporativo                                        */}
      {/* ---------------------------------------------------------------- */}
      <footer className="border-t border-border/70 py-12 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-3">
              <img
                src={logo}
                alt="Pulso Taller"
                className="size-8 rounded-lg ring-1 ring-border shadow-sm"
              />
              <div>
                <p className="text-sm font-bold tracking-tight text-foreground">
                  Pulso Taller
                </p>
                <p className="text-xs text-muted-foreground">
                  Ingeniería Broadcast & Mantenimiento Técnico Audiovisual
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6 text-xs text-muted-foreground">
              <Link to="/reportar" className="hover:text-foreground transition-colors">
                Notificar incidencia
              </Link>
              <a href="#seguimiento" className="hover:text-foreground transition-colors">
                Seguimiento
              </a>
              <Link to="/auth" className="hover:text-foreground transition-colors">
                Acceso profesional
              </Link>
            </div>
          </div>

          <div className="mt-8 flex flex-col items-center justify-between border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row">
            <p title={DETAILED_VERSION}>
              {FULL_VERSION} · Sistema de Gestión de Mantenimiento Broadcast
            </p>
            <p className="mt-2 sm:mt-0">
              © {new Date().getFullYear()} Pulso Taller. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
