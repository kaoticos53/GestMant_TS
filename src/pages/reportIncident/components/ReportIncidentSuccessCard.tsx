import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatPublicCode } from "@/lib/publicCode";
import { ArrowRight, Check, Copy } from "lucide-react";
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
  const [copied, setCopied] = useState(false);
  const firstName = nameValue.split(" ")[0] || "notificador";
  const formattedCode = formatPublicCode(code);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(formattedCode);
      setCopied(true);
      toast.success(`Código ${formattedCode} copiado`);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar el código automáticamente.");
    }
  };

  return (
    <Card className="shadow-md">
      <CardHeader className="text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-status-success-surface text-status-success-foreground">
          <Check className="size-6" />
        </span>
        <CardTitle className="text-xl">
          Incidencia {formattedCode} registrada
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
            {formattedCode}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2 gap-1.5"
            onClick={() => void handleCopyCode()}
          >
            {copied ? (
              <Check className="size-3.5 text-status-success-foreground" />
            ) : (
              <Copy className="size-3.5" />
            )}
            {copied ? "Copiado" : "Copiar código"}
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
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
            Notificar otra incidencia
          </Button>
          <Button variant="ghost" asChild>
            <Link to="/">Volver al inicio</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
