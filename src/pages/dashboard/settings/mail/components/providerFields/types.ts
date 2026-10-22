import type { MailProvider, MailProviderMeta } from "@/lib/mail";
import type { MailFormData } from "../../types";

export interface ProviderSelectorProps {
  provider: MailProvider;
  saving: boolean;
  onChangeProvider: (provider: MailProvider) => void;
}

export interface SenderFieldsProps {
  provider: MailProvider;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  bcc: string;
  saving: boolean;
  onFieldChange: <K extends keyof MailFormData>(
    field: K,
    value: MailFormData[K],
  ) => void;
}

export interface RelayFieldsProps {
  relayUrl: string;
  relayToken: string;
  clearRelayToken: boolean;
  needsToken: boolean;
  hasRelayToken: boolean;
  smtp: { host: string; port: number; tls: string } | null;
  relayHint: string | null;
  saving: boolean;
  onFieldChange: <K extends keyof MailFormData>(
    field: K,
    value: MailFormData[K],
  ) => void;
}

export interface CredentialsFieldsProps {
  provider: MailProvider;
  meta: MailProviderMeta;
  smtpUser: string;
  apiKey: string;
  clearApiKey: boolean;
  domain: string;
  needsKey: boolean;
  needsDomain: boolean;
  needsAccount: boolean;
  hasKey: boolean;
  smtp: { host: string; port: number; tls: string } | null;
  accountHelp: string | null;
  insecureRelay: string | null;
  keyStatusText: string;
  saving: boolean;
  onFieldChange: <K extends keyof MailFormData>(
    field: K,
    value: MailFormData[K],
  ) => void;
}

export interface ProviderActionsBarProps {
  validation: { ok: boolean; error?: string };
  saving: boolean;
  onSave: () => void;
}
