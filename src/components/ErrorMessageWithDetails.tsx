import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { extractRawErrorMessage, formatUiError } from "@/lib/workshop";

export interface ErrorMessageWithDetailsProps {
  /** Texto de error (cadena, Error o ConvexError). */
  error: unknown;
  /** Prefijo opcional antes del mensaje sanitizado. */
  prefix?: string;
  /** Sufijo opcional tras el mensaje sanitizado (p. ej. un punto final). */
  suffix?: string;
  /** Mensaje de respaldo si el error está vacío o es técnico. */
  fallback?: string;
  className?: string;
  textClassName?: string;
}

/**
 * Muestra un error sanitizado en producción y ofrece un botón «Ver detalle técnico»
 * exclusivamente para administradores cuando el mensaje original contiene detalles internos.
 */
export function ErrorMessageWithDetails({
  error,
  prefix = "",
  suffix = "",
  fallback = "Se ha producido un error inesperado. Inténtalo de nuevo.",
  className,
  textClassName,
}: ErrorMessageWithDetailsProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [showTechnical, setShowTechnical] = useState(false);

  const rawError = extractRawErrorMessage(error).trim();
  const safeError = rawError
    ? formatUiError(rawError, { fallback })
    : fallback;
  const hasTechnicalDetail = Boolean(rawError && rawError !== safeError);

  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p
          className={cn(
            "text-xs leading-5 text-destructive",
            textClassName,
          )}
        >
          {prefix}
          {safeError}
          {suffix}
        </p>
        {isAdmin && hasTechnicalDetail && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px] text-muted-foreground"
            onClick={() => setShowTechnical((prev) => !prev)}
          >
            {showTechnical ? "Ocultar detalle técnico" : "Ver detalle técnico"}
          </Button>
        )}
      </div>
      {isAdmin && hasTechnicalDetail && showTechnical && (
        <p className="rounded bg-muted/60 px-2.5 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground break-words">
          {rawError}
        </p>
      )}
    </div>
  );
}
