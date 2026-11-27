import type { Id } from "@/convex/_generated/dataModel";
import type { Member, RoleOption } from "../types";
import { CreateUserDialog } from "../dialogs/CreateUserDialog";
import { EditUserDialog } from "../dialogs/EditUserDialog";
import { DeactivateDialog } from "../dialogs/DeactivateDialog";
import { ResetPasswordDialog } from "../dialogs/ResetPasswordDialog";

export interface UsersDialogsProps {
  createOpen: boolean;
  onCreateClose: () => void;
  editing: Member | null;
  onEditClose: () => void;
  roleOptions?: RoleOption[];
  currentUserId?: Id<"users">;
  deactivating: Member | null;
  onDeactivateClose: () => void;
  onConfirmDeactivate: () => Promise<void>;
  resetting?: Member | null;
  onResetClose?: () => void;
}

/**
 * Agrupador modal para las operaciones de alta, edición, baja y contraseña de usuarios.
 */
export function UsersDialogs({
  createOpen,
  onCreateClose,
  editing,
  onEditClose,
  roleOptions = [],
  currentUserId,
  deactivating,
  onDeactivateClose,
  onConfirmDeactivate,
  resetting,
  onResetClose,
}: UsersDialogsProps) {
  return (
    <>
      {createOpen && <CreateUserDialog onClose={onCreateClose} />}
      {editing && (
        <EditUserDialog
          member={editing}
          roleOptions={roleOptions}
          isSelf={editing._id === currentUserId}
          onClose={onEditClose}
        />
      )}
      {deactivating && (
        <DeactivateDialog
          member={deactivating}
          onConfirm={onConfirmDeactivate}
          onClose={onDeactivateClose}
        />
      )}
      {resetting && onResetClose && (
        <ResetPasswordDialog member={resetting} onClose={onResetClose} />
      )}
    </>
  );
}
