import { Button } from "@/components/ui/button";
import { Camera, Loader2 } from "lucide-react";
import { LabelInlineBanner } from "./LabelInlineBanner";
import { LabelReviewDialog } from "./LabelReviewDialog";
import {
  useEquipmentLabelScanner,
  type AppliedLabelFields,
} from "./useEquipmentLabelScanner";

export type { AppliedLabelFields } from "./useEquipmentLabelScanner";

interface EquipmentLabelScannerProps {
  isAuthenticated: boolean;
  disabled?: boolean;
  onApply: (fields: AppliedLabelFields) => void;
  onUndo?: () => void;
}

export function EquipmentLabelScanner({
  isAuthenticated,
  disabled = false,
  onApply,
  onUndo,
}: EquipmentLabelScannerProps) {
  const {
    canScan,
    isMobile,
    scanning,
    fileInputRef,
    imageDataUrl,
    extraction,
    draft,
    setDraft,
    reviewOpen,
    setReviewOpen,
    bannerOpen,
    openPicker,
    handleFileSelected,
    confirmDesktopReview,
    selectMobileAlternative,
    confirmMobileBanner,
    undoMobileBanner,
  } = useEquipmentLabelScanner({
    isAuthenticated,
    onApply,
    onUndo,
  });

  if (!canScan) {
    return null;
  }

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) =>
            void handleFileSelected(event.target.files?.[0])
          }
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || scanning}
          onClick={openPicker}
        >
          {scanning ? (
            <Loader2 className="mr-1.5 size-4 animate-spin" />
          ) : (
            <Camera className="mr-1.5 size-4" />
          )}
          {scanning ? "Analizando etiqueta..." : "Escanear etiqueta (IA)"}
        </Button>
      </div>

      {isMobile ? (
        <LabelInlineBanner
          open={bannerOpen}
          imageDataUrl={imageDataUrl}
          extraction={extraction}
          selectedModel={draft.model}
          onSelectAlternative={selectMobileAlternative}
          onConfirm={confirmMobileBanner}
          onUndo={undoMobileBanner}
        />
      ) : (
        <LabelReviewDialog
          open={reviewOpen}
          onOpenChange={setReviewOpen}
          imageDataUrl={imageDataUrl}
          extraction={extraction}
          draft={draft}
          onDraftChange={setDraft}
          onConfirm={confirmDesktopReview}
        />
      )}
    </div>
  );
}
