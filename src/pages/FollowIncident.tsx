import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import logo from "@/assets/logo.svg";
import { Home, Siren } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { IncidentLookup } from "./dashboard/IncidentLookup";

/**
 * Seguir una incidencia por su código, sin cuenta ni sesión.
 *
 * Es la dirección que llevan los correos al notificador —`/seguimiento?codigo=…`—
 * y la del botón «Seguir esta incidencia» que aparece al enviar un aviso. Aquí no
 * hace falta haber entrado en la aplicación: se llega con el código, que es lo
 * único que ata a quien avisó con su caso, y lo que se ve es el recorte de
 * seguimiento y nada más (el expediente del taller se queda dentro).
 *
 * El código viene en la dirección para que no haya que teclearlo mirando el
 * correo; el buscador lo lleva puesto y consulta solo al abrir. Si se llega sin
 * código —o se quiere seguir otro caso—, el campo está ahí para escribirlo.
 */
export default function FollowIncident() {
  const [params] = useSearchParams();
  const code = params.get("codigo");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <img
              src={logo}
              alt="Pulso Taller"
              className="size-8 rounded-lg ring-1 ring-border"
            />
            <span className="text-sm font-semibold tracking-tight">
              Pulso Taller
            </span>
          </Link>
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <Link to="/">
              <Home className="size-3.5" />
              Inicio
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-col px-4 pb-16 pt-10 sm:px-6">
        <Card className="shadow-md">
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <span className="flex size-10 items-center justify-center rounded-lg bg-signal/10 text-signal">
                <Siren className="size-5" />
              </span>
              <div>
                <CardTitle className="text-xl">Seguir una incidencia</CardTitle>
                <CardDescription>
                  Con el código que te dieron al notificarla ves en qué punto
                  va, sin cuenta ni nada que instalar.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <IncidentLookup initialCode={code} />

            <p className="border-t border-border/60 pt-4 text-xs text-muted-foreground">
              ¿No tienes el código? Está en el correo de confirmación y en cada
              aviso de cambio de estado. Si se ha perdido, se puede{" "}
              <Link to="/reportar" className="text-signal underline">
                notificar la incidencia otra vez
              </Link>{" "}
              o pedírselo al taller.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
