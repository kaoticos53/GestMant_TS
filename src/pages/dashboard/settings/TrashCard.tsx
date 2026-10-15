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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { TrashItem } from "@/convex/trash";
import { CLEANUP_PASS_META } from "@/lib/cleanupLog";
import {
  DEFAULT_TRASH_RETENTION_DAYS,
  MAX_TRASH_RETENTION_DAYS,
  MIN_TRASH_RETENTION_DAYS,
  trashRemainingLabel,
} from "@/lib/trash";
import {
  formatDateTime,
  formatFileSize,
  formatRelativeTime,
  getErrorMessage,
} from "@/lib/workshop";
import { useMutation, useQuery } from "convex/react";
import { ExternalLink, File, Trash2, Undo2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/**
 * La papelera del almacén: lo que retira la limpieza no se borra en el acto.
 *
 * Cada archivo retirado se queda aquí unos días —sigue en el almacén; lo que
 * cambia es que ya no lo cita ninguna ficha— con su dirección para abrirlo o
 * descargarlo. Desde aquí se recupera: un archivo del formulario público vuelve
 * a su vale, con la ventana nueva, y uno de los que ya no citaba nadie se queda
 * rescatado, que es lo que impide que caduque. Pasado el plazo lo borra la
 * tercera pasada de la limpieza, y hasta entonces se puede adelantar a mano.
 *
 * Se enseña solo lo que el almacén sabe del archivo —su tipo y su tamaño—: por
 * un archivo retirado ya no responde ninguna ficha, así que no hay nombre que
 * enseñar. Lo que sí se dice es de dónde salió y qué pasada se lo llevó, que es
 * lo que permite juzgar si se retiró por error.
 */
export function TrashCard() {
  const trash = useQuery(api.trash.list);
  const restore = useMutation(api.trash.restore);
  const deleteNow = useMutation(api.trash.deleteNow);
  // El plazo de la papelera: lo que se retire a partir de ahora se guardará esos
  // días. Es un ajuste guardado (`storageSettings`), como los demás del taller.
  const settings = useQuery(api.trash.settings);
  const saveSettings = useMutation(api.trash.setSettings);
  const [days, setDays] = useState(String(DEFAULT_TRASH_RETENTION_DAYS));
  const [savingDays, setSavingDays] = useState(false);
  // El archivo con algo en marcha (recuperarlo o borrarlo) y el que espera
  // confirmación para borrarse del todo.
  const [busy, setBusy] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<TrashItem | null>(null);

  // El formulario se rellena con lo guardado en cuanto llega, una sola vez:
  // mientras se edita no se pisa (la consulta sigue viva y puede refrescarse
  // por detrás).
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || settings === undefined) return;
    setDays(String(settings.days));
    seeded.current = true;
  }, [settings]);

  const pending = trash?.pending ?? [];
  const kept = trash?.kept ?? [];
  const total = pending.length + kept.length;
  // El plazo vigente para lo que se retire de ahora en adelante; mientras carga
  // vale el de partida. Lo que ya está en la papelera cumple el plazo con el que
  // entró, y su propia fila dice cuándo se va.
  const retentionDays = settings?.days ?? DEFAULT_TRASH_RETENTION_DAYS;
  const daysValue = Number(days);
  const daysValid =
    days.trim() !== "" &&
    Number.isInteger(daysValue) &&
    daysValue >= MIN_TRASH_RETENTION_DAYS &&
    daysValue <= MAX_TRASH_RETENTION_DAYS;

  /** Guarda el plazo de la papelera para lo que se retire a partir de ahora. */
  const handleSaveDays = async () => {
    setSavingDays(true);
    try {
      await saveSettings({ days: daysValue });
      toast.success("Plazo de la papelera actualizado");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSavingDays(false);
    }
  };

  /** Recuperar: de vuelta a su vale, o rescatado para que no caduque. */
  const handleRestore = async (item: TrashItem) => {
    setBusy(item.id);
    try {
      const result = await restore({ id: item.id });
      toast.success(
        result.kept
          ? "Rescatado: se queda en la papelera y ya no se borra solo"
          : "Recuperada: vuelve al formulario, con la ventana nueva",
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  /** Borrarlo ya, sin esperar a que cumpla su plazo. */
  const handleDelete = async (item: TrashItem) => {
    setBusy(item.id);
    try {
      const result = await deleteNow({ id: item.id });
      toast.success(`Borrado para siempre · ${formatFileSize(result.bytes)}`);
      setDeleting(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  /** Una fila de la papelera: lo que se sabe del archivo y qué se puede hacer. */
  const row = (item: TrashItem) => (
    <li
      key={item.id}
      className="flex flex-wrap items-center gap-3 rounded-lg border border-border/70 p-2"
    >
      {item.kind === "image" ? (
        // La foto, con el aviso de siempre dentro: si su archivo ya no está en
        // el almacén, o su dirección no llega, la fila lo dice en lugar de
        // quedarse el icono de respaldo.
        <AttachmentImage
          url={item.url}
          name=""
          layout="row"
          frameClassName="size-10 shrink-0 overflow-hidden rounded-md border border-border/70"
          imageClassName="size-full object-cover"
        />
      ) : (
        // Un PDF no tiene miniatura que enseñar: su icono es el que le toca.
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border/70 bg-muted text-muted-foreground">
          <File className="size-4" />
        </span>
      )}

      <div className="min-w-[10rem] flex-1">
        <p className="text-sm">
          {formatFileSize(item.size)}
          {item.contentType ? ` · ${item.contentType}` : ""}
        </p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
          {CLEANUP_PASS_META[item.pass].label} · retirado{" "}
          {formatRelativeTime(item.removedAt)} ({formatDateTime(item.removedAt)}
          )
          {item.kept
            ? item.keptAt === null
              ? ""
              : ` · rescatado ${formatRelativeTime(item.keptAt)}`
            : ` · ${trashRemainingLabel(item.purgeAt)}`}
        </p>
      </div>

      <div className="flex items-center gap-1">
        {item.url && (
          <Button
            asChild
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5"
          >
            <a href={item.url} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" />
              Abrir
            </a>
          </Button>
        )}
        {!item.kept && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={busy === item.id}
            title={
              item.fromForm
                ? `Devolverle su vale del formulario, con ${retentionDays} días de ventana nueva`
                : "Que se quede: deja de caducar y solo se borra a mano"
            }
            onClick={() => void handleRestore(item)}
          >
            <Undo2 className="size-4" />
            {item.fromForm ? "Recuperar" : "Conservar"}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5"
          disabled={busy === item.id}
          onClick={() => setDeleting(item)}
        >
          <Trash2 className="size-4" />
          Borrar
        </Button>
      </div>
    </li>
  );

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Undo2 className="size-4" />
        </span>
        <div className="max-w-2xl">
          <p className="text-sm font-semibold tracking-tight">
            Papelera del almacén
          </p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            Lo que la limpieza retira no se borra en el acto: se queda aquí{" "}
            {retentionDays} días, con el archivo todavía en el almacén, por si
            hay que recuperarlo. Mientras esté puedes abrirlo, devolverle su
            sitio si vino del formulario público o rescatarlo; pasado el plazo,
            la pasada de la papelera lo borra de verdad. El mismo plazo vale
            para las incidencias retiradas desde su ficha: esas esperan esos días
            en la papelera del módulo Archivo, con su expediente y sus notas
            intactos.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        <Label htmlFor="ajustes-papelera-plazo" className="text-sm">
          Plazo de la papelera (días)
        </Label>
        <div className="flex flex-wrap items-end gap-3">
          <Input
            id="ajustes-papelera-plazo"
            type="number"
            inputMode="numeric"
            min={MIN_TRASH_RETENTION_DAYS}
            max={MAX_TRASH_RETENTION_DAYS}
            step={1}
            value={days}
            disabled={settings === undefined || savingDays}
            onChange={(event) => setDays(event.target.value)}
            className="w-28"
          />
          <Button
            type="button"
            disabled={savingDays || settings === undefined || !daysValid}
            onClick={() => void handleSaveDays()}
          >
            {savingDays ? "Guardando..." : "Guardar plazo"}
          </Button>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          {daysValid
            ? `Lo que se retire a partir de ahora se guardará ${daysValue} ${
                daysValue === 1 ? "día" : "días"
              } en la papelera antes de borrarse de verdad. Lo que ya está dentro cumple el plazo con el que entró.`
            : `Escribe un número entero de días entre ${MIN_TRASH_RETENTION_DAYS} y ${MAX_TRASH_RETENTION_DAYS}.`}
        </p>
      </div>

      {trash === undefined ? (
        <div className="mt-4 grid gap-2">
          <Skeleton className="h-14 rounded-lg" />
          <Skeleton className="h-14 rounded-lg" />
        </div>
      ) : total === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-border px-3 py-2 text-xs leading-5 text-muted-foreground">
          La papelera está vacía: lo que retiren la limpieza de la madrugada o
          una purga a mano aparecerá aquí, con su plazo, antes de borrarse.
        </p>
      ) : (
        <>
          {pending.length > 0 && (
            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              {`${pending.length} ${
                pending.length === 1 ? "archivo" : "archivos"
              } · ${formatFileSize(trash?.pendingBytes ?? 0)} · ${
                // Lo que le queda al primero: es el mismo texto que lleva su fila,
                // y con uno caducado dice que le toca la próxima pasada en vez de
                // enseñar una fecha que ya pasó.
                trash?.nextPurgeAt === null || trash?.nextPurgeAt === undefined
                  ? "se borran al cumplir su plazo"
                  : `el primero ${trashRemainingLabel(trash.nextPurgeAt)}`
              }`}
            </p>
          )}

          {pending.length > 0 && (
            // Los archivos de la papelera, como grupo: si lo que falla es la
            // dirección pública, el porqué se dice una vez sobre la lista en
            // lugar de en cada fila que se cae.
            <AttachmentGroup>
              <ul className="mt-3 grid gap-2">{pending.map(row)}</ul>
            </AttachmentGroup>
          )}

          {kept.length > 0 && (
            <>
              <p className="mt-4 text-xs leading-5 text-muted-foreground">
                {`Rescatados (${kept.length}): no se borran solos, solo si los borras tú.`}
              </p>
              <AttachmentGroup>
                <ul className="mt-3 grid gap-2">{kept.map(row)}</ul>
              </AttachmentGroup>
            </>
          )}
        </>
      )}

      {deleting && (
        <Dialog open onOpenChange={(open) => !open && setDeleting(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Borrar de la papelera</DialogTitle>
              <DialogDescription>
                {`Se borrará del almacén ese archivo (${formatFileSize(
                  deleting.size,
                )}) sin esperar a su plazo. Después ya no se puede recuperar.`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDeleting(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="gap-2"
                disabled={busy === deleting.id}
                onClick={() => void handleDelete(deleting)}
              >
                <Trash2 className="size-4" />
                {busy === deleting.id ? "Borrando..." : "Borrar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
