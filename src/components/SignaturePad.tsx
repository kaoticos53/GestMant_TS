import * as React from "react";
import { Check, PenLine, RotateCcw } from "lucide-react";
import { Button } from "./ui/button";

export interface SignaturePadProps {
  onSave?: (blob: Blob, dataUrl: string) => void;
  onClear?: () => void;
  title?: string;
  description?: string;
  className?: string;
  strokeColor?: string;
  strokeWidth?: number;
}

export function SignaturePad({
  onSave,
  onClear,
  title = "Firma de Conformidad Técnica",
  description = "Firme en el recuadro para validar la finalización del trabajo.",
  className = "",
  strokeColor = "#0f172a",
  strokeWidth = 2.5,
}: SignaturePadProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const isDrawingRef = React.useRef<boolean>(false);
  const lastPointRef = React.useRef<{ x: number; y: number } | null>(null);
  const [hasDrawn, setHasDrawn] = React.useState<boolean>(false);

  // Inicializar o limpiar el lienzo con fondo blanco
  const clearCanvas = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onClear?.();
  }, [onClear]);

  // Redimensionar respetando DPI para máxima nitidez en pantallas Retina de smartphones
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, rect.width, rect.height);
      }
      setHasDrawn(false);
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    const coords = getCanvasCoords(e);
    lastPointRef.current = coords;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.beginPath();
    ctx.arc(coords.x, coords.y, strokeWidth / 2, 0, Math.PI * 2);
    ctx.fillStyle = strokeColor;
    ctx.fill();
    setHasDrawn(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !lastPointRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const coords = getCanvasCoords(e);

    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(coords.x, coords.y);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();

    lastPointRef.current = coords;
    setHasDrawn(true);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (canvas && canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
    isDrawingRef.current = false;
    lastPointRef.current = null;
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;

    const dataUrl = canvas.toDataURL("image/png");
    canvas.toBlob((blob) => {
      if (blob && onSave) {
        onSave(blob, dataUrl);
      }
    }, "image/png");
  };

  return (
    <div className={`flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-sm ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <PenLine className="size-4 text-primary" />
            {title}
          </h4>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={clearCanvas}
          disabled={!hasDrawn}
          className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="size-3.5" />
          Limpiar
        </Button>
      </div>

      {/* Recuadro táctil de firma */}
      <div className="relative touch-none overflow-hidden rounded-lg border-2 border-dashed border-border/80 bg-white">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="h-44 w-full cursor-crosshair block"
        />

        {/* Línea base y marca de agua sutil de orientación */}
        <div className="pointer-events-none absolute inset-x-8 bottom-8 flex flex-col items-center">
          <div className="h-px w-full bg-zinc-300" />
          <span className="mt-1 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
            Firma sobre esta línea
          </span>
        </div>
      </div>

      {onSave && (
        <div className="flex justify-end pt-1">
          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            disabled={!hasDrawn}
            className="gap-1.5"
          >
            <Check className="size-4" />
            Confirmar firma
          </Button>
        </div>
      )}
    </div>
  );
}
