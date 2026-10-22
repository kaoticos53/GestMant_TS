import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getBccHelpText, getSenderHelpText } from "../helpers";
import type { SenderFieldsProps } from "../types";

export function SenderFields({
  provider,
  fromName,
  fromEmail,
  replyTo,
  bcc,
  saving,
  onFieldChange,
}: SenderFieldsProps) {
  return (
    <>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="ajustes-correo-remitente-nombre" className="text-sm">
            Nombre del remitente
          </Label>
          <Input
            id="ajustes-correo-remitente-nombre"
            value={fromName}
            maxLength={80}
            disabled={saving}
            onChange={(event) => onFieldChange("fromName", event.target.value)}
            placeholder="Pulso Taller"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ajustes-correo-remitente" className="text-sm">
            Correo del remitente
          </Label>
          <Input
            id="ajustes-correo-remitente"
            type="email"
            value={fromEmail}
            maxLength={200}
            disabled={saving}
            onChange={(event) => onFieldChange("fromEmail", event.target.value)}
            placeholder="avisos@taller.es"
          />
        </div>
      </div>
      <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
        {getSenderHelpText(provider)}
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="ajustes-correo-respuesta" className="text-sm">
            Responder a (opcional)
          </Label>
          <Input
            id="ajustes-correo-respuesta"
            type="email"
            value={replyTo}
            maxLength={200}
            disabled={saving}
            onChange={(event) => onFieldChange("replyTo", event.target.value)}
            placeholder="mantenimiento@taller.es"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ajustes-correo-copia" className="text-sm">
            Copia oculta (opcional)
          </Label>
          <Input
            id="ajustes-correo-copia"
            type="email"
            value={bcc}
            maxLength={200}
            disabled={saving}
            onChange={(event) => onFieldChange("bcc", event.target.value)}
            placeholder="archivo@taller.es"
          />
        </div>
      </div>
      <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
        {getBccHelpText(bcc)}
      </p>
    </>
  );
}
