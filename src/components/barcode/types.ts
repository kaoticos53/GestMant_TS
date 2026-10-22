import type React from "react";

export interface DetectedBarcode {
  rawValue: string;
  format: string;
}

export interface BarcodeDetectorInstance {
  detect(source: ImageBitmapSource): Promise<DetectedBarcode[]>;
}

export interface BarcodeDetectorConstructor {
  new (options?: { formats: string[] }): BarcodeDetectorInstance;
  getSupportedFormats?: () => Promise<string[]>;
}

export interface BarcodeScannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (code: string) => void;
  title?: string;
  description?: string;
}

export interface ScannerViewportProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  hasTorch: boolean;
  torchOn: boolean;
  onToggleTorch: () => void;
}

export interface ScannerCameraUnavailableProps {
  errorMessage: string | null;
}

export interface ScannerManualFallbackProps {
  manualCode: string;
  onManualCodeChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}
