import { SIDEBAR_WIDTH_MAX, SIDEBAR_WIDTH_MIN } from "@/lib/sidebar";
import { cn } from "@/lib/utils";
import type { SidebarResizeHandleProps } from "./types";

export function SidebarResizeHandle({
  sidebarWidth,
  sidebarResizing,
  resizeHandleProps,
}: SidebarResizeHandleProps) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Redimensionar el menú lateral"
      aria-valuenow={sidebarWidth}
      aria-valuemin={SIDEBAR_WIDTH_MIN}
      aria-valuemax={SIDEBAR_WIDTH_MAX}
      tabIndex={0}
      title="Arrastra para cambiar el ancho · doble clic para restablecer"
      {...resizeHandleProps}
      className="group sticky top-0 hidden h-screen w-3.5 -mr-1.5 shrink-0 cursor-col-resize touch-none select-none focus-visible:outline-none lg:flex lg:items-center lg:justify-center z-20"
    >
      {/* Línea divisoria interactiva */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border/80 transition-all",
          "group-hover:w-1 group-hover:bg-signal/60 group-focus-visible:w-1 group-focus-visible:bg-signal",
          sidebarResizing && "w-1 bg-signal",
        )}
      />
      {/* Píldora de agarre táctil centrada */}
      <span
        aria-hidden="true"
        className={cn(
          "relative z-10 h-8 w-1 rounded-full bg-muted-foreground/30 transition-all",
          "group-hover:h-12 group-hover:w-1.5 group-hover:bg-signal",
          sidebarResizing && "h-14 w-1.5 bg-signal shadow-sm",
        )}
      />
    </div>
  );
}
