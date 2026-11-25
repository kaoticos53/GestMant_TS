import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Sheet, SheetContent } from "@/components/ui/sheet";
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

        <div className="grid gap-4 px-4 pb-4 sm:px-6">
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
      </SheetContent>
    </Sheet>
  );
}
