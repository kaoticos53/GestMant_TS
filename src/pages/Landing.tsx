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

export default function Landing() {
  const [showChangelog, setShowChangelog] = useState(false);
  const { isLoading, isAuthenticated } = useAuth();
  const signedIn = isAuthenticated && !isLoading;

  return (
    <div
      id="inicio"
      className="min-h-screen bg-background text-foreground antialiased selection:bg-signal/20 selection:text-signal"
    >
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
                  Broadcast TV
                </span>
              </span>
              <span className="text-[11px] text-muted-foreground hidden sm:block">
                Mantenimiento de Televisión
              </span>
            </div>
          </a>

          <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground lg:flex">
            <a
              href="#seguimiento"
              className="transition-colors hover:text-foreground"
            >
              Seguimiento
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            {/* Botón principal: notificar una incidencia no pide cuenta */}
            <Button
              asChild
              variant="default"
              size="sm"
              className="bg-signal text-white hover:bg-signal/90 font-medium shadow-sm gap-1.5"
            >
              <Link to="/reportar">
                <Siren className="size-4 animate-pulse text-white" />
                {/* En un móvil la etiqueta larga no cabe en la barra: se deja
                    en «Notificar», que es la misma acción sin el sustantivo. */}
                <span className="sm:hidden">Notificar</span>
                <span className="hidden sm:inline">Notificar incidencia</span>
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
      {/* Consulta del estado de la incidencia, en lo más alto: es la       */}
      {/* puerta de quien notificó un aviso y viene a ver cómo va.          */}
      {/* ---------------------------------------------------------------- */}
      <section
        id="seguimiento"
        className="scroll-mt-20 border-b border-border/60 bg-muted/20"
      >
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="rounded-2xl border border-border/80 bg-card/95 p-5 shadow-sm sm:p-6">
            <div className="grid gap-5 lg:grid-cols-12 lg:items-start lg:gap-8">
              <div className="lg:col-span-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-signal/10 text-signal">
                    <Search className="size-4.5" />
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-foreground">
                      Consultar estado de tu incidencia
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Con el código de 8 caracteres que te dieron al notificarla.
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                  Sin cuenta ni contraseña: el código es lo único que ata tu aviso
                  al caso. ¿No lo tienes?{" "}
                  <Link
                    to="/reportar"
                    className="text-signal underline underline-offset-2"
                  >
                    Notifica la incidencia
                  </Link>{" "}
                  y recibirás uno.
                </p>
              </div>
              <div className="lg:col-span-8">
                <IncidentLookup />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Hero Corporativo Broadcast                                       */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative overflow-hidden border-b border-border/60 pb-16 pt-10 sm:pb-24 sm:pt-16 lg:pb-28">
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
                inmediata de incidencias.
              </p>

              {/* Botonera de Acción Destacada */}
              <div className="mt-8 flex flex-wrap items-center gap-3.5">
                {/* Notificar no pide cuenta: es la puerta pública del taller */}
                <Button
                  asChild
                  size="lg"
                  className="bg-signal text-white hover:bg-signal/90 px-6 font-semibold shadow-md gap-2"
                >
                  <Link to="/reportar">
                    <Siren className="size-4.5" />
                    <span>Notificar incidencia</span>
                  </Link>
                </Button>

                <Button asChild variant="outline" size="lg" className="px-5">
                  <Link to={signedIn ? "/dashboard" : "/auth"}>
                    {signedIn ? "Ir al panel" : "Acceso técnicos"}
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
                <span>Notificar una incidencia no requiere cuenta ni contraseña.</span>
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
      {/* Aviso de incidencia: el formulario público, sin credenciales      */}
      {/* ---------------------------------------------------------------- */}
      <section
        id="avisar"
        className="scroll-mt-20 border-y border-border/70 bg-muted/30 py-20"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-border/80 bg-gradient-to-br from-card via-card to-muted/40 p-8 shadow-xl sm:p-12">
            <Badge
              variant="outline"
              className="border-signal/40 bg-signal/10 font-mono text-[11px] text-signal"
            >
              CENTRO DE AVISO
            </Badge>
            <h2 className="mt-4 max-w-3xl text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Notifica una incidencia al instante
            </h2>
            <p className="mt-3 max-w-3xl text-sm text-muted-foreground leading-relaxed">
              Si un equipo de plató, cámara, intercom o sala de sonido presenta
              anomalías, no necesitas credenciales de técnico para avisar al
              taller. Rellena el formulario público en un minuto y el equipo de
              ingeniería recibirá la notificación de inmediato.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="flex items-center gap-3 text-sm text-foreground">
                <CheckCircle2 className="size-4.5 shrink-0 text-signal" />
                <span>Sin registro previo ni contraseña</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-foreground">
                <CheckCircle2 className="size-4.5 shrink-0 text-signal" />
                <span>Generación automática de código de seguimiento</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-foreground">
                <CheckCircle2 className="size-4.5 shrink-0 text-signal" />
                <span>Adjunta fotografías y detalles técnicos del equipo</span>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                asChild
                size="lg"
                className="bg-signal text-white hover:bg-signal/90 font-semibold shadow-md gap-2"
              >
                <Link to="/reportar">
                  <Siren className="size-4.5" />
                  <span>Notificar incidencia</span>
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/seguimiento">
                  <Search className="mr-1.5 size-4" />
                  Consultar con código
                </Link>
              </Button>
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
            {/* Botón directo para notificar una incidencia */}
            <Button
              asChild
              size="lg"
              className="bg-signal text-white hover:bg-signal/90 font-semibold shadow-md gap-2"
            >
              <Link to="/reportar">
                <Siren className="size-4.5" />
                <span>Notificar incidencia</span>
              </Link>
            </Button>

            <Button asChild variant="outline" size="lg">
              <Link to={signedIn ? "/dashboard" : "/auth"}>
                {signedIn ? "Ir al panel" : "Acceso técnicos"}
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
                Acceso técnicos
              </Link>
              <button
                type="button"
                onClick={() => setShowChangelog(true)}
                className="hover:text-foreground transition-colors cursor-pointer text-left"
              >
                Bitácora de cambios
              </button>
            </div>
          </div>

          <div className="mt-8 flex flex-col items-center justify-between border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row">
            <button
              type="button"
              onClick={() => setShowChangelog(true)}
              className="text-left hover:text-foreground transition-colors cursor-pointer"
              title={`${DETAILED_VERSION} · Ver bitácora de cambios entre versiones`}
            >
              {FULL_VERSION} · Sistema de Gestión de Mantenimiento Broadcast
            </button>
            <p className="mt-2 sm:mt-0">
              © {new Date().getFullYear()} Pulso Taller. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </footer>

      <ChangelogDialog
        open={showChangelog}
        onOpenChange={setShowChangelog}
      />
    </div>
  );
}
