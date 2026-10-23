import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RichTextEditorProps } from "./richtext/types";

export type { ImageUploads, RichTextEditorProps } from "./richtext/types";

/**
 * El campo de notas y descripciones, cargado cuando hace falta.
 *
 * TipTap y su barra son lo más pesado de la aplicación después de Convex, y no
 * hacen falta para mirar el panel: salen en cuanto se abre un formulario que
 * escribe texto, no antes. Por eso este archivo es solo la puerta —la misma
 * forma de siempre para quien lo usa— y el editor de verdad vive detrás de un
 * `import()`; Vite lo deja en su propio trozo.
 *
 * Mientras llega se pinta su hueco, con el mismo borde y un sitio parecido: lo
 * que se escribe después no mueve la página.
 */
const RichTextEditorCore = lazy(() => import("./richtext/RichTextEditorCore"));

export function RichTextEditor(props: RichTextEditorProps) {
  return (
    <Suspense fallback={<RichTextEditorPlaceholder {...props} />}>
      <RichTextEditorCore {...props} />
    </Suspense>
  );
}

/** El hueco del editor: el mismo marco, sin barra ni escritura. */
function RichTextEditorPlaceholder({
  id,
  placeholder,
  disabled,
  compact,
  className,
}: RichTextEditorProps) {
  return (
    <div
      className={cn(
        "rounded-md border border-input bg-transparent shadow-xs",
        disabled && "opacity-60",
        className,
      )}
      aria-busy="true"
    >
      <div
        className="flex h-9 items-center gap-2 border-b border-border/60 px-2"
        aria-hidden="true"
      >
        <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Cargando editor…</span>
      </div>
      <div
        id={id}
        className={cn(
          "px-3 py-2 text-sm text-muted-foreground",
          compact ? "min-h-16" : "min-h-32",
        )}
      >
        {placeholder ?? ""}
      </div>
    </div>
  );
}
