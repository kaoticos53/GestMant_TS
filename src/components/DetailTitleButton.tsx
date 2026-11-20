import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface DetailTitleButtonProps {
  onClick: () => void;
  children: ReactNode;
  className?: string;
  title?: string;
  "aria-label"?: string;
}

/**
 * Botón accesible con estética de título clicable para abrir el panel lateral
 * de detalle de una ficha desde tablas y tarjetas.
 */
export function DetailTitleButton({
  onClick,
  children,
  className,
  title,
  "aria-label": ariaLabel,
}: DetailTitleButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      className={cn(
        "block max-w-full cursor-pointer truncate rounded-xs text-left font-medium transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {children}
    </button>
  );
}
