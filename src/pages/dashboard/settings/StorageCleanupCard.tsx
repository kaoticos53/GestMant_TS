import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import {
  CLEANUP_PASS_META,
  cleanupCount,
  cleanupTicketsLabel,
  cleanupUnreadableLabel,
} from "@/lib/cleanupLog";
import {
  formatDateTime,
  formatFileSize,
  formatRelativeTime,
  getErrorMessage,
} from "@/lib/workshop";
import { useAction, useQuery } from "convex/react";
import { Play, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Limpieza del almacén: las dos pasadas que retiran archivos que ya no usa
 * nadie —lo que dejó a medias el formulario público y los que no cita ninguna
 * ficha—, con cuándo fue la última vez de cada una y qué se llevó. El taller las
 * corre de madrugada; el botón las adelanta cuando haga falta, las dos de una
 * vez y en el mismo orden que la noche.
 *
 * La constancia la deja la propia pasada (`storageCleanupRuns`), así que lo que
 * enseña la tarjeta es lo que de verdad hizo, no una cuenta que la pantalla se
 * eche mirando lo que queda —que no dice nada de lo que ya se llevó—. Una pasada
 * que todavía no ha corrido lo dice, en lugar de inventarse una fecha.
 */
export function StorageCleanupCard() {
  const runs = useQuery(api.cleanupLog.lastRuns);
  // Acción y no mutación: cada pasada del almacén va en su propia transacción.
  const runNow = useAction(api.storageCleanup.runNow);
  const [running, setRunning] = useState(false);

  /** Limpieza inmediata: las dos pasadas, sin esperar la madrugada. */
  const handleRunNow = async () => {
    setRunning(true);
    try {
      const result = await runNow();
      // Lo que retiran las dos primeras pasadas va a la papelera; lo que libera
      // sitio es lo que borra la tercera. Se cuentan aparte para no decir que se
      // ha liberado lo que solo se ha guardado.
      const removed = [
        result.reportUploads.files > 0
          ? cleanupCount("reportUploads", result.reportUploads.files)
          : null,
        result.reportUploads.tickets > 0
          ? cleanupTicketsLabel(result.reportUploads.tickets)
          : null,
        result.orphanFiles.files > 0
          ? cleanupCount("orphanFiles", result.orphanFiles.files)
          : null,
      ].filter((part): part is string => part !== null);
      const freed =
        result.trash.files > 0
          ? `${formatFileSize(result.trash.bytes)} liberados (${cleanupCount(
              "trash",
              result.trash.files,
            )})`
          : null;
      // Lo que no se puede leer se dice aparte: lo de los archivos sin citar se
      // queda donde estaba —de lo que no se lee no se decide nada— y el vale del
      // formulario se va sin dejar nada en la papelera.
      const unreadable = [
        result.reportUploads.unreadable > 0
          ? `${cleanupUnreadableLabel(
              result.reportUploads.unreadable,
            )}, sin nada que guardar`
          : null,
        result.orphanFiles.unreadable > 0
          ? `${cleanupUnreadableLabel(result.orphanFiles.unreadable)}, sin retirar`
          : null,
      ].filter((part): part is string => part !== null);
      // Solo se cuenta lo que salió: una pasada que no se llevó nada no se
      // nombra, para que el aviso diga lo que pasó y no lo que pudo pasar.
      const parts = [
        removed.length > 0 ? `${removed.join(" y ")} a la papelera` : null,
        freed,
        ...unreadable,
      ].filter((part): part is string => part !== null);

      toast.success(
        parts.length === 0
          ? "La limpieza no tenía nada que hacer"
          : `Limpieza hecha: ${parts.join(" · ")}`,
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Trash2 className="size-4" />
          </span>
          <div className="max-w-xl">
            <p className="text-sm font-semibold tracking-tight">
              Limpieza del almacén
            </p>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
              Cada madrugada el taller retira los archivos que ya no usa nadie:
              lo que dejó a medias el formulario público y los que ya no cita
              ninguna ficha. Lo retirado se guarda unos días en la papelera, que
              vacía la tercera pasada. Aquí ves la última vez de cada una
              —cuándo fue y qué se llevó— y las puedes adelantar de una vez.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          disabled={running || runs === undefined}
          onClick={() => void handleRunNow()}
        >
          <Play className="size-4" />
          {running ? "Limpiando..." : "Ejecutar ahora"}
        </Button>
      </div>

      {runs === undefined ? (
        <div className="mt-4 grid gap-2">
          <Skeleton className="h-14 rounded-lg" />
          <Skeleton className="h-14 rounded-lg" />
        </div>
      ) : (
        <ul className="mt-4 grid gap-2">
          {runs.map((run) => {
            const meta = CLEANUP_PASS_META[run.pass];
            // Lo que retiró la última vez; una pasada que no se llevó nada lo
            // dice, que es distinto de no haber corrido nunca.
            const detail = [
              run.ranAt === null
                ? null
                : run.files === 0
                  ? "no retiró nada"
                  : `${cleanupCount(run.pass, run.files)} · ${formatFileSize(run.bytes)}`,
              run.tickets > 0 ? cleanupTicketsLabel(run.tickets) : null,
              // Lo que no se pudo leer, aparte de lo retirado: no es lo mismo que
              // no haberlo visto.
              run.unreadable > 0
                ? `${cleanupUnreadableLabel(run.unreadable)}${
                    run.pass === "orphanFiles"
                      ? ", sin retirar"
                      : ", sin nada que guardar"
                  }`
                : null,
            ].filter((part): part is string => part !== null);

            return (
              <li
                key={run.pass}
                className="rounded-lg border border-border/70 px-3 py-2"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-sm">{meta.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {run.ranAt === null
                      ? "todavía no ha corrido"
                      : `${formatRelativeTime(run.ranAt)} · ${formatDateTime(run.ranAt)}`}
                  </span>
                </div>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                  {detail.length > 0
                    ? detail.join(" · ")
                    : "Nunca ha retirado nada."}
                  {run.ranAt !== null && (
                    <>
                      {" · "}
                      {run.automatic
                        ? "la lanzó la limpieza automática"
                        : `a mano, ${run.runBy}`}
                    </>
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
