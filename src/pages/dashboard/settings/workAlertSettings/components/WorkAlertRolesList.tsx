import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { roleBadgeClassName } from "@/lib/roles";
import { formatAudienceSummary } from "../helpers";
import type { WorkAlertRolesListProps } from "../types";

export function WorkAlertRolesList({
  roleOptions,
  selectedRoleKeys,
  audience,
  saving,
  onToggleRole,
}: WorkAlertRolesListProps) {
  return (
    <div className="mt-4 grid gap-3">
      <div className="flex flex-col gap-1">
        <Label className="text-sm">A qué roles les avisa</Label>
        <p className="text-xs leading-5 text-muted-foreground">
          El aviso es un reparto, no un permiso: quien esté en esta lista lo
          ve, coordine incidencias o no. Abrir la ficha que señala sigue
          dependiendo de los permisos de cada rol.
        </p>
      </div>

      {roleOptions === undefined ? (
        <div className="grid gap-2">
          <Skeleton className="h-11 rounded-lg" />
          <Skeleton className="h-11 rounded-lg" />
        </div>
      ) : (
        <ul className="grid max-h-64 gap-1.5 overflow-y-auto pr-1">
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
                checked={selectedRoleKeys.includes(option.key)}
                disabled={saving}
                aria-label={`Avisar a ${option.label}`}
                onCheckedChange={(checked) => onToggleRole(option.key, checked)}
              />
            </li>
          ))}
        </ul>
      )}

      {roleOptions !== undefined && (
        <p className="text-xs leading-5 text-muted-foreground">
          {formatAudienceSummary(audience, roleOptions)}
        </p>
      )}
    </div>
  );
}
