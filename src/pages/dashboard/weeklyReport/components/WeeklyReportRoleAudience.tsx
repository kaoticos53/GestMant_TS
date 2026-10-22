import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { roleBadgeClassName } from "@/lib/roles";
import { formatRecipientsSummary } from "../helpers";
import type { WeeklyReportRoleAudienceProps } from "../types";

export function WeeklyReportRoleAudience({
  roleOptions,
  roleKeys,
  recipients,
  lastSentAt,
  saving,
  onToggleRole,
}: WeeklyReportRoleAudienceProps) {
  return (
    <div className="grid gap-2">
      <Label className="text-sm">A qué roles les llega</Label>
      {roleOptions === undefined ? (
        <Skeleton className="h-24 rounded-lg" />
      ) : (
        <ul className="grid max-h-56 gap-1.5 overflow-y-auto pr-1">
          {roleOptions.map((option) => (
            <li
              key={option.key}
              className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {option.label}
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${roleBadgeClassName(option.key)}`}
                  >
                    {option.key}
                  </span>
                </p>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                  {option.description}
                </p>
              </div>
              <Switch
                checked={roleKeys.includes(option.key)}
                disabled={saving}
                aria-label={`Enviar el resumen a ${option.label}`}
                onCheckedChange={(checked) =>
                  onToggleRole(option.key, checked)
                }
              />
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs leading-5 text-muted-foreground">
        {formatRecipientsSummary(recipients, lastSentAt)}
      </p>
    </div>
  );
}
