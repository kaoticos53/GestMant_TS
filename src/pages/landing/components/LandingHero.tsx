import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Search, Siren } from "lucide-react";
import { Link } from "react-router";
import { CONTENEDOR, CTA, ETIQUETA, TEXTO } from "../constants";
import { TechnicalConsolePreview } from "./TechnicalConsolePreview";

/**
 * Sección principal Hero de la portada con propuesta de valor responsiva
 * y maqueta de consola de supervisión en escritorio.
 */
export function LandingHero() {
  return (
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

            {/* En móvil, una línea: la portada simplificada solo promete lo
                que ofrece —avisar y seguir—, y el párrafo largo se queda para
                cuando hay ancho donde leerlo. */}
            <p
              data-testid="hero-corto"
              className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:hidden"
            >
              Avisa de una incidencia y sigue su estado. Sin cuenta.
            </p>
            <p
              data-testid="hero-largo"
              className={`mt-5 hidden max-w-xl sm:block sm:text-lg ${TEXTO}`}
            >
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
          </motion.div>

          {/* Columna derecha: la consola para escritorio */}
          <TechnicalConsolePreview />
        </div>
      </div>
    </section>
  );
}
