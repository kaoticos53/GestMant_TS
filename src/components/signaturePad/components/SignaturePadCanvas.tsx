import type { PointerEvent, RefObject } from "react";

export interface SignaturePadCanvasProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  hasDrawn?: boolean;
  onPointerDown: (e: PointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (e: PointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: (e: PointerEvent<HTMLCanvasElement>) => void;
}

/**
 * Lienzo táctil con captura de puntero y guías visuales de orientación para la firma.
 */
export function SignaturePadCanvas({
  canvasRef,
  hasDrawn = false,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: SignaturePadCanvasProps) {
  return (
    <div className="relative touch-none overflow-hidden rounded-lg border-2 border-dashed border-border/80 bg-white">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Área de firma manuscrita"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="h-44 w-full cursor-crosshair block"
      />

      {/* Línea base y marca de agua sutil de orientación */}
      {!hasDrawn && (
        <div className="pointer-events-none absolute inset-x-8 bottom-8 flex flex-col items-center">
          <div className="h-px w-full bg-zinc-300" />
          <span className="mt-1 text-xs font-medium uppercase tracking-wider text-zinc-500">
            Firma sobre esta línea
          </span>
        </div>
      )}
    </div>
  );
}
