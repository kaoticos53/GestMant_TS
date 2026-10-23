export interface Point {
  x: number;
  y: number;
}

export interface SignaturePadProps {
  onSave?: (blob: Blob, dataUrl: string) => void;
  onClear?: () => void;
  title?: string;
  description?: string;
  className?: string;
  strokeColor?: string;
  strokeWidth?: number;
}
