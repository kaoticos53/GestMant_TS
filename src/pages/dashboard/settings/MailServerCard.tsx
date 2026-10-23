import { api } from "@/convex/_generated/api";
import { usesMailRelay } from "@/lib/mail";
import { useQuery } from "convex/react";
import {
  MailLogViewer,
  MailNoticeFooter,
  MailOutgoingSwitch,
  MailPathStatusBanner,
  MailProviderSettingsFields,
  MailRelayCheckSection,
  MailServerHeader,
  MailServerSkeleton,
  MailTestSendSection,
} from "./mail/components";
import { useMailPathCheck } from "./mail/hooks/useMailPathCheck";
import { useMailServerForm } from "./mail/hooks/useMailServerForm";

/**
 * El correo del taller, configurable desde Ajustes.
 *
 * Permite seleccionar el proveedor (pasarela, Resend, SendGrid, Mailgun, Brevo, SMTP con relevo),
 * gestionar las credenciales, monitorizar la salud del camino de envío y auditar los últimos envíos.
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
      <MailServerHeader />

      {settings === undefined ? (
        <MailServerSkeleton />
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

          <MailOutgoingSwitch
            enabled={formData.enabled}
            disabled={saving}
            onEnabledChange={setEnabled}
          />

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

          <MailNoticeFooter />
        </>
      )}
    </div>
  );
}
