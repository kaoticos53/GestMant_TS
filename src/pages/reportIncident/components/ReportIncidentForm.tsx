import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowRight, Loader2, Siren, UserCheck } from "lucide-react";
import type { ComponentProps } from "react";
import { DescriptionField } from "./DescriptionField";
import { EquipmentFields } from "./EquipmentFields";
import { ReporterFields } from "./ReporterFields";

interface ReportIncidentFormProps {
  user: { name?: string; email?: string } | null;
  isAuthenticated: boolean;
  reporterProps: ComponentProps<typeof ReporterFields>;
  equipmentProps: ComponentProps<typeof EquipmentFields>;
  descriptionProps: ComponentProps<typeof DescriptionField>;
  error: string | null;
  busy: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}

export function ReportIncidentForm({
  user,
  isAuthenticated,
  reporterProps,
  equipmentProps,
  descriptionProps,
  error,
  busy,
  onSubmit,
}: ReportIncidentFormProps) {
  return (
    <Card className="shadow-md">
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <span className="flex size-10 items-center justify-center rounded-lg bg-signal/10 text-signal">
            <Siren className="size-5" />
          </span>
          <div>
            <CardTitle className="text-xl">Notificar una incidencia</CardTitle>
            <CardDescription>
              Avisa de una incidencia en un equipo audiovisual. No necesitas
              estar registrado.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-6">
          {isAuthenticated && user && (
            <div className="flex items-center gap-2.5 rounded-lg border border-signal/25 bg-signal/10 px-3.5 py-2.5 text-xs text-foreground">
              <UserCheck className="size-4 shrink-0 text-signal" />
              <span>
                Sesión iniciada: datos de contacto autocompletados desde tu perfil (
                <strong className="font-semibold">
                  {user.name || user.email}
                </strong>
                ). Puedes modificarlos si lo requieres.
              </span>
            </div>
          )}

          {/* Bloque 1: Datos de quien notifica */}
          <ReporterFields {...reporterProps} />

          {/* Bloque 2: Equipo y notificación */}
          <EquipmentFields {...equipmentProps} />

          {/* Bloque 3: Descripción ocupando todo el ancho de la ficha */}
          <DescriptionField {...descriptionProps} />

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full gap-2" disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                Notificar incidencia
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Recibirás un código para seguir el caso desde fuera del taller. Si
            dejas tu correo, te lo enviamos ahí y te avisamos de cada cambio de
            estado.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
