import type { Id } from "@/convex/_generated/dataModel";
import type { Member, RoleOption } from "../types";
import { CreateUserDialog } from "../dialogs/CreateUserDialog";
import { EditUserDialog } from "../dialogs/EditUserDialog";
import { DeactivateDialog } from "../dialogs/DeactivateDialog";

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
}

/**
 * Agrupador modal para las operaciones de alta, edición y baja de usuarios.
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
    </>
  );
}
