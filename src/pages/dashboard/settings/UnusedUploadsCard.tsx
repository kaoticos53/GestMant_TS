import { AttachmentGroup } from "@/components/AttachmentGroup";
import { AttachmentImage } from "@/components/AttachmentImage";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import {
  cleanupCount,
  cleanupTicketsLabel,
  cleanupUnreadableLabel,
} from "@/lib/cleanupLog";
import { DEFAULT_TRASH_RETENTION_DAYS } from "@/lib/trash";
import {
  formatDateTime,
  formatFileSize,
  getErrorMessage,
} from "@/lib/workshop";
import { useMutation, useQuery } from "convex/react";
import {
  ChevronDown,
  ChevronUp,
  ImageOff,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * La constancia de las purgas a mano, debajo del botón que las hace: quién, cuándo
 * y qué se llevó cada una, con sus vales a un clic. Las pasadas de la madrugada no
 * aparecen aquí a propósito —tienen la suya, con la última vez de cada una—: esto
 * es la firma de lo que decide una persona, y con nombre y apellidos, porque es lo
 * único que quedará de un archivo que nadie citó.
 */
export function ManualPurgeLog() {
  const purges = useQuery(api.cleanupLog.purges);
  // Un solo detalle abierto a la vez: la lista se lee de un vistazo y los vales
  // aparecen cuando se piden.
  const [openId, setOpenId] = useState<string | null>(null);
  const entries = purges?.entries ?? [];

  return (
    <div className="mt-4 border-t border-border/60 pt-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Constancia de las purgas a mano
      </p>
      <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
        Quién purgó, cuándo y qué se llevó. Las pasadas de la madrugada no se
        firman aquí: esto es lo que hizo una persona.
      </p>

      {purges === undefined ? (
        <Skeleton className="mt-2 h-12 rounded-lg" />
      ) : entries.length === 0 ? (
        <p className="mt-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs leading-5 text-muted-foreground">
          Todavía no ha purgado nadie a mano. La primera purga deja aquí su
          firma, con la lista de lo que se llevó.
        </p>
      ) : (
        <ul className="mt-2 grid gap-1.5">
          {entries.map((entry) => {
            const total = entry.images.length + entry.tickets.length;
            const open = openId === entry.id;
            const counted = [
              entry.images.length > 0
                ? `${cleanupCount("reportUploads", entry.images.length)} (${formatFileSize(
                    entry.bytes,
                  )})`
                : null,
              entry.tickets.length > 0
                ? cleanupTicketsLabel(entry.tickets.length)
                : null,
            ].filter((part): part is string => part !== null);
            return (
              <li
                key={entry.id}
                className="rounded-lg border border-border/70 p-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs">
                      <span className="font-medium">{entry.runBy}</span>
                      <span className="text-muted-foreground">
                        {" · "}
                        {formatDateTime(entry.ranAt)}
                      </span>
                    </p>
                    <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">
                      {counted.join(" · ")}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground"
                    onClick={() => setOpenId(open ? null : entry.id)}
                  >
                    {open ? (
                      <ChevronUp className="size-3.5" />
                    ) : (
                      <ChevronDown className="size-3.5" />
                    )}
                    {open ? "Ocultar" : `Ver qué se llevó (${total})`}
                  </Button>
                </div>

                {open && (
                  <ul className="mt-2 grid gap-1 border-t border-border/60 pt-2">
                    {entry.images.map((image) => (
                      <li
                        key={image.ticket}
                        className="flex items-center justify-between gap-2 font-mono text-[11px] text-muted-foreground"
                      >
                        <span className="truncate">{image.ticket}</span>
                        <span className="shrink-0">
                          {formatFileSize(image.size)}
                        </span>
                      </li>
                    ))}
                    {entry.tickets.map((ticket) => (
                      <li
                        key={ticket}
                        className="flex items-center justify-between gap-2 font-mono text-[11px] text-muted-foreground"
                      >
                        <span className="truncate">{ticket}</span>
                        <span className="shrink-0">vale sin archivo</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
          {purges?.partial && (
            <li className="text-[11px] leading-5 text-muted-foreground">
              Se enseñan las últimas {entries.length} purgas a mano; las de
              antes siguen guardadas.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/**
 * Lo que la noche va a barrer del formulario público: fotos que se subieron y
 * que ninguna incidencia cita, porque el aviso se quedó a medias. Se purgan de
 * una vez, sin esperar a la madrugada.
 */
export function UnusedUploadsCard() {
  const pending = useQuery(api.reportUploads.unusedImages);
  const purgeUnused = useMutation(api.reportUploads.purgeUnused);
  // El plazo de la papelera lo ajusta el taller; mientras carga vale el de
  // partida, que es lo que la propia limpieza haría sin ajuste guardado.
  const trashSettings = useQuery(api.trash.settings);
  const retentionDays = trashSettings?.days ?? DEFAULT_TRASH_RETENTION_DAYS;
  const [confirming, setConfirming] = useState(false);
  const [purging, setPurging] = useState(false);

  const images = pending?.images ?? [];
  const tickets = pending?.tickets ?? 0;
  // Vales cuyo archivo el almacén ya no puede leer: se van en la misma pasada,
  // pero no son imágenes ni dejan nada en la papelera.
  const unreadable = pending?.unreadable ?? 0;
  const total = images.length + tickets + unreadable;
  // Lo pendiente, en una línea: cuántas fotos, cuánto ocupan, y lo que se va con
  // ellas (los vales sin archivo no son imágenes, pero se van en la misma pasada).
  const summary = [
    `${images.length} ${images.length === 1 ? "imagen" : "imágenes"} (${formatFileSize(
      pending?.totalBytes ?? 0,
    )})`,
    tickets > 0
      ? `${tickets} ${tickets === 1 ? "vale" : "vales"} sin archivo`
      : null,
    unreadable > 0 ? cleanupUnreadableLabel(unreadable) : null,
    pending?.partial ? "la limpieza va por tandas" : null,
  ]
    .filter((part): part is string => part !== null)
    .join(" · ");

  const handlePurge = async () => {
    setPurging(true);
    try {
      const result = await purgeUnused();
      // Lo purgado no se pierde: queda en la papelera con su plazo por delante.
      const parts = [
        result.images > 0 ? cleanupCount("reportUploads", result.images) : null,
        result.tickets > 0 ? cleanupTicketsLabel(result.tickets) : null,
      ].filter((part): part is string => part !== null);
      // Y lo que no se puede leer no deja nada: se dice aparte para no contarlo
      // entre lo que se guarda.
      const messages = [
        parts.length > 0
          ? `A la papelera: ${parts.join(" y ")}${
              result.bytes > 0 ? ` (${formatFileSize(result.bytes)})` : ""
            }`
          : null,
        result.unreadable > 0
          ? `${cleanupUnreadableLabel(result.unreadable)}, que no dejan nada`
          : null,
      ].filter((part): part is string => part !== null);
      toast.success(
        messages.length === 0
          ? "No había nada que purgar"
          : messages.join(" · "),
      );
      setConfirming(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setPurging(false);
    }
  };

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
            // Lo que no se puede leer no tiene miniatura que enseñar —por eso no
            // está en la lista de abajo—, así que se explica: es un vale que
            // sigue ahí y un archivo que ya no.
            <p className="mt-2 rounded-lg border border-dashed border-border/70 px-3 py-2 text-xs leading-5 text-muted-foreground">
              {`${cleanupUnreadableLabel(
                unreadable,
              )}: el vale sigue aquí, pero el archivo ya no está en el almacén. La pasada se lleva el vale —ya no sirve para nada— y lo cuenta aparte, sin hacerlo pasar por una imagen.`}
            </p>
          )}

          {images.length > 0 && (
            // Las imágenes de la tanda, como grupo: si lo que falla es la
            // dirección pública —lo mismo para todas—, el porqué se dice una vez
            // y no una vez por foto.
            <AttachmentGroup>
              <ul className="mt-3 grid gap-2">
                {images.map((image) => (
                  <li
                    key={image.id}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-border/70 p-2"
                  >
                    {/* La miniatura lleva dentro el mismo aviso que un adjunto
                        roto: si su dirección no llega —o el archivo ya no está
                        en el almacén—, en vez del icono de respaldo se lee por
                        qué; con varias fotos a la vez, el porqué va arriba, una
                        sola vez. */}
                    <AttachmentImage
                      url={image.url}
                      name=""
                      layout="row"
                      frameClassName="size-10 shrink-0 overflow-hidden rounded-md border border-border/70"
                      imageClassName="size-full object-cover"
                    />
                    <div className="min-w-0">
                      <p className="text-sm">
                        Subida el {formatDateTime(image.uploadedAt)}
                      </p>
                      <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                        {formatFileSize(image.size)} · sin citar en ninguna
                        incidencia
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </AttachmentGroup>
          )}

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
        <Dialog open onOpenChange={(open) => !open && setConfirming(false)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Purgar sin esperar a la noche</DialogTitle>
              <DialogDescription>
                {`Se retirarán ${images.length} ${
                  images.length === 1 ? "imagen" : "imágenes"
                } (${formatFileSize(pending?.totalBytes ?? 0)})`}
                {tickets > 0
                  ? ` y ${tickets} ${tickets === 1 ? "vale" : "vales"} sin archivo`
                  : ""}
                {unreadable > 0
                  ? `, y ${cleanupUnreadableLabel(
                      unreadable,
                    )}, que se irán sin dejar nada en la papelera`
                  : ""}
                {`. No están en ninguna incidencia, así que no se pierde nada del expediente: se quedan ${retentionDays} días en la papelera, por si hay que volver a por ellas.`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setConfirming(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="gap-2"
                disabled={purging}
                onClick={() => void handlePurge()}
              >
                <Trash2 className="size-4" />
                {purging ? "Purgando..." : "Purgar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
