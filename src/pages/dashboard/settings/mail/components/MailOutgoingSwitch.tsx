import { Switch } from "@/components/ui/switch";
import { formatOutgoingMailDescription } from "../helpers";

export interface MailOutgoingSwitchProps {
  enabled: boolean;
  disabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
}

/**
 * Interruptor de activación general para el correo saliente del taller.
 */
export function MailOutgoingSwitch({
  enabled,
  disabled,
  onEnabledChange,
}: MailOutgoingSwitchProps) {
  return (
    <div className="mt-4 flex items-start justify-between gap-4 rounded-lg border border-border/70 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium">Correo saliente</p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
          {formatOutgoingMailDescription(enabled)}
        </p>
      </div>
      <Switch
        checked={enabled}
        disabled={disabled}
        aria-label="Correo saliente"
        onCheckedChange={onEnabledChange}
      />
    </div>
  );
}
