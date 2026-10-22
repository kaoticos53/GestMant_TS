import { ManualDeleteDialog } from "../../ManualDeleteDialog";
import { ManualDetailSheet } from "../../ManualDetailSheet";
import { ManualFormDialog } from "../../ManualFormDialog";
import type { EquipmentDoc, ManualDoc } from "../types";

export interface ManualsModalsProps {
  detail: ManualDoc | null;
  onCloseDetail: () => void;
  formTarget: { manual: ManualDoc | null } | null;
  onCloseForm: () => void;
  deleteTarget: ManualDoc | null;
  onCloseDelete: () => void;
  equipment: EquipmentDoc[];
  canManage: boolean;
}

export function ManualsModals({
  detail,
  onCloseDetail,
  formTarget,
  onCloseForm,
  deleteTarget,
  onCloseDelete,
  equipment,
  canManage,
}: ManualsModalsProps) {
  return (
    <>
      {detail && (
        <ManualDetailSheet
          manual={detail}
          equipment={equipment}
          onClose={onCloseDetail}
        />
      )}

      {formTarget && (
        <ManualFormDialog
          key={formTarget.manual?._id ?? "nuevo"}
          manual={formTarget.manual}
          equipment={equipment}
          canManage={canManage}
          onClose={onCloseForm}
        />
      )}

      {deleteTarget && (
        <ManualDeleteDialog
          manual={deleteTarget}
          onClose={onCloseDelete}
          onDeleted={onCloseDetail}
        />
      )}
    </>
  );
}
