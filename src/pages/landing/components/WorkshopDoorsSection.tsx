import { Button } from "@/components/ui/button";
import { CheckCircle2, Search, Siren } from "lucide-react";
import { Link } from "react-router";
import { IncidentLookup } from "@/pages/dashboard/IncidentLookup";
import {
  CHIP,
  CONTENEDOR,
  CTA,
  PASOS,
  ROTULO,
  SECCION,
  TARJETA,
} from "../constants";

/**
 * Las dos puertas del taller en una única tarjeta de acceso rápido:
 * - Puerta 1 ('#avisar'): formulario directo para comunicar incidencias.
 * - Puerta 2 ('#seguimiento'): consulta por código de 8 caracteres sin contraseña.
 */
export function WorkshopDoorsSection() {
  return (
    <section className={`border-y border-border/70 bg-muted/20 ${SECCION}`}>
      <div className={CONTENEDOR}>
        <div className={`${TARJETA} p-6 sm:p-8`}>
          {/* Puerta 1: Avisar */}
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
                      Sin cuenta, en un minuto.
                    </p>
                  </div>
                </div>

                {/* El porqué y sus tres ventajas: en móvil sobran */}
                <div
                  data-testid="aviso-detalle"
                  className="mt-4 hidden space-y-4 sm:block"
                >
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Si un equipo de plató, cámara, intercom o sala de sonido
                    presenta anomalías, avisa al taller y el equipo de
                    ingeniería recibirá la notificación de inmediato.
                  </p>

                  <ul className="space-y-2">
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
              </div>

              <div className="lg:col-span-7">
                {/* Los tres pasos numerados */}
                <ol
                  data-testid="aviso-pasos"
                  className="hidden space-y-3 sm:block"
                >
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

          {/* Puerta 2: Seguimiento */}
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
                <p
                  data-testid="seguimiento-intro"
                  className="mt-4 hidden text-sm leading-relaxed text-muted-foreground sm:block"
                >
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
  );
}
