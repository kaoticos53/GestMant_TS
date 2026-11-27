import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetFooter } from "@/components/ui/sheet";
import { SharedMailSection } from "@/pages/dashboard/shared/SharedMailSection";
import { richDocToPlainText } from "@/lib/richDoc";
import {
  INCIDENT_STATUS_META,
  formatDate,
  type IncidentStatus,
} from "@/lib/workshop";
import { ArchiveX, ClipboardList, Pencil, Printer, Siren } from "lucide-react";
import { MaintenanceDialog } from "../dialogs/MaintenanceDialog";
import {
  DecommissionEquipmentDialog,
  ReturnLoanDialog,
} from "../dialogs/DecommissionEquipmentDialog";
import { useEquipmentDerivedData } from "../hooks/useEquipmentDerivedData";
import { useEquipmentPdfExport } from "../hooks/useEquipmentPdfExport";
import type { EquipmentDetailSheetProps, RecordDoc } from "../types";
import { DeleteInterventionDialog } from "./detail/DeleteInterventionDialog";
import { EquipmentDataSection } from "./detail/EquipmentDataSection";
import { EquipmentMaintenanceSection } from "./detail/EquipmentMaintenanceSection";
import { EquipmentManualsSection } from "./detail/EquipmentManualsSection";
import { EquipmentMovementsSection } from "./detail/EquipmentMovementsSection";
import { EquipmentOperationalSection } from "./detail/EquipmentOperationalSection";
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
  onEdit,
  onPrintLabel,
  onOpenIncident,
  onClose,
  onViewRequests,
  children,
}: EquipmentDetailSheetProps) {
  const [formTarget, setFormTarget] = useState<{
    record: RecordDoc | null;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RecordDoc | null>(null);
  const [decommOpen, setDecommOpen] = useState(false);
  const [returnLoanOpen, setReturnLoanOpen] = useState(false);

  const { related, shownRequests, incidents, compatible, review } =
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

        <div className="grid min-w-0 gap-4 px-4 pb-4 sm:px-6 [&>*]:min-w-0">
          <EquipmentOperationalSection
            item={item}
            canManage={canManage}
            onRequestReturnLoan={() => setReturnLoanOpen(true)}
          />

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

          {incidents.length > 0 && (
            <section className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
              <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Siren className="size-3.5" />
                Incidencias de este equipo ({incidents.length})
              </h3>
              <ul className="mt-2.5 divide-y divide-border/60">
                {incidents.slice(0, 6).map((inc) => {
                  const statusMeta =
                    INCIDENT_STATUS_META[inc.status as IncidentStatus];
                  const summary = richDocToPlainText(inc.description).trim();
                  return (
                    <li
                      key={inc._id}
                      className="flex items-start justify-between gap-3 py-2 first:pt-1 last:pb-0"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {onOpenIncident ? (
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onOpenIncident(inc._id);
                              }}
                              className="font-mono text-xs font-semibold text-signal underline-offset-2 hover:underline"
                            >
                              {inc.reference}
                            </button>
                          ) : (
                            <span className="font-mono text-xs font-semibold">
                              {inc.reference}
                            </span>
                          )}
                          {statusMeta && (
                            <Badge
                              variant="outline"
                              className={statusMeta.badgeClassName}
                            >
                              {statusMeta.label}
                            </Badge>
                          )}
                        </div>
                        {summary && (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {summary}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {formatDate(inc.reportedAt)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <EquipmentMovementsSection equipmentId={item._id} />

          <SharedMailSection
            destinationType="equipment"
            destinationId={item._id}
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

        <SheetFooter className="sticky bottom-0 z-20 border-t border-border/70 bg-background/95 px-4 py-4 backdrop-blur-sm sm:px-6">
          <div className="flex w-full flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cerrar
            </Button>
            {onPrintLabel && (
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => onPrintLabel(item)}
              >
                <Printer className="size-4" />
                Etiqueta
              </Button>
            )}
            {canManage && onEdit && (
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => onEdit(item)}
              >
                <Pencil className="size-4" />
                Editar
              </Button>
            )}
            {canManage &&
              item.decommissionDate === undefined &&
              !item.currentLoan && (
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => setDecommOpen(true)}
                >
                  <ArchiveX className="size-4" />
                  Dar de baja
                </Button>
              )}
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
        <DecommissionEquipmentDialog
          open={decommOpen}
          onOpenChange={setDecommOpen}
          item={item}
          parts={parts}
        />
        <ReturnLoanDialog
          open={returnLoanOpen}
          onOpenChange={setReturnLoanOpen}
          item={item}
        />
        {children}
      </SheetContent>
    </Sheet>
  );
}
