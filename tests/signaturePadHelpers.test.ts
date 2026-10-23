import { describe, expect, it, vi } from "vitest";
import {
  clearCanvasBackground,
  drawCirclePoint,
  drawStrokeSegment,
  getRelativePointerCoords,
  initializeCanvasDpr,
} from "@/components/signaturePad/helpers";

describe("signaturePad helpers", () => {
  describe("getRelativePointerCoords", () => {
    it("calcula la posición relativa restando los márgenes del elemento", () => {
      const rect = { left: 100, top: 50 };
      const coords = getRelativePointerCoords(180, 120, rect);
      expect(coords).toEqual({ x: 80, y: 70 });
    });

    it("maneja el origen del lienzo exactamente en 0,0", () => {
      const rect = { left: 50, top: 50 };
      const coords = getRelativePointerCoords(50, 50, rect);
      expect(coords).toEqual({ x: 0, y: 0 });
    });
  });

  describe("initializeCanvasDpr", () => {
    it("devuelve null si el ancho o alto son <= 0", () => {
      const mockCanvas = {} as HTMLCanvasElement;
      expect(initializeCanvasDpr(mockCanvas, 0, 100, 2)).toBeNull();
      expect(initializeCanvasDpr(mockCanvas, 100, -5, 2)).toBeNull();
    });

    it("ajusta width, height según DPR y rellena el fondo blanco", () => {
      const mockCtx = {
        scale: vi.fn(),
        fillStyle: "",
        fillRect: vi.fn(),
      };
      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn().mockReturnValue(mockCtx),
      } as unknown as HTMLCanvasElement;

      const ctx = initializeCanvasDpr(mockCanvas, 300, 150, 2);

      expect(mockCanvas.width).toBe(600);
      expect(mockCanvas.height).toBe(300);
      expect(mockCtx.scale).toHaveBeenCalledWith(2, 2);
      expect(mockCtx.fillStyle).toBe("#ffffff");
      expect(mockCtx.fillRect).toHaveBeenCalledWith(0, 0, 300, 150);
      expect(ctx).toBe(mockCtx);
    });
  });

  describe("clearCanvasBackground", () => {
    it("limpia el fondo blanco en todo el lienzo", () => {
      const mockCtx = {
        fillStyle: "",
        fillRect: vi.fn(),
      };
      const mockCanvas = {
        width: 400,
        height: 200,
        getContext: vi.fn().mockReturnValue(mockCtx),
      } as unknown as HTMLCanvasElement;

      clearCanvasBackground(mockCanvas);

      expect(mockCtx.fillStyle).toBe("#ffffff");
      expect(mockCtx.fillRect).toHaveBeenCalledWith(0, 0, 400, 200);
    });
  });

  describe("drawCirclePoint", () => {
    it("dibuja un arco circular cerrado con el radio y color indicados", () => {
      const mockCtx = {
        beginPath: vi.fn(),
        arc: vi.fn(),
        fillStyle: "",
        fill: vi.fn(),
      } as unknown as CanvasRenderingContext2D;

      drawCirclePoint(mockCtx, { x: 45, y: 60 }, 2, "#1e293b");

      expect(mockCtx.beginPath).toHaveBeenCalled();
      expect(mockCtx.arc).toHaveBeenCalledWith(45, 60, 2, 0, Math.PI * 2);
      expect(mockCtx.fillStyle).toBe("#1e293b");
      expect(mockCtx.fill).toHaveBeenCalled();
    });
  });

  describe("drawStrokeSegment", () => {
    it("traza una línea entre dos puntos con extremos redondeados", () => {
      const mockCtx = {
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        strokeStyle: "",
        lineWidth: 0,
        lineCap: "",
        lineJoin: "",
        stroke: vi.fn(),
      } as unknown as CanvasRenderingContext2D;

      drawStrokeSegment(
        mockCtx,
        { x: 10, y: 15 },
        { x: 25, y: 30 },
        3,
        "#0f172a",
      );

      expect(mockCtx.beginPath).toHaveBeenCalled();
      expect(mockCtx.moveTo).toHaveBeenCalledWith(10, 15);
      expect(mockCtx.lineTo).toHaveBeenCalledWith(25, 30);
      expect(mockCtx.strokeStyle).toBe("#0f172a");
      expect(mockCtx.lineWidth).toBe(3);
      expect(mockCtx.lineCap).toBe("round");
      expect(mockCtx.lineJoin).toBe("round");
      expect(mockCtx.stroke).toHaveBeenCalled();
    });
  });
});
