import { api } from "@/convex/_generated/api";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  formatLabelDescription,
  type EquipmentLabelExtraction,
} from "@/lib/ai";
import { compressImageFile } from "@/lib/imageCompress";
import { getErrorMessage } from "@/lib/workshop";
import { useAction, useQuery } from "convex/react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { preScanBarcodes } from "./barcodePreScan";

export interface AppliedLabelFields {
  brand?: string;
  model?: string;
  serialNumber?: string;
  equipmentKind?: string;
  description?: string;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("No se pudo leer la imagen seleccionada"));
      }
    };
    reader.onerror = () => {
      reject(new Error("No se pudo leer la imagen seleccionada"));
    };
    reader.readAsDataURL(file);
  });
}

function toAppliedFields(
  source: Pick<
    EquipmentLabelExtraction,
    "brand" | "model" | "serialNumber" | "equipmentKind" | "technicalDetails"
  > & { description?: string },
): AppliedLabelFields {
  const description =
    source.description?.trim() ||
    formatLabelDescription({
      equipmentKind: source.equipmentKind,
      technicalDetails: source.technicalDetails,
    });
  return {
    brand: source.brand?.trim() || undefined,
    model: source.model?.trim() || undefined,
    serialNumber: source.serialNumber?.trim() || undefined,
    equipmentKind: source.equipmentKind?.trim() || undefined,
    description,
  };
}

export function useEquipmentLabelScanner({
  isAuthenticated,
  onApply,
  onUndo,
}: {
  isAuthenticated: boolean;
  onApply: (fields: AppliedLabelFields) => void;
  onUndo?: () => void;
}) {
  const isMobile = useIsMobile();
  const availability = useQuery(
    api.ai.availability,
    isAuthenticated ? {} : "skip",
  );
  const extractEquipmentLabel = useAction(api.ai.extractEquipmentLabel);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<EquipmentLabelExtraction | null>(
    null,
  );
  const [draft, setDraft] = useState<AppliedLabelFields>({});
  const [reviewOpen, setReviewOpen] = useState(false);
  const [bannerOpen, setBannerOpen] = useState(false);

  const canScan = Boolean(isAuthenticated && availability?.available);

  const openPicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelected = useCallback(
    async (file: File | undefined) => {
      if (!file || !canScan) return;
      setScanning(true);
      setScanError(null);
      try {
        const [compressed, barcodes] = await Promise.all([
          compressImageFile(file),
          preScanBarcodes(file),
        ]);
        const dataUrl = await readFileAsDataUrl(compressed);
        const result = await extractEquipmentLabel({
          imageDataUrl: dataUrl,
          detectedBarcodes: barcodes.length > 0 ? barcodes : undefined,
        });

        const initialApplied = toAppliedFields(result);
        setImageDataUrl(dataUrl);
        setExtraction(result);
        setDraft(initialApplied);

        if (isMobile) {
          onApply(initialApplied);
          setBannerOpen(true);
          setReviewOpen(false);
        } else {
          setReviewOpen(true);
          setBannerOpen(false);
        }
      } catch (error) {
        const message = getErrorMessage(error);
        setScanError(message);
        toast.error(message);
      } finally {
        setScanning(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [canScan, extractEquipmentLabel, isMobile, onApply],
  );

  const confirmDesktopReview = useCallback(() => {
    onApply(toAppliedFields(draft));
    setReviewOpen(false);
  }, [draft, onApply]);

  const selectMobileAlternative = useCallback(
    (altModel: string) => {
      const next: AppliedLabelFields = { ...draft, model: altModel };
      setDraft(next);
      onApply(toAppliedFields(next));
    },
    [draft, onApply],
  );

  const confirmMobileBanner = useCallback(() => {
    setBannerOpen(false);
  }, []);

  const undoMobileBanner = useCallback(() => {
    setBannerOpen(false);
    setExtraction(null);
    setImageDataUrl(null);
    onUndo?.();
  }, [onUndo]);

  return {
    canScan,
    isMobile,
    scanning,
    scanError,
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
  };
}
