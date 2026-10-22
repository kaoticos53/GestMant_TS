import type { MailOrigin } from "@/lib/mail";

export interface RoleOption {
  key: string;
  label: string;
  description?: string;
}

export interface MailColumn {
  origin: MailOrigin;
  list: "incident" | "weekly" | null;
  short: string;
  fixed?: string;
}

export interface MailAudienceRowProps {
  option: RoleOption;
  incidentKeys: string[];
  weeklyKeys: string[];
  saving: boolean;
  onToggle: (which: "incident" | "weekly", key: string, checked: boolean) => void;
}

export interface MailAudienceFooterNoticesProps {
  incidentNotice: string;
  weeklyNotice: string;
  saving: boolean;
  onSave: () => void;
}
