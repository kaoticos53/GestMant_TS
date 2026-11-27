import { toast } from "sonner";

/** Etiqueta accesible del botón de deshacer un ajuste rápido de stock. */
export const STOCK_UNDO_LABEL = "Deshacer";

/** Tiempo para deshacer un ajuste rápido (6 segundos). */
export const STOCK_UNDO_DURATION_MS = 6000;

export interface StockAdjustToastOptions {
  /** Código del repuesto: «ALI-24015». */
  code: string;
  /** Unidades sumadas (positivo) o restadas (negativo). */
  delta: number;
  /** Stock resultante, si se conoce. */
  nextStock?: number;
  onUndo: () => void | Promise<void>;
}

/** Texto principal del aviso: «+1 en ALI-24015» / «−1 en ALI-24015». */
export function stockAdjustMessage(code: string, delta: number): string {
  const sign = delta > 0 ? "+" : "−";
  return `${sign}${Math.abs(delta)} en ${code}`;
}

/**
 * Aviso de un ajuste rápido de stock (+1 / −1) desde el inventario, con un
 * botón «Deshacer» que aplica el movimiento contrario. Evita que un toque
 * equivocado en la tabla obligue a abrir el diálogo de ajuste para corregirlo.
 */
export function stockAdjustWithUndoToast({
  code,
  delta,
  nextStock,
  onUndo,
}: StockAdjustToastOptions): void {
  toast.success(stockAdjustMessage(code, delta), {
    ...(nextStock !== undefined
      ? { description: `Stock actual: ${nextStock} uds.` }
      : {}),
    duration: STOCK_UNDO_DURATION_MS,
    action: {
      label: STOCK_UNDO_LABEL,
      onClick: () => {
        void onUndo();
      },
    },
  });
}
