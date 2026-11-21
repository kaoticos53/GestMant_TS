import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/convex/_generated/api";
import { getErrorMessage } from "@/lib/workshop";
import {
  DESTINATION_LABELS,
  DESTINATION_TYPES,
  SHARE_CAPABILITY,
  allowsOriginal,
  type MailShareDestinationType,
  type MailShareMode,
} from "@/lib/mailShare";
import { useAction, useQuery } from "convex/react";
import { Loader2, Share2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

/**
 * Comparte un mensaje con el expediente.
 *
 * Solo ofrece destinos para los que el rol tiene capacidad; escribir la
 * referencia (`INC-0004`, `PET-0007`, `OC-0003`, el código del equipo o el
 * título del manual) resuelve la ficha antes de habilitar el botón. La copia no
 * se borra al vaciar la caché del buzón: vive con su ficha.
 *
 * Con la capacidad `createIncidentFromMail`, el diálogo ofrece además crear una
 * incidencia desde el propio mensaje: nace en «Reportada», sin asignar, con el
 * remitente como notificante, y la copia se guarda con ella en el mismo alta.
 */
export function ShareMailDialog({
  messageId,
  open,
  onOpenChange,
}: {
  messageId: string;
  open: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const permissions = useQuery(api.mailShares.canShare);
  const [type, setType] = useState<MailShareDestinationType>("incident");
  const [reference, setReference] = useState("");
  const [mode, setMode] = useState<MailShareMode>("summary");
  const [saving, setSaving] = useState(false);
  const [asIncident, setAsIncident] = useState(false);

  const canCreateIncident =
    permissions?.grants?.createIncidentFromMail === true;

  const options = useMemo(
    () =>
      DESTINATION_TYPES.filter(
        (item) => permissions?.grants?.[SHARE_CAPABILITY[item]] === true,
      ),
    [permissions],
  );

  const effectiveType = options.includes(type) ? type : options[0];
  const target = useQuery(
    api.mailShares.findTarget,
    asIncident || reference.trim() === "" || effectiveType === undefined
      ? "skip"
      : { destinationType: effectiveType, reference },
  );
  const share = useAction(api.mailShares.share);
  const createIncident = useAction(api.mailShares.createIncidentFromMail);

  const submit = async () => {
    if (!asIncident && (effectiveType === undefined || !target)) return;
    setSaving(true);
    try {
      if (asIncident) {
        const result = await createIncident({
          messageId,
          mode,
          clientShareId: crypto.randomUUID(),
        });
        toast.success(
          `Incidencia ${result.reference} creada desde este correo. El remitente queda como notificante.`,
        );
      } else if (effectiveType !== undefined && target) {
        await share({
          messageId,
          destinationType: effectiveType,
          destinationId: target.id,
          mode,
          clientShareId: crypto.randomUUID(),
        });
        toast.success(
          `Correo compartido con ${target.reference}. La copia no se borra al vaciar la caché del buzón.`,
        );
        setReference("");
      }
      onOpenChange(false);
    } catch (reason) {
      toast.error(getErrorMessage(reason));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5">
            <Share2 className="size-4" /> Compartir con el expediente
          </DialogTitle>
          <DialogDescription>
            La copia queda en la ficha y no se borra al vaciar la caché del
            buzón.
          </DialogDescription>
        </DialogHeader>

        {options.length === 0 && !canCreateIncident ? (
          <p className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Tu rol no puede adjuntar correo a ninguna ficha. Pide al
            administrador la capacidad del destino (incidencias, peticiones,
            equipos, manuales o compras).
          </p>
        ) : (
          <div className="space-y-3">
            {canCreateIncident && (
              <label className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={asIncident}
                  onChange={(event) => setAsIncident(event.target.checked)}
                />
                <span>
                  <span className="font-medium">
                    Crear incidencia desde este correo
                  </span>
                  <br />
                  Nace en «Reportada», sin asignar, y el remitente del mensaje
                  queda como notificante. No se adjunta a ninguna ficha que ya
                  exista.
                </span>
              </label>
            )}

            {!asIncident && options.length > 0 && (
              <>
                <label className="block text-xs font-medium">
                  Destino
                  <select
                    className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    value={effectiveType}
                    onChange={(event) => {
                      setType(event.target.value as MailShareDestinationType);
                      setMode("summary");
                    }}
                  >
                    {options.map((item) => (
                      <option key={item} value={item}>
                        {DESTINATION_LABELS[item]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-xs font-medium">
                  Referencia
                  <input
                    className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    value={reference}
                    placeholder="INC-0004, PET-0007, OC-0003, EQ-001…"
                    onChange={(event) => setReference(event.target.value)}
                  />
                </label>
                {reference.trim() !== "" && target === null && (
                  <p className="text-xs text-destructive">
                    No hay ninguna ficha con esa referencia.
                  </p>
                )}
              </>
            )}

            <fieldset className="space-y-1.5">
              <legend className="text-xs font-medium">Qué se guarda</legend>
              <label className="flex items-start gap-2 text-xs">
                <input
                  type="radio"
                  name="mail-share-mode"
                  checked={mode === "summary"}
                  onChange={() => setMode("summary")}
                />
                <span>
                  Resumen: asunto, remitente, fecha y un extracto. No guarda
                  adjuntos.
                </span>
              </label>
              {(asIncident ||
                (effectiveType !== undefined &&
                  allowsOriginal(effectiveType))) && (
                <label className="flex items-start gap-2 text-xs">
                  <input
                    type="radio"
                    name="mail-share-mode"
                    checked={mode === "original"}
                    onChange={() => setMode("original")}
                  />
                  <span>
                    Original: cuerpo y adjuntos. El mensaje debe estar abierto
                    en el visor.
                  </span>
                </label>
              )}
              {!asIncident && effectiveType === "manual" && (
                <p className="text-xs text-muted-foreground">
                  Los manuales solo admiten el resumen del correo.
                </p>
              )}
            </fieldset>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={
              saving ||
              (!asIncident &&
                (options.length === 0 ||
                  effectiveType === undefined ||
                  !target))
            }
            onClick={() => void submit()}
          >
            {saving && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
            {asIncident ? "Crear incidencia" : "Compartir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
