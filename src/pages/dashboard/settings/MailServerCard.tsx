import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { api } from "@/convex/_generated/api";
import {
  MAIL_LOG_LIMIT,
  MAIL_ORIGIN_LABELS,
  MAIL_PROVIDER_META,
  MAIL_PROVIDER_OPTIONS,
  usesMailRelay,
  type MailOrigin,
} from "@/lib/mail";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/workshop";
import { useQuery } from "convex/react";
import { Mail, PlugZap } from "lucide-react";
import { MailPathStatusBanner } from "./mail/components/MailPathStatusBanner";
import { MailTestSendSection } from "./mail/components/MailTestSendSection";
import { useMailPathCheck } from "./mail/hooks/useMailPathCheck";
import { useMailServerForm } from "./mail/hooks/useMailServerForm";

/**
 * El correo del taller, configurable desde Ajustes.
 *
 * Un taller puede seguir con la pasarela de la plataforma o apuntar su correo a
 * su propio servicio —Resend, SendGrid, Mailgun, Brevo— o a un relevo HTTP que
 * hable con su servidor de correo. Aquí se elige, se pone el remitente y se
 * guarda la clave; al lado hay un botón para mandarse una prueba, que es la única
 * forma de saber que la clave y el dominio están bien antes de que haya una
 * incidencia esperando aviso.
 *
 * La clave no vuelve del servidor: la pantalla solo sabe si hay, de dónde sale
 * —guardada o del entorno del deployment— y sus últimos cuatro caracteres. Por
 * eso el campo se deja vacío y solo se envía cuando se escribe algo nuevo; al
 * cambiar de servicio, la clave anterior se descarta y se pide la del nuevo.
 *
 * Dos cosas más, pensadas para saber qué ha pasado sin abrir ficha por ficha: la
 * **copia oculta fija** —todos los correos se copian al archivo del taller, y los
 * destinatarios no lo ven— y el **histórico de los últimos envíos** —con quién,
 * cuándo y qué contestó el servicio, también en los fallos—.
 *
 * Y una tercera que responde a «¿este correo va a salir hoy?» antes de que haga
 * falta: el **estado del camino de envío**. Al abrir el panel —y cada vez que se
 * guarda— se le pide al relevo que se conecte y se autentique con lo guardado,
 * sin mandar nada; y al lado se dice cómo fue el último envío de verdad. Si ese
 * último intento no salió, la tarjeta lo avisa en rojo, con el motivo que dejó
 * apuntado el servicio.
 *
 * Lo que no se puede hacer desde aquí está dicho abajo, sin adornos: el backend
 * no abre conexiones TCP, así que un servidor SMTP se usa a través de un relevo
 * HTTP, y los códigos de acceso siguen saliendo por la pasarela.
 */
export function MailServerCard() {
  const settings = useQuery(api.mailSettings.settings);
  const history = useQuery(api.mailLog.history, { limit: 20 });

  const {
    formData,
    saving,
    meta,
    needsKey,
    needsDomain,
    needsRelay,
    needsToken,
    needsAccount,
    smtp,
    validation: checked,
    insecureRelay,
    relayHint,
    accountHelp,
    changeProvider,
    updateField,
    setEnabled,
    setFromName,
    setFromEmail,
    setReplyTo,
    setBcc,
    setDomain,
    setRelayUrl,
    setSmtpUser,
    setApiKey,
    setRelayToken,
    setClearApiKey,
    setClearRelayToken,
    handleSave,
    keyStatus,
  } = useMailServerForm(settings);

  const {
    provider,
    enabled,
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

  const {
    checking,
    checkState,
    handleCheck,
    lastSend,
    lastSendFailed,
    pathCheckable,
    pathFailed,
    pathLine,
  } = useMailPathCheck(settings, history);

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Mail className="size-4" />
        </span>
        <div className="max-w-2xl">
          <p className="text-sm font-semibold tracking-tight">
            Servidor de correo
          </p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            Por dónde salen los avisos de incidencia —al invitado y al taller— y
            el resumen semanal. Puedes seguir con la pasarela de la plataforma o
            apuntarlo a tu propio servicio: aquí se elige, se pone el remitente
            y se guarda su clave. Las claves no se enseñan una vez guardadas; si
            quieres cambiarla, escribe la nueva y se sustituye. Cada envío queda
            apuntado con sus destinatarios y el resultado, también cuando falla.
          </p>
        </div>
      </div>

      {settings === undefined ? (
        <div className="mt-4 grid gap-2">
          <Skeleton className="h-11 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
        </div>
      ) : (
        <>
          <MailPathStatusBanner
            lastSend={lastSend}
            lastSendFailed={lastSendFailed}
            pathFailed={pathFailed}
            pathCheckable={pathCheckable}
            checkState={checkState}
            pathLine={pathLine}
          />

          <div className="mt-4 flex items-start justify-between gap-4 rounded-lg border border-border/70 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium">Correo saliente</p>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                {enabled
                  ? "Encendido: los avisos y el resumen salen por el servicio configurado."
                  : "Apagado: no se manda ningún correo del taller. Cada intento deja escrito el motivo en su ficha o en su histórico."}
              </p>
            </div>
            <Switch
              checked={enabled}
              disabled={saving}
              aria-label="Correo saliente"
              onCheckedChange={setEnabled}
            />
          </div>

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
                    onClick={() => changeProvider(option.id)}
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
              <Label
                htmlFor="ajustes-correo-remitente-nombre"
                className="text-sm"
              >
                Nombre del remitente
              </Label>
              <Input
                id="ajustes-correo-remitente-nombre"
                value={fromName}
                maxLength={80}
                disabled={saving}
                onChange={(event) => setFromName(event.target.value)}
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
                onChange={(event) => setFromEmail(event.target.value)}
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
                onChange={(event) => setReplyTo(event.target.value)}
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
                onChange={(event) => setBcc(event.target.value)}
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
                      onChange={(event) => setRelayUrl(event.target.value)}
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
                      <Label
                        htmlFor="ajustes-correo-testigo"
                        className="text-sm"
                      >
                        Testigo del relevo (opcional)
                      </Label>
                      <Input
                        id="ajustes-correo-testigo"
                        type="password"
                        autoComplete="off"
                        value={relayToken}
                        maxLength={500}
                        disabled={saving || clearRelayToken}
                        onChange={(event) => setRelayToken(event.target.value)}
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
                              setClearRelayToken(event.target.checked)
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
                    onChange={(event) => setSmtpUser(event.target.value)}
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
                    onChange={(event) => setApiKey(event.target.value)}
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
                          setClearApiKey(event.target.checked)
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
                    onChange={(event) => setDomain(event.target.value)}
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
            {!checked.ok && (
              <p className="mr-auto text-xs leading-5 text-destructive">
                {checked.error}
              </p>
            )}
            <Button
              type="button"
              disabled={saving || !checked.ok}
              onClick={() => void handleSave()}
            >
              {saving ? "Guardando..." : "Guardar correo"}
            </Button>
          </div>

          {usesMailRelay(provider) && (
            <div className="mt-4 rounded-lg border border-dashed border-border px-3 py-3">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <PlugZap className="size-4" /> Comprobar la conexión
              </p>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                Se hace sola al abrir este panel y cada vez que se guarda. Con
                lo que está guardado, le pide al relevo que se conecte y se
                autentique contra el servidor de correo,{" "}
                <strong>sin mandar ningún correo</strong>: ni sale un mensaje ni
                se toca ningún buzón. Sirve para saber si la contraseña es la
                buena —o si el puerto está abierto— antes de mandar la prueba.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  disabled={checking || saving}
                  onClick={handleCheck}
                >
                  <PlugZap className="size-4" />
                  {checking ? "Comprobando..." : "Comprobar ahora"}
                </Button>
                {checkState !== null && (
                  <p
                    className={cn(
                      "text-xs leading-5",
                      checkState.ok
                        ? "text-muted-foreground"
                        : "text-destructive",
                    )}
                  >
                    {checkState.ok
                      ? `Se puede entregar: ${checkState.detail ?? "conexión y autenticación correctas"}.`
                      : (checkState.error ?? "La comprobación no salió.")}
                  </p>
                )}
              </div>
            </div>
          )}

          <MailTestSendSection
            defaultToEmail={settings.fromEmail}
            lastTestAt={settings.lastTestAt}
            lastTestOk={settings.lastTestOk}
            lastTestTo={settings.lastTestTo}
            lastTestError={settings.lastTestError}
          />

          <div className="mt-4 rounded-lg border border-border/70 px-3 py-3">
            <p className="text-sm font-medium">Últimos envíos</p>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
              Qué salió, a quién y qué contestó el servicio. Se conservan los
              últimos {MAIL_LOG_LIMIT}; el contenido de cada correo no se guarda
              aquí, solo el sobre.
            </p>
            {history === undefined ? (
              <Skeleton className="mt-2 h-16 rounded-lg" />
            ) : history.length === 0 ? (
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Todavía no ha salido ningún correo.
              </p>
            ) : (
              <ul className="mt-2 max-h-72 divide-y divide-border/60 overflow-y-auto pr-1">
                {history.map((entry) => (
                  <li key={entry._id} className="py-2 first:pt-0">
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <p className="text-xs font-medium">
                        {MAIL_ORIGIN_LABELS[entry.origin as MailOrigin] ??
                          entry.what}
                      </p>
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                          entry.ok
                            ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                            : "border-destructive/40 text-destructive",
                        )}
                      >
                        {entry.ok ? "Salió" : "No salió"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                      {formatDateTime(entry.at)} · Para: {entry.to.join(", ")}
                      {entry.bcc.length > 0
                        ? ` · Copia oculta: ${entry.bcc.join(", ")}`
                        : ""}
                    </p>
                    <p className="text-xs leading-5 text-muted-foreground">
                      {entry.subject}
                    </p>
                    {!entry.ok && (
                      <p className="mt-0.5 text-xs leading-5 text-destructive">
                        {entry.error ?? "El servicio no dijo por qué."}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            El envío se hace por la API del servicio. Un servidor SMTP no se
            puede hablar directamente desde el backend del taller —no abre
            conexiones TCP—: se usa a través de un relevo HTTP. Por ahí salen
            «Relevo propio», la cuenta de Gmail y el buzón de pruebas de
            Ethereal, que además le mandan al relevo su servidor y su cuenta con
            el propio correo. Los códigos de acceso por correo siguen saliendo
            por la pasarela de la plataforma, no por este servicio.
          </p>
        </>
      )}
    </div>
  );
}
