import type { Point } from "./types";

/**
 * Calcula las coordenadas relativas al lienzo a partir de un evento de puntero y su bounding rect.
 */
export function getRelativePointerCoords(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number },
): Point {
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  };
}

/**
 * Redimensiona e inicializa un canvas 2D aplicando el factor de escala DPI para pantallas de alta densidad.
 */
export function initializeCanvasDpr(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  dpr: number = 1,
): CanvasRenderingContext2D | null {
  if (width <= 0 || height <= 0) return null;

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);

  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }
  return ctx;
}

/**
 * Restablece el fondo del lienzo a blanco liso.
 */
export function clearCanvasBackground(
  canvas: HTMLCanvasElement,
  width?: number,
  height?: number,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width ?? canvas.width, height ?? canvas.height);
}

/**
 * Dibuja un punto circular inicial cuando el puntero hace contacto con el lienzo.
 */
export function drawCirclePoint(
  ctx: CanvasRenderingContext2D,
  point: Point,
  radius: number,
  color: string,
): void {
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

/**
 * Traza un segmento suave entre dos puntos con extremos redondeados.
 */
export function drawStrokeSegment(
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  strokeWidth: number,
  strokeColor: string,
): void {
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
}
