import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import {
  clearCanvasBackground,
  drawCirclePoint,
  drawStrokeSegment,
  getRelativePointerCoords,
  initializeCanvasDpr,
} from "./helpers";
import type { Point } from "./types";

interface UseSignatureCanvasOptions {
  strokeColor?: string;
  strokeWidth?: number;
  onSave?: (blob: Blob, dataUrl: string) => void;
  onClear?: () => void;
}

/**
 * Hook que encapsula el ciclo de vida del canvas de firma, escalado DPR,
 * captura de punteros y serialización de la firma a imagen.
 */
export function useSignatureCanvas({
  strokeColor = "#0f172a",
  strokeWidth = 2.5,
  onSave,
  onClear,
}: UseSignatureCanvasOptions) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef<boolean>(false);
  const lastPointRef = useRef<Point | null>(null);
  const hasDrawnRef = useRef<boolean>(false);
  const lastSizeRef = useRef<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  const [hasDrawn, setHasDrawn] = useState<boolean>(false);

  const setDrawnState = useCallback((next: boolean) => {
    hasDrawnRef.current = next;
    setHasDrawn(next);
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    clearCanvasBackground(canvas);
    setDrawnState(false);
    onClear?.();
  }, [onClear, setDrawnState]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const roundedW = Math.round(rect.width);
      const roundedH = Math.round(rect.height);
      if (
        roundedW === lastSizeRef.current.width &&
        roundedH === lastSizeRef.current.height
      ) {
        return;
      }

      let snapshot: HTMLCanvasElement | null = null;
      if (hasDrawnRef.current && canvas.width > 0 && canvas.height > 0) {
        snapshot = document.createElement("canvas");
        snapshot.width = canvas.width;
        snapshot.height = canvas.height;
        snapshot.getContext("2d")?.drawImage(canvas, 0, 0);
      }

      lastSizeRef.current = { width: roundedW, height: roundedH };
      const dpr = window.devicePixelRatio || 1;
      const ctx = initializeCanvasDpr(canvas, rect.width, rect.height, dpr);
      if (snapshot && ctx) {
        ctx.drawImage(snapshot, 0, 0, rect.width, rect.height);
      }
    };

    resize();
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => resize());
      observer.observe(canvas);
      return () => observer.disconnect();
    }
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const getCanvasCoords = (e: PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    return getRelativePointerCoords(e.clientX, e.clientY, canvas.getBoundingClientRect());
  };

  const handlePointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!e.isPrimary) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    const coords = getCanvasCoords(e);
    lastPointRef.current = coords;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    drawCirclePoint(ctx, coords, strokeWidth / 2, strokeColor);
    setDrawnState(true);
  };

  const handlePointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !lastPointRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const coords = getCanvasCoords(e);
    drawStrokeSegment(ctx, lastPointRef.current, coords, strokeWidth, strokeColor);

    lastPointRef.current = coords;
    setDrawnState(true);
  };

  const handlePointerUp = (e: PointerEvent<HTMLCanvasElement>) => {
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

  return {
    canvasRef,
    hasDrawn,
    clearCanvas,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleConfirm,
  };
}
