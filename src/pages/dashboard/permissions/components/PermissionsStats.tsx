import { useMemo } from "react";
import { CAPABILITIES } from "@/lib/permissions";
import { ADMIN_KEY, type Draft } from "@/lib/permissionsDraft";
import type { RoleInfo } from "../types";

export interface PermissionsStatsProps {
  roles: RoleInfo[];
  current: Draft | undefined;
}

/**
 * Resumen estadístico inferior que desglosa el número de capacidades
 * activas frente al total configurable para cada rol editable.
 */
export function PermissionsStats({ roles, current }: PermissionsStatsProps) {
  const editableRoles = useMemo(
    () => roles.filter((role) => role.key !== ADMIN_KEY),
    [roles],
  );

  const totalConfigurable = useMemo(
    () => CAPABILITIES.filter((item) => item.locked !== true).length,
    [],
  );

  if (!current) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {editableRoles.map((role) => {
        const granted = CAPABILITIES.filter(
          (item) => item.locked !== true && current[role.key]?.[item.id],
        ).length;
        return (
          <span key={role.key}>
            {role.label}:{" "}
            <span className="font-medium text-foreground">
              {granted} de {totalConfigurable}
            </span>{" "}
            capacidades concedidas
          </span>
        );
      })}
    </div>
  );
}
