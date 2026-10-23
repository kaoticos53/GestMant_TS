import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowRight, Loader2, Siren, UserCheck, WifiOff } from "lucide-react";
import { pendingDraftsNotice } from "@/lib/offlineDrafts";
import type { ComponentProps } from "react";
import { DescriptionField } from "./DescriptionField";
import { EquipmentFields } from "./EquipmentFields";
import { ReporterFields } from "./ReporterFields";

interface ReportIncidentFormProps {
  user: { name?: string; email?: string } | null | undefined;
  isAuthenticated: boolean;
  reporterProps: ComponentProps<typeof ReporterFields>;
  equipmentProps: ComponentProps<typeof EquipmentFields>;
  descriptionProps: ComponentProps<typeof DescriptionField>;
  error: string | null;
  busy: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  /**
   * Cómo está la red y qué se ha guardado sin ella. Sin este dato el formulario
   * se porta como siempre —enviar y esperar—, que es lo que quieren las pruebas
   * y cualquier sitio que lo monte sin el enganche del aviso público.
   */
  connectivity?: {
    online: boolean;
    pending: number;
    notice: string | null;
  };
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
  connectivity = { online: true, pending: 0, notice: null },
}: ReportIncidentFormProps) {
  const pendingNotice = pendingDraftsNotice(connectivity.pending);

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
                Sesión iniciada: datos de contacto autocompletados desde tu
                perfil (
                <strong className="font-semibold">
                  {user.name || user.email}
                </strong>
                ). Puedes modificarlos si lo requieres.
              </span>
            </div>
          )}

          {!connectivity.online && (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-xs text-foreground">
              <WifiOff className="size-4 shrink-0 text-amber-600" />
              <span>
                Sin conexión. Puedes redactar el aviso igual: se guarda en este
                dispositivo y se envía solo cuando vuelva la red.
              </span>
            </div>
          )}

          {connectivity.notice && (
            <p
              role="status"
              className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-foreground"
            >
              {connectivity.notice}
            </p>
          )}

          {pendingNotice && (
            <p
              role="status"
              className="rounded-lg border border-border/70 bg-muted/40 px-3.5 py-2.5 text-xs text-muted-foreground"
            >
              {pendingNotice} Se envían solos en cuanto haya red.
            </p>
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
