import { useEffect, type RefObject } from "react";

export interface UseNotificationBellDismissOptions {
  open: boolean;
  containerRef: RefObject<HTMLElement | null>;
  panelRef: RefObject<HTMLElement | null>;
  buttonRef: RefObject<HTMLElement | null>;
  onClose: () => void;
}

/**
 * Hook para gestionar el cierre por mousedown exterior, tecla Escape con
 * restauración de foco en el disparador, y foco inicial al panel al abrir.
 */
export function useNotificationBellDismiss({
  open,
  containerRef,
  panelRef,
  buttonRef,
  onClose,
}: UseNotificationBellDismissOptions) {
  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      onClose();
      buttonRef.current?.focus();
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, buttonRef, containerRef, onClose]);

  useEffect(() => {
    if (open) {
      panelRef.current?.focus();
    }
  }, [open, panelRef]);
}
