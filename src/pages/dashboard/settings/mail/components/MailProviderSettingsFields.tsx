import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MAIL_PROVIDER_OPTIONS,
  type MailProvider,
  type MailProviderMeta,
} from "@/lib/mail";
import { cn } from "@/lib/utils";
import type { MailFormData, MailServerSettingsDoc } from "../types";

export interface MailProviderSettingsFieldsProps {
  formData: MailFormData;
  settings: MailServerSettingsDoc;
  meta: MailProviderMeta;
  needsKey: boolean;
  needsDomain: boolean;
  needsRelay: boolean;
  needsToken: boolean;
  needsAccount: boolean;
  smtp: { host: string; port: number; tls: string } | null;
  saving: boolean;
  validation: { ok: boolean; error?: string };
  insecureRelay: string | null;
  relayHint: string | null;
  accountHelp: string | null;
  keyStatus: (settings: MailServerSettingsDoc) => string;
  onChangeProvider: (provider: MailProvider) => void;
  onFieldChange: <K extends keyof MailFormData>(
    field: K,
    value: MailFormData[K],
  ) => void;
  onSave: () => void;
}

export function MailProviderSettingsFields({
  formData,
  settings,
  meta,
  needsKey,
  needsDomain,
  needsRelay,
  needsToken,
  needsAccount,
  smtp,
  saving,
  validation,
  insecureRelay,
  relayHint,
  accountHelp,
  keyStatus,
  onChangeProvider,
  onFieldChange,
  onSave,
}: MailProviderSettingsFieldsProps) {
  const {
    provider,
    fromName,
    fromEmail,
    replyTo,
    bcc,
    domain,
    relayUrl,
    smtpUser,
    apiKey,
    relayToken,
    clearApiKey,
    clearRelayToken,
  } = formData;

  return (
    <>
      <div className="mt-4 grid gap-2">
        <Label className="text-sm">Servicio de envío</Label>
        <div
          className="grid gap-2 sm:grid-cols-2"
          role="radiogroup"
          aria-label="Servicio de envío"
        >
          {MAIL_PROVIDER_OPTIONS.map((option) => {
            const active = option.id === provider;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={saving}
                onClick={() => onChangeProvider(option.id)}
                className={cn(
                  "rounded-lg border p-3 text-left transition-colors",
                  active
                    ? "border-primary bg-primary/5"
                    : "border-border/70 hover:bg-muted/40",
                )}
              >
                <p className="text-sm font-medium">{option.label}</p>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                  {option.summary}
                </p>
              </button>
            );
          })}
        </div>
      </div>

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
        {provider === "vly"
          ? "La pasarela firma con su propio remitente; este correo solo se usa si algún día eliges un servicio propio."
          : "Los servicios propios exigen que el remitente sea una dirección verificada en la cuenta."}
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
        {bcc.trim() === ""
          ? "Sin copia oculta: cada correo va solo a sus destinatarios."
          : `Todos los correos del taller se copian también a ${bcc
              .trim()
              .toLowerCase()}, sin que los destinatarios lo vean. Es una sola dirección.`}
      </p>

      {(needsKey || needsDomain || needsRelay || needsAccount) && (
        <div className="mt-4 grid gap-3">
          {needsRelay && (
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
                  onChange={(event) =>
                    onFieldChange("relayUrl", event.target.value)
                  }
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
                      settings.hasRelayToken && !clearRelayToken
                        ? "Guardado · escribe otro para cambiarlo"
                        : "Solo si tu puente lo pide"
                    }
                  />
                  {settings.hasRelayToken && (
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
          )}

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
                onChange={(event) =>
                  onFieldChange("apiKey", event.target.value)
                }
                placeholder={
                  settings.hasKey && !clearApiKey
                    ? "Guardada · escribe otra para cambiarla"
                    : smtp === null
                      ? "Pega la clave de la API"
                      : provider === "gmail"
                        ? "Las 16 letras que da Google"
                        : "La que da el buzón de pruebas"
                }
              />
              {settings.hasKey && (
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
                onChange={(event) =>
                  onFieldChange("domain", event.target.value)
                }
                placeholder="taller.es"
              />
            </div>
          )}

          {smtp !== null && (
            <p className="text-xs leading-5 text-muted-foreground">
              Sale por {smtp.host}:{smtp.port}{" "}
              {smtp.tls === "ssl"
                ? "con TLS directo"
                : smtp.tls === "starttls"
                  ? "cifrado con STARTTLS"
                  : "sin cifrar"}
              , a través del relevo.
            </p>
          )}

          {accountHelp !== null && (
            <p className="text-xs leading-5 text-muted-foreground">
              {accountHelp}
            </p>
          )}

          {insecureRelay !== null && (
            <p className="text-xs leading-5 text-amber-600 dark:text-amber-400">
              {insecureRelay}
            </p>
          )}

          <p className="text-xs leading-5 text-muted-foreground">
            {keyStatus(settings)}
          </p>
        </div>
      )}

      {provider === "vly" && (
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          {keyStatus(settings)}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
        {!validation.ok && (
          <p className="mr-auto text-xs leading-5 text-destructive">
            {validation.error}
          </p>
        )}
        <Button
          type="button"
          disabled={saving || !validation.ok}
          onClick={onSave}
        >
          {saving ? "Guardando..." : "Guardar correo"}
        </Button>
      </div>
    </>
  );
}
