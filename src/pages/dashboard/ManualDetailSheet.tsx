import { useQuery } from "convex/react";
import { Pencil, Trash2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetFooter } from "@/components/ui/sheet";
import { SharedMailSection } from "@/pages/dashboard/shared/SharedMailSection";
import { manualNeedsHistoryUrls } from "@/lib/manuals";
import { getErrorMessage } from "@/lib/workshop";
import { useState } from "react";
import { toast } from "sonner";
import {
  ManualDetailHeader,
  ManualExportCard,
  ManualFileCard,
  ManualHistoryCard,
  ManualNotesCard,
  exportManualPdf,
  findLinkedEquipment,
} from "./manualDetail";
import type { ManualDetailSheetProps } from "./manualDetail";

export type { ManualDetailSheetProps };

/**
 * La ficha de un manual, en su propio sitio porque se abre desde dos lados: la
 * lista del módulo de manuales y la ficha de un equipo. Lo que enseña —datos,
 * archivo, nota, versiones anteriores, historial y el documento que se exporta—
 * es lo mismo en los dos, así que no puede haber dos copias que se separen.
 */
export function ManualDetailSheet({
  manual,
  equipment,
  canEdit = false,
  canDelete = false,
  onEdit,
  onDelete,
  onClose,
}: ManualDetailSheetProps) {
  const needsHistoryUrls = manualNeedsHistoryUrls(manual);
  const detailed = useQuery(
    api.manuals.detail,
    needsHistoryUrls ? { manualId: manual._id } : "skip",
  );
  const resolvedManual = needsHistoryUrls && detailed ? detailed : manual;

  const linked = findLinkedEquipment(equipment, resolvedManual.equipmentId);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportManualPdf(resolvedManual, linked);
      toast.success("Ficha del manual descargada en PDF");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <ManualDetailHeader manual={resolvedManual} linked={linked} />

        <div className="grid min-w-0 gap-4 px-4 pb-4 sm:px-6 [&>*]:min-w-0">
          <ManualExportCard
            exporting={exporting}
            onExport={() => void handleExport()}
          />
          <ManualFileCard manual={resolvedManual} />
          <ManualNotesCard notes={resolvedManual.notes} />
          <ManualHistoryCard manual={resolvedManual} />
          <SharedMailSection
            destinationType="manual"
            destinationId={resolvedManual._id}
          />
        </div>

        <SheetFooter className="sticky bottom-0 z-20 border-t border-border/70 bg-background/95 px-4 py-4 backdrop-blur-sm sm:px-6">
          <div className="flex w-full flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cerrar
            </Button>
            {canEdit && onEdit && (
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => onEdit(resolvedManual)}
              >
                <Pencil className="size-4" />
                Editar
              </Button>
            )}
            {canDelete && onDelete && (
              <Button
                type="button"
                variant="outline"
                className="gap-2 text-destructive hover:text-destructive"
                onClick={() => onDelete(resolvedManual)}
              >
                <Trash2 className="size-4" />
                Eliminar
              </Button>
            )}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
