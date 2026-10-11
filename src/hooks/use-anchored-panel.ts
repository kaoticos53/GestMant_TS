import { anchoredPanelStyle, type AnchorOptions } from "@/lib/anchorPanel";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

/**
 * Ancla un desplegable a su botón **en la ventana**: mide el botón y devuelve
 * el `style` que hay que ponerle al panel —en `fixed`, con sus coordenadas— y
 * la orden de volver a medir.
 *
 * Los números están en `@/lib/anchorPanel`; aquí solo vive lo que necesita
 * React: el `ref` que hay que ponerle al botón, la medida del botón y el
 * recálculo al abrir y cuando la ventana se mueve o se desplaza —el botón vive
 * en cabeceras pegajosas, que se van con la página—.
 *
 * Con `open` en `false` no se escucha nada: el desplegable cerrado no gasta
 * oyentes ni medidas.
 */
export function useAnchoredPanel(
  open: boolean,
  options: AnchorOptions = {},
): {
  /** Para el `style` del panel. */
  style: ReturnType<typeof anchoredPanelStyle>;
  /** Vuelve a medir el botón; se llama antes de abrir, por si no estaba abierto. */
  measure: () => void;
  /** Para el `ref` del botón que abre el panel. */
  triggerRef: RefObject<HTMLButtonElement | null>;
} {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [box, setBox] = useState<{
    bottom: number;
    right: number;
  } | null>(null);

  const measure = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    // Un objeto nuevo en cada medida: así el panel se recoloca aunque el botón
    // se haya quedado donde estaba (ha cambiado la ventana, no el botón).
    setBox({ bottom: rect.bottom, right: rect.right });
  }, []);

  useEffect(() => {
    if (!open) return;
    measure();
    // Recalcular en resize y scroll: el botón puede moverse sin que React
    // renderice (cabeceras pegajosas, panel que se redimensiona...).
    const remeasure = () => measure();
    window.addEventListener("resize", remeasure);
    window.addEventListener("scroll", remeasure, true);
    return () => {
      window.removeEventListener("resize", remeasure);
      window.removeEventListener("scroll", remeasure, true);
    };
  }, [open, measure]);

  return {
    style: anchoredPanelStyle(
      box,
      { width: window.innerWidth, height: window.innerHeight },
      options,
    ),
    measure,
    triggerRef,
  };
}
