import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { type Capability } from "@/lib/permissions";
import {
  canRestoreDefaults,
  dropRole,
  editableGrants,
  isDirty,
  mergeDraft,
  pendingChanges,
  restoreSystemDefaults,
  toggleGrant,
  type Draft,
  type Grants,
} from "@/lib/permissionsDraft";
import { getErrorMessage } from "@/lib/workshop";
import type { RoleInfo } from "../types";

export interface UsePermissionsMatrixOptions {
  roles: RoleInfo[] | undefined;
  setRolePermissions: (args: { role: string; grants: Grants }) => Promise<unknown>;
}

export interface UsePermissionsMatrixReturn {
  draft: Draft | null;
  saved: Draft | undefined;
  current: Draft | undefined;
  dirty: boolean;
  canRestore: boolean;
  saving: boolean;
  toggle: (roleKey: string, id: Capability) => void;
  restoreDefaults: () => void;
  saveChanges: () => Promise<void>;
  removeRoleFromDraft: (roleKey: string) => void;
  setDraft: React.Dispatch<React.SetStateAction<Draft | null>>;
}

/**
 * Hook para gestionar el estado reactivo del borrador de permisos,
 * detección de cambios pendientes frente a la base de datos y guardado masivo concurrente.
 */
export function usePermissionsMatrix({
  roles,
  setRolePermissions,
}: UsePermissionsMatrixOptions): UsePermissionsMatrixReturn {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  // Lo guardado con los permisos editables (excluyendo el rol admin del sistema)
  const saved = useMemo(
    () => (roles === undefined ? undefined : editableGrants(roles)),
    [roles],
  );

  // El borrador actual fusionado con lo guardado
  const current = useMemo(
    () => (saved === undefined ? undefined : mergeDraft(saved, draft)),
    [saved, draft],
  );

  const dirty = Boolean(draft !== null && saved !== undefined && isDirty(draft, saved));
  const canRestore = Boolean(current !== undefined && canRestoreDefaults(current));

  const toggle = useCallback(
    (roleKey: string, id: Capability) => {
      if (!current) return;
      setDraft(toggleGrant(current, roleKey, id));
    },
    [current],
  );

  const restoreDefaults = useCallback(() => {
    if (!current) return;
    setDraft(restoreSystemDefaults(current));
  }, [current]);

  const saveChanges = useCallback(async () => {
    if (!draft || !saved) return;
    const changes = pendingChanges(draft, saved);
    if (changes.length === 0) {
      setDraft(null);
      return;
    }

    setSaving(true);
    try {
      await Promise.all(
        changes.map((change) =>
          setRolePermissions({ role: change.key, grants: change.grants }),
        ),
      );
      setDraft(null);
      toast.success("Permisos actualizados: ya se aplican a cada rol");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }, [draft, saved, setRolePermissions]);

  const removeRoleFromDraft = useCallback((roleKey: string) => {
    setDraft((prev) => (prev === null ? null : dropRole(prev, roleKey)));
  }, []);

  return {
    draft,
    saved,
    current,
    dirty,
    canRestore,
    saving,
    toggle,
    restoreDefaults,
    saveChanges,
    removeRoleFromDraft,
    setDraft,
  };
}
