import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cleanupUnreadableLabel } from "@/lib/cleanupLog";
import { ImageOff, Trash2 } from "lucide-react";
import { ConfirmPurgeDialog } from "./unusedUploads/components/ConfirmPurgeDialog";
import { ManualPurgeLog } from "./unusedUploads/components/ManualPurgeLog";
import { UnusedImagesList } from "./unusedUploads/components/UnusedImagesList";
import { useUnusedUploadsState } from "./unusedUploads/hooks/useUnusedUploadsState";

export { ManualPurgeLog };

/**
 * Lo que la noche va a barrer del formulario público: fotos que se subieron y
 * que ninguna incidencia cita, porque el aviso se quedó a medias. Se purgan de
 * una vez, sin esperar a la madrugada.
 */
export function UnusedUploadsCard() {
  const {
    pending,
    images,
    tickets,
    unreadable,
    totalBytes,
    total,
    summary,
    retentionDays,
    confirming,
    setConfirming,
    purging,
    handlePurge,
  } = useUnusedUploadsState();

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <ImageOff className="size-4" />
        </span>
        <div className="max-w-xl">
          <p className="text-sm font-semibold tracking-tight">
            Imágenes del formulario sin usar
          </p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            Las fotos que llegan por el formulario público y que ninguna
            incidencia cita: el aviso se quedó a medias. La limpieza de la
            madrugada se las lleva pasada su ventana de cortesía —un día entero
            sin que nadie las use—; aquí las ves antes y las puedes purgar de
            una vez. Unos minutos antes de que pase, la campana avisa con lo que
            hay pendiente, para que no te enteres cuando ya no estén.
          </p>
        </div>
      </div>

      {pending === undefined ? (
        <div className="mt-4 grid gap-2">
          <Skeleton className="h-14 rounded-lg" />
          <Skeleton className="h-14 rounded-lg" />
        </div>
      ) : total === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-border px-3 py-2 text-xs leading-5 text-muted-foreground">
          No hay nada pendiente: la limpieza de esta noche no tiene nada que
          barrer del formulario. Una foto que se suba y nadie cite aparecerá
          aquí al día siguiente, cuando cumpla su ventana.
        </p>
      ) : (
        <>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            {summary}
          </p>

          {unreadable > 0 && (
            <p className="mt-2 rounded-lg border border-dashed border-border/70 px-3 py-2 text-xs leading-5 text-muted-foreground">
              {`${cleanupUnreadableLabel(
                unreadable,
              )}: el vale sigue aquí, pero el archivo ya no está en el almacén. La pasada se lleva el vale —ya no sirve para nada— y lo cuenta aparte, sin hacerlo pasar por una imagen.`}
            </p>
          )}

          <UnusedImagesList images={images} />

          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={purging}
              onClick={() => setConfirming(true)}
            >
              <Trash2 className="size-4" />
              {`Purgar ahora (${total})`}
            </Button>
          </div>
        </>
      )}

      <ManualPurgeLog />

      {confirming && (
        <ConfirmPurgeDialog
          open={confirming}
          onOpenChange={setConfirming}
          imagesCount={images.length}
          totalBytes={totalBytes}
          ticketsCount={tickets}
          unreadableCount={unreadable}
          retentionDays={retentionDays}
          purging={purging}
          onConfirm={() => void handlePurge()}
        />
      )}
    </div>
  );
}
