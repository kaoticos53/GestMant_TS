import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { api } from "@/convex/_generated/api";
import { usesMailRelay } from "@/lib/mail";
import { useQuery } from "convex/react";
import { Mail } from "lucide-react";
import { MailLogViewer } from "./mail/components/MailLogViewer";
import { MailPathStatusBanner } from "./mail/components/MailPathStatusBanner";
import { MailProviderSettingsFields } from "./mail/components/MailProviderSettingsFields";
import { MailRelayCheckSection } from "./mail/components/MailRelayCheckSection";
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
    validation,
    insecureRelay,
    relayHint,
    accountHelp,
    changeProvider,
    updateField,
    setEnabled,
    handleSave,
    keyStatus,
  } = useMailServerForm(settings);

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
                {formData.enabled
                  ? "Encendido: los avisos y el resumen salen por el servicio configurado."
                  : "Apagado: no se manda ningún correo del taller. Cada intento deja escrito el motivo en su ficha o en su histórico."}
              </p>
            </div>
            <Switch
              checked={formData.enabled}
              disabled={saving}
              aria-label="Correo saliente"
              onCheckedChange={setEnabled}
            />
          </div>

          <MailProviderSettingsFields
            formData={formData}
            settings={settings}
            meta={meta}
            needsKey={needsKey}
            needsDomain={needsDomain}
            needsRelay={needsRelay}
            needsToken={needsToken}
            needsAccount={needsAccount}
            smtp={smtp}
            saving={saving}
            validation={validation}
            insecureRelay={insecureRelay}
            relayHint={relayHint}
            accountHelp={accountHelp}
            keyStatus={keyStatus}
            onChangeProvider={changeProvider}
            onFieldChange={updateField}
            onSave={() => void handleSave()}
          />

          {usesMailRelay(formData.provider) && (
            <MailRelayCheckSection
              checking={checking}
              saving={saving}
              checkState={checkState}
              onCheck={handleCheck}
            />
          )}

          <MailTestSendSection
            defaultToEmail={settings.fromEmail}
            lastTestAt={settings.lastTestAt}
            lastTestOk={settings.lastTestOk}
            lastTestTo={settings.lastTestTo}
            lastTestError={settings.lastTestError}
          />

          <MailLogViewer history={history} />

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
