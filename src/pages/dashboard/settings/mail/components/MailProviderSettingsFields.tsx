import type { MailProvider, MailProviderMeta } from "@/lib/mail";
import type { MailFormData, MailServerSettingsDoc } from "../types";
import { CredentialsFields } from "./providerFields/components/CredentialsFields";
import { ProviderActionsBar } from "./providerFields/components/ProviderActionsBar";
import { ProviderSelector } from "./providerFields/components/ProviderSelector";
import { RelayFields } from "./providerFields/components/RelayFields";
import { SenderFields } from "./providerFields/components/SenderFields";

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

  const showAdditionalFields =
    needsKey || needsDomain || needsRelay || needsAccount;

  return (
    <>
      <ProviderSelector
        provider={provider}
        saving={saving}
        onChangeProvider={onChangeProvider}
      />

      <SenderFields
        provider={provider}
        fromName={fromName}
        fromEmail={fromEmail}
        replyTo={replyTo}
        bcc={bcc}
        saving={saving}
        onFieldChange={onFieldChange}
      />

      {showAdditionalFields && (
        <div className="mt-4 grid gap-3">
          {needsRelay && (
            <RelayFields
              relayUrl={relayUrl}
              relayToken={relayToken}
              clearRelayToken={clearRelayToken}
              needsToken={needsToken}
              hasRelayToken={settings.hasRelayToken}
              smtp={smtp}
              relayHint={relayHint}
              saving={saving}
              onFieldChange={onFieldChange}
            />
          )}

          <CredentialsFields
            provider={provider}
            meta={meta}
            smtpUser={smtpUser}
            apiKey={apiKey}
            clearApiKey={clearApiKey}
            domain={domain}
            needsKey={needsKey}
            needsDomain={needsDomain}
            needsAccount={needsAccount}
            hasKey={settings.hasKey}
            smtp={smtp}
            accountHelp={accountHelp}
            insecureRelay={insecureRelay}
            keyStatusText={keyStatus(settings)}
            saving={saving}
            onFieldChange={onFieldChange}
          />
        </div>
      )}

      {provider === "vly" && (
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          {keyStatus(settings)}
        </p>
      )}

      <ProviderActionsBar
        validation={validation}
        saving={saving}
        onSave={onSave}
      />
    </>
  );
}
