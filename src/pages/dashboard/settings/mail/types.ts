import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import type { MailProvider } from "@/lib/mail";

export type MailServerSettingsDoc = NonNullable<
  FunctionReturnType<typeof api.mailSettings.settings>
>;

export interface MailFormData {
  provider: MailProvider;
  enabled: boolean;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  bcc: string;
  domain: string;
  relayUrl: string;
  smtpUser: string;
  apiKey: string;
  relayToken: string;
  clearApiKey: boolean;
  clearRelayToken: boolean;
}

export interface MailCheckState {
  ok: boolean;
  detail?: string;
  error?: string;
  at: number;
  automatic: boolean;
}
