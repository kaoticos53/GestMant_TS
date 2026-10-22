import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetFooter } from "@/components/ui/sheet";
import { ClipboardList } from "lucide-react";
import { MaintenanceDialog } from "../dialogs/MaintenanceDialog";
import { useEquipmentDerivedData } from "../hooks/useEquipmentDerivedData";
import { useEquipmentPdfExport } from "../hooks/useEquipmentPdfExport";
import type { EquipmentDetailSheetProps, RecordDoc } from "../types";
import { DeleteInterventionDialog } from "./detail/DeleteInterventionDialog";
import { EquipmentDataSection } from "./detail/EquipmentDataSection";
import { EquipmentMaintenanceSection } from "./detail/EquipmentMaintenanceSection";
import { EquipmentManualsSection } from "./detail/EquipmentManualsSection";
import { EquipmentPartsSection } from "./detail/EquipmentPartsSection";
import { EquipmentRequestsSection } from "./detail/EquipmentRequestsSection";
import { EquipmentSheetHeader } from "./detail/EquipmentSheetHeader";

/**
 * Ficha técnica lateral de un equipo: datos de alta, manuales, historial de
 * mantenimiento, repuestos compatibles y peticiones asociadas.
 */
export function EquipmentDetailSheet({
  item,
  openedAt,
  parts,
  requests,
  maintenance = [],
  manuals = { assigned: [], byModel: [] },
  canManage = false,
  canAddManual = false,
  rights = { manage: false, userId: null },
  onAddManual = () => {},
  onViewManual = () => {},
  onEditManual = () => {},
  onDeleteManual = () => {},
  onClose,
  onViewRequests,
  children,
}: EquipmentDetailSheetProps) {
  const [formTarget, setFormTarget] = useState<{
    record: RecordDoc | null;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RecordDoc | null>(null);

  const { related, shownRequests, compatible, review } =
    useEquipmentDerivedData({
      item,
      parts,
      requests,
      maintenance,
    });

  const { exporting, handleExport } = useEquipmentPdfExport({
    item,
    manuals,
    related,
    requests,
    maintenance,
  });

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl lg:max-w-2xl">
        <EquipmentSheetHeader
          item={item}
          openedAt={openedAt}
          compatibleCount={compatible.length}
          relatedCount={related.length}
          reviewState={review.state}
        />

        <div className="grid gap-4 px-4 pb-4 sm:px-6">
          <EquipmentDataSection
            item={item}
            exporting={exporting}
            onExport={handleExport}
          />

          <EquipmentMaintenanceSection
            item={item}
            maintenance={maintenance}
            requests={requests}
            review={review}
            canManage={canManage}
            onNewRecord={() => setFormTarget({ record: null })}
            onEditRecord={(record) => setFormTarget({ record })}
            onDeleteRecord={setDeleteTarget}
          />

          <EquipmentManualsSection
            item={item}
            manuals={manuals}
            canAddManual={canAddManual}
            rights={rights}
            onAddManual={onAddManual}
            onViewManual={onViewManual}
            onEditManual={onEditManual}
            onDeleteManual={onDeleteManual}
          />

          <EquipmentPartsSection compatible={compatible} />

          <EquipmentRequestsSection
            equipmentId={item._id}
            relatedCount={related.length}
            shownRequests={shownRequests}
            onViewRequests={onViewRequests}
          />
        </div>

        {formTarget && (
          <MaintenanceDialog
            key={formTarget.record?._id ?? "new"}
            item={item}
            record={formTarget.record}
            requests={requests}
            onClose={() => setFormTarget(null)}
          />
        )}

        <DeleteInterventionDialog
          item={item}
          target={deleteTarget}
          onClose={() => setDeleteTarget(null)}
        />

        <SheetFooter className="border-t border-border/70 bg-background/80 px-4 py-4 sm:px-6">
          <div className="flex w-full flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cerrar
            </Button>
            {related.length > 0 && (
              <Button
                type="button"
                className="gap-2"
                onClick={() => onViewRequests(item._id)}
              >
                <ClipboardList className="size-4" />
                Ver sus peticiones
              </Button>
            )}
          </div>
        </SheetFooter>
        {children}
      </SheetContent>
    </Sheet>
  );
}
