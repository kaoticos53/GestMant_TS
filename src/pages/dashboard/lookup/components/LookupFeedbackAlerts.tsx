import { Skeleton } from "@/components/ui/skeleton";
import { formatPublicCode } from "@/lib/publicCode";
import { confusableNote } from "../helpers";
import type { LookupFeedbackAlertsProps } from "../types";

/** Avisos contextuales, errores de rate-limiting, sugerencias de código y esqueletos de carga. */
export function LookupFeedbackAlerts({
  code,
  referenceTyped,
  confusables,
  tracking,
  failure,
}: LookupFeedbackAlertsProps) {
  return (
    <>
      {referenceTyped && (
        <p className="mt-3 text-sm text-muted-foreground">
          Eso parece la referencia del taller, no el código con el que se sigue
          desde fuera: el código no lleva números correlativos. Te lo dieron al
          notificar la incidencia —o te llega por correo cuando el caso cambia
          de estado—, así que pídelo al taller si no lo tienes.
        </p>
      )}

      {!referenceTyped && confusables !== "" && (
        <p className="mt-3 text-sm text-muted-foreground">
          {confusableNote(confusables)}
        </p>
      )}

      {!referenceTyped && confusables === "" && code === null && (
        <p className="mt-3 text-sm text-muted-foreground">
          Escribe el código de la incidencia, el que te dieron al notificarla:
          ocho caracteres como «A7K2-QX9M».
        </p>
      )}

      {code !== null && tracking === undefined && (
        <div className="mt-4 grid gap-2">
          <Skeleton className="h-5 w-40 rounded" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      )}

      {failure !== null && (
        <p
          role="status"
          className="mt-4 rounded-xl border border-dashed border-border bg-card p-4 text-sm text-muted-foreground"
        >
          {failure}
        </p>
      )}

      {code !== null && tracking === null && failure === null && (
        <p className="mt-4 rounded-xl border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">
          No encontramos ninguna incidencia con el código{" "}
          <span className="font-mono font-medium text-foreground">
            {formatPublicCode(code)}
          </span>
          . Comprueba el código que te dieron al notificarla.
        </p>
      )}
    </>
  );
}
