import type { Member } from "../types";
import { CreateUserDialog } from "../dialogs/CreateUserDialog";
import { EditUserDialog } from "../dialogs/EditUserDialog";
import { DeactivateDialog } from "../dialogs/DeactivateDialog";

export interface UsersDialogsProps {
  createOpen: boolean;
  onCreateClose: () => void;
  editing: Member | null;
  onEditClose: () => void;
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
  deactivating,
  onDeactivateClose,
  onConfirmDeactivate,
}: UsersDialogsProps) {
  return (
    <>
      {createOpen && <CreateUserDialog onClose={onCreateClose} />}
      {editing && <EditUserDialog member={editing} onClose={onEditClose} />}
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
