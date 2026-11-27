import { api } from "@/convex/_generated/api";
import {
  effectiveUserRoles,
  fallbackRoleMeta,
  isAdminUser,
  primaryUserRole,
} from "@/lib/roles";
import { useMutation } from "convex/react";
import { useEffect, useRef } from "react";

export interface UserRoleSource {
  _id?: string;
  role?: string;
  roles?: string[];
  isAnonymous?: boolean;
  active?: boolean;
}

export function useEnsureRole(
  user: UserRoleSource | null | undefined,
  permissionsLabel?: string,
) {
  const ensureRole = useMutation(api.members.ensureRole);
  const roleAttempts = useRef(0);
  const roles = effectiveUserRoles(user);
  const role = primaryUserRole(roles);
  const adminOk = isAdminUser(user);
  const needsRole = user !== undefined && user !== null && roles.length === 0;

  useEffect(() => {
    if (!needsRole) {
      roleAttempts.current = 0;
      return;
    }
    let cancelled = false;
    const assignRole = async () => {
      try {
        await ensureRole();
      } catch (error) {
        console.warn("No se pudo asignar el rol:", error);
        roleAttempts.current += 1;
        if (!cancelled && roleAttempts.current < 6) {
          window.setTimeout(() => void assignRole(), 2500);
        }
      }
    };
    void assignRole();
    return () => {
      cancelled = true;
    };
  }, [needsRole, ensureRole]);

  const roleLabel = permissionsLabel ?? fallbackRoleMeta(role).label;

  return {
    role,
    roles,
    roleLabel,
    adminOk,
    needsRole,
  };
}
