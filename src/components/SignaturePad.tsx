import {
  SignaturePadCanvas,
  SignaturePadFooter,
  SignaturePadHeader,
} from "./signaturePad/components";
import type { SignaturePadProps } from "./signaturePad/types";
import { useSignatureCanvas } from "./signaturePad/useSignatureCanvas";

export type { SignaturePadProps };

/**
 * Componente interactivo para captura y validación de firma técnica manuscrita.
 */
export function SignaturePad({
  onSave,
  onClear,
  title = "Firma de Conformidad Técnica",
  description = "Firme en el recuadro para validar la finalización del trabajo.",
  className = "",
  strokeColor = "#0f172a",
  strokeWidth = 2.5,
}: SignaturePadProps) {
  const {
    canvasRef,
    hasDrawn,
    clearCanvas,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleConfirm,
  } = useSignatureCanvas({
    strokeColor,
    strokeWidth,
    onSave,
    onClear,
  });

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-sm ${className}`}
    >
      <SignaturePadHeader
        title={title}
        description={description}
        onClear={clearCanvas}
        canClear={hasDrawn}
      />

      <SignaturePadCanvas
        canvasRef={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />

      {onSave && (
        <SignaturePadFooter
          onConfirm={handleConfirm}
          canConfirm={hasDrawn}
        />
      )}
    </div>
  );
}
