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
  mailCredentialsWarning,
  usesMailRelay,
  validateMailSettings,
  type MailOrigin,
  type MailProvider,
} from "@/lib/mail";
import { cn } from "@/lib/utils";
import { formatDateTime, getErrorMessage } from "@/lib/workshop";
import { useAction, useMutation, useQuery } from "convex/react";
import { Activity, Mail, PlugZap, Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

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
  const save = useMutation(api.mailSettings.save);
  const sendTest = useAction(api.mailSettings.sendTest);
  const checkMail = useAction(api.mailSettings.check);

  const [provider, setProvider] = useState<MailProvider>("vly");
  const [enabled, setEnabled] = useState(true);
  const [fromName, setFromName] = useState("Pulso Taller");
  const [fromEmail, setFromEmail] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [bcc, setBcc] = useState("");
  const [domain, setDomain] = useState("");
  const [relayUrl, setRelayUrl] = useState("");
  const [smtpUser, setSmtpUser] = useState("");
  // Secretos: solo lo que se escribe ahora. Vacío = «conserva el guardado».
  const [apiKey, setApiKey] = useState("");
  const [relayToken, setRelayToken] = useState("");
  const [clearApiKey, setClearApiKey] = useState(false);
  const [clearRelayToken, setClearRelayToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);
  // Lo que dijo la comprobación previa: no se guarda en ningún sitio porque no
  // ha salido ningún correo; vale mientras se mira la pantalla.
  const [checking, setChecking] = useState(false);
  const [checkState, setCheckState] = useState<{
    ok: boolean;
    detail?: string;
    error?: string;
    at: number;
    automatic: boolean;
  } | null>(null);

  // El formulario se rellena con lo guardado en cuanto llega, una sola vez:
  // mientras se edita no se pisa (la consulta sigue viva y puede refrescarse
  // por detrás).
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || settings === undefined) return;
    seeded.current = true;
    setProvider(settings.provider);
    setEnabled(settings.enabled);
    setFromName(settings.fromName);
    setFromEmail(settings.fromEmail);
    setReplyTo(settings.replyTo);
    setBcc(settings.bcc);
    setDomain(settings.domain);
    setRelayUrl(settings.relayUrl);
    setSmtpUser(settings.smtpUser);
    setTestTo(settings.fromEmail);
  }, [settings]);

  const meta = MAIL_PROVIDER_META[provider];
  const needsKey = meta.fields.includes("apiKey");
  const needsDomain = meta.fields.includes("domain");
  const needsRelay = meta.fields.includes("relayUrl");
  const needsToken = meta.fields.includes("relayToken");
  const needsAccount = meta.fields.includes("smtpUser");
  const smtp = meta.smtp;

  const checked = validateMailSettings({
    provider,
    enabled,
    fromName,
    fromEmail,
    replyTo,
    bcc,
    domain,
    relayUrl,
    smtpUser,
  });
  const insecureRelay = mailCredentialsWarning({ provider, relayUrl });

  /**
   * Lo que hay que saber antes de rellenar: ni Gmail ni Ethereal se explican
   * solos. De Google se cuenta lo de la contraseña de aplicación —la de la
   * cuenta no vale— y lo del remitente; del buzón de pruebas, dónde se crea y
   * dónde se leen los correos, que es lo único que tiene.
   */
  const accountHelp =
    provider === "gmail"
      ? "Google no acepta la contraseña de la cuenta: hay que activar la verificación en dos pasos y crear una contraseña de aplicación de 16 letras en la cuenta de Google. El remitente tiene que ser esa misma cuenta, o una dirección que la cuenta tenga verificada, o Google reescribirá la cabecera."
      : provider === "ethereal"
        ? "Ethereal es un buzón de mentira, para probar sin molestar a nadie: se crea una cuenta gratis en ethereal.email y sus mensajes se leen en ethereal.email/messages. Lo que se mande desde aquí no llega a ningún buzón real."
        : null;

  /** Cambiar de servicio descarta la clave del anterior: no sirve para este. */
  const changeProvider = (next: MailProvider) => {
    if (next === provider) return;
    setProvider(next);
    setApiKey("");
    setRelayToken("");
    setClearApiKey(false);
    setClearRelayToken(false);
  };

  const handleSave = async () => {
    if (!checked.ok) return;
    setSaving(true);
    try {
      await save({
        provider,
        enabled,
        fromName,
        fromEmail,
        replyTo,
        bcc,
        domain,
        relayUrl,
        smtpUser,
        ...(apiKey.trim() === "" ? {} : { apiKey: apiKey.trim() }),
        ...(clearApiKey ? { clearApiKey: true } : {}),
        ...(relayToken.trim() === "" ? {} : { relayToken: relayToken.trim() }),
        ...(clearRelayToken ? { clearRelayToken: true } : {}),
      });
      setApiKey("");
      setRelayToken("");
      setClearApiKey(false);
      setClearRelayToken(false);
      toast.success("Ajustes del correo guardados");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  /**
   * Pide al relevo que se conecte y se autentique contra el servidor de correo,
   * con lo que hay guardado y **sin mandar nada**. Si la pantalla tiene cambios
   * sin guardar, se comprueba lo guardado: la comprobación la hace el relevo, no
   * el navegador.
   *
   * La llama sola el efecto de abajo —al abrir el panel y al guardar— y también
   * el botón, para repetirla sin salir de aquí. El resultado anterior se queda a
   * la vista mientras se repite, para que la línea no parpadee.
   */
  const runCheck = useCallback(
    async (automatic: boolean) => {
      setChecking(true);
      try {
        const result = await checkMail({});
        setCheckState({
          ok: result.ok,
          ...(result.detail === undefined ? {} : { detail: result.detail }),
          ...(result.error === undefined ? {} : { error: result.error }),
          at: Date.now(),
          automatic,
        });
      } catch (error) {
        setCheckState({
          ok: false,
          error: getErrorMessage(error),
          at: Date.now(),
          automatic,
        });
      } finally {
        setChecking(false);
      }
    },
    [checkMail],
  );

  /**
   * El camino de envío se comprueba solo. Se lanza al abrir el panel y cada vez
   * que cambia lo guardado —al guardar, no al teclear—: es justo cuando cambia
   * el camino. Sin correo encendido, o con un servicio que va por su API, no hay
   * nada que comprobar y no se molesta al relevo.
   */
  const checkedPath = useRef<string | null>(null);
  useEffect(() => {
    if (settings === undefined) return;
    if (!settings.enabled || !usesMailRelay(settings.provider)) return;
    const key = [
      settings.provider,
      settings.relayUrl,
      settings.smtpUser,
      settings.hasKey,
      settings.hasRelayToken,
      settings.updatedAt ?? 0,
    ].join("|");
    if (checkedPath.current === key) return;
    checkedPath.current = key;
    void runCheck(true);
  }, [settings, runCheck]);

  const handleCheck = () => void runCheck(false);

  const handleTest = async () => {
    const to = testTo.trim() === "" ? fromEmail.trim() : testTo.trim();
    setTesting(true);
    try {
      const result = await sendTest({ to });
      if (result.ok) {
        toast.success(`Correo de prueba enviado a ${to}`);
      } else {
        toast.error(result.error ?? "El envío de prueba no salió");
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setTesting(false);
    }
  };

  /**
   * Cómo está la clave del servicio elegido, sin enseñarla. Se pasa lo guardado
   * en vez de leerlo de fuera porque la consulta puede estar cargando: aquí
   * dentro ya se sabe que llegó.
   */
  const keyStatus = (saved: NonNullable<typeof settings>) => {
    if (provider === "vly") {
      return saved.envConfigured
        ? `La pasarela usa la clave del deployment (${saved.envVar}).`
        : `La pasarela necesita ${saved.envVar} en el deployment: sin ella no sale ningún correo.`;
    }
    const secret = meta.secretLabel ?? "La clave";
    if (saved.keySource === "guardada") {
      return `${secret}: hay una guardada (${saved.keyHint}).`;
    }
    if (saved.keySource === "entorno") {
      return `${secret}: no hay guardada; se usa la del servidor (${saved.envVar}).`;
    }
    if (saved.envVar === null) {
      return `${secret}: guárdala aquí; este servicio no se configura por variable del servidor.`;
    }
    return `${secret}: guárdala aquí o define ${saved.envVar} en el servidor.`;
  };

  /**
   * El estado del camino de envío, en dos líneas: lo que pasó en el último envío
   * de verdad —eso sí queda apuntado en el histórico— y lo que contesta el
   * relevo ahora mismo. Describe lo **guardado**, que es por donde saldría el
   * próximo correo, aunque el formulario tenga cambios sin guardar.
   */
  const lastSend = history === undefined ? null : (history[0] ?? null);
  const lastSendFailed = lastSend !== null && !lastSend.ok;
  const savedPath = settings === undefined ? null : settings;
  const pathCheckable = savedPath !== null && usesMailRelay(savedPath.provider);
  const pathFailed =
    savedPath !== null &&
    savedPath.enabled &&
    pathCheckable &&
    checkState !== null &&
    !checkState.ok;
  const pathLine =
    savedPath === null
      ? ""
      : !savedPath.enabled
        ? "Camino de envío: el correo está apagado, así que no hay nada que entregar."
        : !pathCheckable
          ? `Camino de envío: ${MAIL_PROVIDER_META[savedPath.provider].label} se comprueba mandando un correo; su API no dice nada sin enviar.`
          : checking
            ? "Camino de envío: comprobando el relevo…"
            : checkState === null
              ? "Camino de envío: sin comprobar todavía."
              : checkState.ok
                ? `Camino de envío: el relevo responde y acepta las credenciales — ${checkState.detail ?? "conexión y autenticación correctas"} (${formatDateTime(checkState.at)}).`
                : `Camino de envío: el relevo no supera la comprobación — ${checkState.error ?? "sin motivo apuntado"} (${formatDateTime(checkState.at)}).`;

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
          <div
            aria-live="polite"
            className={cn(
              "mt-4 rounded-lg border px-3 py-2.5",
              lastSendFailed || pathFailed
                ? "border-destructive/50 bg-destructive/5"
                : "border-border/70",
            )}
          >
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <Activity className="size-4" /> Estado del camino de envío
            </p>
            <ul className="mt-1 grid gap-0.5 text-xs leading-5">
              <li
                className={cn(
                  lastSendFailed
                    ? "font-medium text-destructive"
                    : "text-muted-foreground",
                )}
              >
                {lastSend === null
                  ? "Último envío: todavía no ha salido ninguno."
                  : lastSendFailed
                    ? `Último envío: no salió el ${formatDateTime(lastSend.at)} (${
                        MAIL_ORIGIN_LABELS[lastSend.origin as MailOrigin] ??
                        lastSend.what
                      }): ${lastSend.error ?? "el servicio no dijo por qué"}.`
                    : `Último envío: salió el ${formatDateTime(lastSend.at)} (${
                        MAIL_ORIGIN_LABELS[lastSend.origin as MailOrigin] ??
                        lastSend.what
                      }).`}
              </li>
              <li
                className={cn(
                  pathFailed
                    ? "font-medium text-destructive"
                    : pathCheckable && checkState?.ok === true
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground",
                )}
              >
                {pathLine}
              </li>
            </ul>
            {lastSendFailed && (
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                El intento quedó apuntado en «Últimos envíos». La comprobación
                del camino se repite cada vez que se abre este panel; si ya está
                bien, manda una prueba para dejar constancia.
              </p>
            )}
          </div>

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
                      placeholder="https://correo.taller.local/enviar"
                    />
                    <p className="text-xs leading-5 text-muted-foreground">
                      {smtp === null
                        ? "El puente HTTP que habla con tu servidor de correo. El repositorio incluye uno listo para usar con `npm run mail:relay`."
                        : `El puente HTTP que habla por ti con ${smtp.host}:${smtp.port}: el backend del taller no abre conexiones TCP. El repositorio incluye uno listo para usar con \`npm run mail:relay\`.`}
                    </p>
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

          <div className="mt-4 rounded-lg border border-dashed border-border px-3 py-3">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <Send className="size-4" /> Probar el envío
            </p>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
              Manda un correo de prueba ahora, con lo guardado, a la dirección
              que escribas. No toca ninguna incidencia ni entra en el resumen.
            </p>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <div className="grid min-w-[14rem] flex-1 gap-1.5 sm:max-w-sm">
                <Label htmlFor="ajustes-correo-prueba" className="text-xs">
                  Dirección de la prueba
                </Label>
                <Input
                  id="ajustes-correo-prueba"
                  type="email"
                  value={testTo}
                  maxLength={200}
                  disabled={testing}
                  onChange={(event) => setTestTo(event.target.value)}
                  placeholder="tu-correo@taller.es"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={testing || testTo.trim() === ""}
                onClick={() => void handleTest()}
              >
                <Send className="size-4" />
                {testing ? "Enviando..." : "Enviar prueba"}
              </Button>
            </div>
            {settings.lastTestAt !== null && (
              <p
                className={cn(
                  "mt-2 text-xs leading-5",
                  settings.lastTestOk
                    ? "text-muted-foreground"
                    : "text-destructive",
                )}
              >
                {settings.lastTestOk
                  ? `Última prueba correcta: ${formatDateTime(
                      settings.lastTestAt,
                    )} a ${settings.lastTestTo ?? "—"}.`
                  : `La última prueba falló el ${formatDateTime(
                      settings.lastTestAt,
                    )}: ${settings.lastTestError ?? "sin motivo apuntado"}`}
              </p>
            )}
          </div>

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
