import { canDeleteManual, canEditManual } from "@/lib/manuals";
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
  onEdit,
  onPrintLabel,
  onOpenIncident,
  onViewRequests,
  setManualForm,
  setManualDetail,
  setManualDelete,
  closeForm,
  setDeleteTarget,
}: EquipmentModalsProps) {
  const liveDetailItem = detail
    ? (equipment.find((entry) => entry._id === detail.item._id) ?? detail.item)
    : null;

  return (
    <>
      {detail && liveDetailItem && (
        <EquipmentDetailSheet
          item={liveDetailItem}
          openedAt={detail.openedAt}
          parts={parts}
          requests={requests}
          maintenance={maintenanceRecordsFor(liveDetailItem)}
          manuals={manualsOf(liveDetailItem)}
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
          onEdit={onEdit}
          onPrintLabel={onPrintLabel}
          onOpenIncident={onOpenIncident}
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
              canEdit={canEditManual(manualDetail, rights)}
              canDelete={canDeleteManual(manualDetail, rights)}
              onEdit={(manual) => {
                setManualDetail(null);
                setManualForm({ manual, equipmentId: null });
              }}
              onDelete={(manual) => setManualDelete(manual)}
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
