import * as React from "react";
import { ScanLine } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  ScannerCameraUnavailable,
  ScannerManualFallback,
  ScannerViewport,
  useBarcodeScannerStream,
  cleanScannedCode,
} from "./barcode";
import type { BarcodeScannerModalProps } from "./barcode";

export type { BarcodeScannerModalProps };

export function BarcodeScannerModal({
  open,
  onOpenChange,
  onScan,
  title = "Escanear Código QR / Barras",
  description = "Apunta la cámara al código del equipo, repuesto o referencia.",
}: BarcodeScannerModalProps) {
  const [manualCode, setManualCode] = React.useState<string>("");
  const {
    videoRef,
    hasCamera,
    hasTorch,
    torchOn,
    errorMessage,
    toggleTorch,
  } = useBarcodeScannerStream({
    open,
    onScan,
    onClose: () => onOpenChange(false),
  });

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = cleanScannedCode(manualCode);
    if (trimmed) {
      onScan(trimmed);
      setManualCode("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden sm:rounded-2xl">
        <DialogHeader className="p-4 pb-2 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <ScanLine className="size-5 text-primary animate-pulse" />
              {title}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="relative aspect-square w-full bg-black flex items-center justify-center overflow-hidden">
          {hasCamera ? (
            <ScannerViewport
              videoRef={videoRef}
              hasTorch={hasTorch}
              torchOn={torchOn}
              onToggleTorch={toggleTorch}
            />
          ) : (
            <ScannerCameraUnavailable errorMessage={errorMessage} />
          )}
        </div>

        <ScannerManualFallback
          manualCode={manualCode}
          onManualCodeChange={setManualCode}
          onSubmit={handleManualSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}
