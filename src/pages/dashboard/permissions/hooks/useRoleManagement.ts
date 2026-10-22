import { useCallback, useState } from "react";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/workshop";
import type { DialogState, RoleInfo } from "../types";

export interface UseRoleManagementOptions {
  deleteRoleMutation: (args: { key: string }) => Promise<unknown>;
  onRoleDeleted?: (roleKey: string) => void;
}

export interface UseRoleManagementReturn {
  dialog: DialogState;
  deleting: RoleInfo | null;
  deleteBusy: boolean;
  openNewRole: (template?: RoleInfo) => void;
  openEditRole: (role: RoleInfo) => void;
  openDeleteRole: (role: RoleInfo) => void;
  closeDialog: () => void;
  closeDeleteDialog: () => void;
  confirmDelete: () => Promise<void>;
}

/**
 * Hook para gestionar el ciclo de vida de los diálogos de roles
 * (alta, edición, duplicación) y la confirmación accesible de borrado.
 */
export function useRoleManagement({
  deleteRoleMutation,
  onRoleDeleted,
}: UseRoleManagementOptions): UseRoleManagementReturn {
  const [dialog, setDialog] = useState<DialogState>(null);
  const [deleting, setDeleting] = useState<RoleInfo | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const openNewRole = useCallback((template?: RoleInfo) => {
    setDialog({ mode: "new", template });
  }, []);

  const openEditRole = useCallback((role: RoleInfo) => {
    setDialog({ mode: "edit", role });
  }, []);

  const openDeleteRole = useCallback((role: RoleInfo) => {
    setDeleting(role);
  }, []);

  const closeDialog = useCallback(() => {
    setDialog(null);
  }, []);

  const closeDeleteDialog = useCallback(() => {
    if (!deleteBusy) setDeleting(null);
  }, [deleteBusy]);

  const confirmDelete = useCallback(async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await deleteRoleMutation({ key: deleting.key });
      onRoleDeleted?.(deleting.key);
      toast.success(`Rol «${deleting.label}» borrado`);
      setDeleting(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeleteBusy(false);
    }
  }, [deleting, deleteRoleMutation, onRoleDeleted]);

  return {
    dialog,
    deleting,
    deleteBusy,
    openNewRole,
    openEditRole,
    openDeleteRole,
    closeDialog,
    closeDeleteDialog,
    confirmDelete,
  };
}
