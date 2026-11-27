import { canDeleteManual, canEditManual, type ManualRights } from "@/lib/manuals";
import { ManualDeleteDialog } from "../../ManualDeleteDialog";
import { ManualDetailSheet } from "../../ManualDetailSheet";
import { ManualFormDialog } from "../../ManualFormDialog";
import type { EquipmentDoc, ManualDoc } from "../types";

export interface ManualsModalsProps {
  detail: ManualDoc | null;
  onCloseDetail: () => void;
  onEditDetail?: (manual: ManualDoc) => void;
  onDeleteDetail?: (manual: ManualDoc) => void;
  formTarget: { manual: ManualDoc | null } | null;
  onCloseForm: () => void;
  deleteTarget: ManualDoc | null;
  onCloseDelete: () => void;
  equipment: EquipmentDoc[];
  canManage: boolean;
  rights?: ManualRights;
}

export function ManualsModals({
  detail,
  onCloseDetail,
  onEditDetail,
  onDeleteDetail,
  formTarget,
  onCloseForm,
  deleteTarget,
  onCloseDelete,
  equipment,
  canManage,
  rights = { manage: canManage, userId: null },
}: ManualsModalsProps) {
  return (
    <>
      {detail && (
        <ManualDetailSheet
          manual={detail}
          equipment={equipment}
          canEdit={canEditManual(detail, rights)}
          canDelete={canDeleteManual(detail, rights)}
          onEdit={onEditDetail}
          onDelete={onDeleteDetail}
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
