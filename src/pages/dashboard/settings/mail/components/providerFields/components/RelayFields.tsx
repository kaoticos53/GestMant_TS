import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RelayFieldsProps } from "../types";

export function RelayFields({
  relayUrl,
  relayToken,
  clearRelayToken,
  needsToken,
  hasRelayToken,
  smtp,
  relayHint,
  saving,
  onFieldChange,
}: RelayFieldsProps) {
  return (
    <>
      <div className="grid gap-1.5 sm:max-w-md">
        <Label htmlFor="ajustes-correo-relevo" className="text-sm">
          Dirección del relevo
        </Label>
        <Input
          id="ajustes-correo-relevo"
          value={relayUrl}
          maxLength={300}
          disabled={saving}
          onChange={(event) => onFieldChange("relayUrl", event.target.value)}
          placeholder={
            smtp === null
              ? "https://correo.taller.local/enviar"
              : "http://host.docker.internal:8788/enviar"
          }
        />
        <p className="text-xs leading-5 text-muted-foreground">
          {smtp === null
            ? "El puente HTTP que habla con tu servidor de correo. El repositorio incluye uno listo para usar con `npm run mail:relay`."
            : `El puente HTTP que habla por ti con ${smtp.host}:${smtp.port}: el backend del taller no abre conexiones TCP. El repositorio incluye uno listo para usar con \`npm run mail:relay\`.`}
        </p>
        {relayHint !== null && (
          <p className="text-xs leading-5 text-amber-600 dark:text-amber-400">
            {relayHint}
          </p>
        )}
      </div>

      {needsToken && (
        <div className="grid gap-1.5 sm:max-w-md">
          <Label htmlFor="ajustes-correo-testigo" className="text-sm">
            Testigo del relevo (opcional)
          </Label>
          <Input
            id="ajustes-correo-testigo"
            type="password"
            autoComplete="off"
            value={relayToken}
            maxLength={500}
            disabled={saving || clearRelayToken}
            onChange={(event) =>
              onFieldChange("relayToken", event.target.value)
            }
            placeholder={
              hasRelayToken && !clearRelayToken
                ? "Guardado · escribe otro para cambiarlo"
                : "Solo si tu puente lo pide"
            }
          />
          {hasRelayToken && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={clearRelayToken}
                disabled={saving}
                onChange={(event) =>
                  onFieldChange("clearRelayToken", event.target.checked)
                }
              />
              Borrar el testigo guardado al guardar
            </label>
          )}
        </div>
      )}
    </>
  );
}
