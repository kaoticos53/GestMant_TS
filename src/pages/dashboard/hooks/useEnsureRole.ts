import { api } from "@/convex/_generated/api";
import { DEFAULT_ROLE, fallbackRoleMeta, isAdmin } from "@/lib/roles";
import { useMutation } from "convex/react";
import { useEffect, useRef } from "react";

export interface UserRoleSource {
  _id?: string;
  role?: string;
  isAnonymous?: boolean;
  active?: boolean;
}

export function useEnsureRole(
  user: UserRoleSource | null | undefined,
  permissionsLabel?: string,
) {
  const ensureRole = useMutation(api.members.ensureRole);
  const roleAttempts = useRef(0);
  const role = user?.role ?? DEFAULT_ROLE;
  const adminOk = isAdmin(user?.role);
  const needsRole = user !== undefined && user !== null && user.role === undefined;

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
    roleLabel,
    adminOk,
    needsRole,
  };
}
