import { ManualDeleteDialog } from "../../ManualDeleteDialog";
import { ManualDetailSheet } from "../../ManualDetailSheet";
import { ManualFormDialog } from "../../ManualFormDialog";
import { DeleteEquipmentDialog } from "../dialogs/DeleteEquipmentDialog";
import { EquipmentFormDialog } from "../dialogs/EquipmentFormDialog";
import type { EquipmentModalsProps } from "../types";
import { EquipmentDetailSheet } from "./EquipmentDetailSheet";

export function EquipmentModals({
  detail,
  parts,
  requests,
  equipment,
  maintenanceRecordsFor,
  manualsOf,
  canManage,
  canAddManual,
  canManageManuals,
  rights,
  formTarget,
  deleteTarget,
  manualForm,
  manualDetail,
  manualDelete,
  onCloseDetail,
  onViewRequests,
  setManualForm,
  setManualDetail,
  setManualDelete,
  closeForm,
  setDeleteTarget,
}: EquipmentModalsProps) {
  return (
    <>
      {detail && (
        <EquipmentDetailSheet
          item={detail.item}
          openedAt={detail.openedAt}
          parts={parts}
          requests={requests}
          maintenance={maintenanceRecordsFor(detail.item)}
          manuals={manualsOf(detail.item)}
          canManage={canManage}
          canAddManual={canAddManual}
          rights={rights}
          onAddManual={(item) =>
            setManualForm({ manual: null, equipmentId: item._id })
          }
          onViewManual={setManualDetail}
          onEditManual={(manual) =>
            setManualForm({ manual, equipmentId: null })
          }
          onDeleteManual={setManualDelete}
          onClose={onCloseDetail}
          onViewRequests={(equipmentId) => {
            onCloseDetail();
            onViewRequests(equipmentId);
          }}
        >
          {manualDetail && (
            <ManualDetailSheet
              manual={manualDetail}
              equipment={equipment}
              onClose={() => setManualDetail(null)}
            />
          )}

          {manualForm && (
            <ManualFormDialog
              key={manualForm.manual?._id ?? `manual-${manualForm.equipmentId}`}
              manual={manualForm.manual}
              equipment={equipment}
              canManage={canManageManuals}
              fixedEquipmentId={manualForm.equipmentId}
              onClose={() => setManualForm(null)}
            />
          )}

          {manualDelete && (
            <ManualDeleteDialog
              manual={manualDelete}
              onClose={() => setManualDelete(null)}
              onDeleted={() => setManualDetail(null)}
            />
          )}
        </EquipmentDetailSheet>
      )}

      {formTarget && (
        <EquipmentFormDialog
          key={formTarget.item?._id ?? formTarget.initialValues?.model ?? "new"}
          item={formTarget.item}
          initialValues={formTarget.initialValues}
          onClose={closeForm}
        />
      )}

      {deleteTarget && (
        <DeleteEquipmentDialog
          item={deleteTarget}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}
