import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSmtpConnectionHelpText } from "../helpers";
import type { CredentialsFieldsProps } from "../types";

export function CredentialsFields({
  provider,
  meta,
  smtpUser,
  apiKey,
  clearApiKey,
  domain,
  needsKey,
  needsDomain,
  needsAccount,
  hasKey,
  smtp,
  accountHelp,
  insecureRelay,
  keyStatusText,
  saving,
  onFieldChange,
}: CredentialsFieldsProps) {
  const smtpConnectionText = getSmtpConnectionHelpText(smtp);

  return (
    <>
      {needsAccount && (
        <div className="grid gap-1.5 sm:max-w-md">
          <Label htmlFor="ajustes-correo-cuenta" className="text-sm">
            {meta.userLabel}
          </Label>
          <Input
            id="ajustes-correo-cuenta"
            type="email"
            value={smtpUser}
            maxLength={200}
            disabled={saving}
            onChange={(event) =>
              onFieldChange("smtpUser", event.target.value)
            }
            placeholder={
              provider === "gmail"
                ? "taller@gmail.com"
                : "usuario@ethereal.email"
            }
          />
        </div>
      )}

      {needsKey && (
        <div className="grid gap-1.5 sm:max-w-md">
          <Label htmlFor="ajustes-correo-clave" className="text-sm">
            {meta.secretLabel ?? `Clave de ${meta.label}`}
          </Label>
          <Input
            id="ajustes-correo-clave"
            type="password"
            autoComplete="off"
            value={apiKey}
            maxLength={500}
            disabled={saving || clearApiKey}
            onChange={(event) => onFieldChange("apiKey", event.target.value)}
            placeholder={
              hasKey && !clearApiKey
                ? "Guardada · escribe otra para cambiarla"
                : smtp === null
                  ? "Pega la clave de la API"
                  : provider === "gmail"
                    ? "Las 16 letras que da Google"
                    : "La que da el buzón de pruebas"
            }
          />
          {hasKey && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={clearApiKey}
                disabled={saving}
                onChange={(event) =>
                  onFieldChange("clearApiKey", event.target.checked)
                }
              />
              Borrar la clave guardada al guardar
            </label>
          )}
        </div>
      )}

      {needsDomain && (
        <div className="grid gap-1.5 sm:max-w-md">
          <Label htmlFor="ajustes-correo-dominio" className="text-sm">
            Dominio verificado
          </Label>
          <Input
            id="ajustes-correo-dominio"
            value={domain}
            maxLength={200}
            disabled={saving}
            onChange={(event) => onFieldChange("domain", event.target.value)}
            placeholder="taller.es"
          />
        </div>
      )}

      {smtpConnectionText !== null && (
        <p className="text-xs leading-5 text-muted-foreground">
          {smtpConnectionText}
        </p>
      )}

      {accountHelp !== null && (
        <p className="text-xs leading-5 text-muted-foreground">{accountHelp}</p>
      )}

      {insecureRelay !== null && (
        <p className="text-xs leading-5 text-amber-600 dark:text-amber-400">
          {insecureRelay}
        </p>
      )}

      <p className="text-xs leading-5 text-muted-foreground">
        {keyStatusText}
      </p>
    </>
  );
}
