import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatPublicCode } from "@/lib/publicCode";
import { ArrowRight, Check } from "lucide-react";
import { Link } from "react-router";

interface ReportIncidentSuccessCardProps {
  code: string;
  nameValue: string;
  sentTo: string | null;
  onReset: () => void;
}

export function ReportIncidentSuccessCard({
  code,
  nameValue,
  sentTo,
  onReset,
}: ReportIncidentSuccessCardProps) {
  const firstName = nameValue.split(" ")[0] || "notificador";

  return (
    <Card className="shadow-md">
      <CardHeader className="text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-700">
          <Check className="size-6" />
        </span>
        <CardTitle className="text-xl">
          Incidencia {formatPublicCode(code)} registrada
        </CardTitle>
        <CardDescription>
          Gracias, {firstName}. El equipo coordinador del taller ha recibido tu
          aviso y se pondrá manos a la obra.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* El código es lo único que hace falta para seguir el caso: se
            enseña para copiarlo, no escondido en un rincón. */}
        <div className="rounded-lg border border-border/70 bg-muted/50 p-3 text-center">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Tu código
          </p>
          <p className="mt-1 select-all font-mono text-lg font-semibold tracking-tight">
            {formatPublicCode(code)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Guárdalo: con él se sigue el caso. Desde la página de inicio puedes
            ver en qué punto va, sin cuenta del taller.
          </p>
        </div>
        {sentTo && (
          <p className="text-center text-xs text-muted-foreground">
            También va en camino a {sentTo}: allí tienes el código y el enlace
            para seguir el caso cuando quieras.
          </p>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild className="gap-2">
            <Link to={`/seguimiento?codigo=${encodeURIComponent(code)}`}>
              Seguir esta incidencia
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button variant="outline" onClick={onReset}>
            Reportar otra incidencia
          </Button>
          <Button variant="ghost" asChild>
            <Link to="/">Volver al inicio</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
