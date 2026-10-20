import { AttachmentGroup } from "@/components/AttachmentGroup";
import { AttachmentImage } from "@/components/AttachmentImage";
import { Badge } from "@/components/ui/badge";
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
import type { WithdrawnIncidentItem } from "@/convex/_incidents/trash";
import type { WithdrawnRequestItem } from "@/convex/_partRequests/trash";
import type { TrashItem } from "@/convex/trash";
import { reporterNoticeText } from "@/lib/incidentMail";
import {
  DEFAULT_TRASH_RETENTION_DAYS,
  MAX_TRASH_RETENTION_DAYS,
  MIN_TRASH_RETENTION_DAYS,
  trashRemainingLabel,
} from "@/lib/trash";
import {
  INCIDENT_STATUS_META,
  STATUS_META,
  formatDateTime,
  formatFileSize,
  getErrorMessage,
} from "@/lib/workshop";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  ArchiveRestore,
  ExternalLink,
  File,
  Trash2,
  Undo2,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

type DeletingEntity =
  | { type: "storage"; item: TrashItem }
  | { type: "incident"; item: WithdrawnIncidentItem }
  | { type: "request"; item: WithdrawnRequestItem };

/**
 * Un contenedor con scroll acotado para un grupo de elementos en la papelera.
 */
function TrashSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="mt-4">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-1.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
        <span className="text-xs font-medium tabular-nums text-muted-foreground">
          {count} {count === 1 ? "elemento" : "elementos"}
        </span>
      </div>
      <div className="mt-2.5 grid max-h-80 gap-2.5 overflow-y-auto pr-1">
        {children}
      </div>
    </section>
  );
}

/**
 * Papelera del taller: lo que se retira —incidencias, peticiones y archivos—
 * no se borra en el acto, sino que espera aquí el plazo configurado con opción
 * de recuperarse tal y como estaba o adelantarse su borrado definitivo.
 */
export function TrashCard({
  canManageIncidents = true,
  canDecideRequests = true,
}: {
  /** Quien coordina las incidencias puede verlas y recuperarlas en la papelera. */
  canManageIncidents?: boolean;
  /** Quien decide las peticiones de repuesto puede verlas y recuperarlas. */
  canDecideRequests?: boolean;
}) {
  // Papelera de archivos del almacén
  const trash = useQuery(api.trash.list);
  const restoreStorage = useMutation(api.trash.restore);
  const deleteStorageNow = useMutation(api.trash.deleteNow);

  // Papelera de incidencias retiradas
  const incidentTrash = useQuery(
    api.incidents.trash,
    canManageIncidents ? {} : "skip",
  );
  const restoreIncident = useMutation(api.incidents.restore);
  const deleteIncidentNow = useMutation(api.incidents.deleteNow);

  // Papelera de peticiones de repuestos retiradas
  const requestTrash = useQuery(
    api.partRequests.trash,
    canDecideRequests ? {} : "skip",
  );
  const restoreRequest = useMutation(api.partRequests.restore);
  const deleteRequestNow = useMutation(api.partRequests.deleteNow);

  // Plazo vigente para toda la papelera del taller
  const settings = useQuery(api.trash.settings);
  const saveSettings = useMutation(api.trash.setSettings);

  const [days, setDays] = useState(String(DEFAULT_TRASH_RETENTION_DAYS));
  const [savingDays, setSavingDays] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deletingEntity, setDeletingEntity] = useState<DeletingEntity | null>(
    null,
  );
  const [filter, setFilter] = useState<
    "all" | "incidents" | "requests" | "storage"
  >("all");

  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || settings === undefined) return;
    setDays(String(settings.days));
    seeded.current = true;
  }, [settings]);

  const trashedIncidents = incidentTrash?.items ?? [];
  const trashedRequests = requestTrash?.items ?? [];
  const storagePending = trash?.pending ?? [];
  const storageKept = trash?.kept ?? [];
  const storageTotal = storagePending.length + storageKept.length;

  const totalItems =
    trashedIncidents.length + trashedRequests.length + storageTotal;

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

  /** Recuperar una incidencia de la papelera. */
  const handleRestoreIncident = async (item: WithdrawnIncidentItem) => {
    setBusyId(item.id);
    try {
      await restoreIncident({ incidentId: item.id });
      toast.success(
        `Incidencia ${item.reference} recuperada de la papelera`,
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  /** Recuperar una petición de la papelera. */
  const handleRestoreRequest = async (item: WithdrawnRequestItem) => {
    setBusyId(item.id);
    try {
      await restoreRequest({ requestId: item.id });
      toast.success(
        `Petición ${item.reference} recuperada de la papelera`,
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  /** Recuperar o conservar un archivo del almacén. */
  const handleRestoreStorage = async (item: TrashItem) => {
    setBusyId(item.id);
    try {
      const result = await restoreStorage({ id: item.id });
      toast.success(
        result.kept
          ? "Rescatado: se queda en la papelera y ya no se borra solo"
          : "Recuperada: vuelve al formulario, con la ventana nueva",
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  /** Ejecutar el borrado definitivo de la entidad confirmada. */
  const handleConfirmDelete = async () => {
    if (!deletingEntity) return;
    const target = deletingEntity;
    setBusyId(target.item.id);
    try {
      if (target.type === "incident") {
        await deleteIncidentNow({ incidentId: target.item.id });
        toast.success(
          `Incidencia ${target.item.reference} borrada para siempre`,
        );
      } else if (target.type === "request") {
        await deleteRequestNow({ requestId: target.item.id });
        toast.success(
          `Petición ${target.item.reference} borrada para siempre`,
        );
      } else {
        const result = await deleteStorageNow({ id: target.item.id });
        toast.success(
          `Archivo borrado para siempre · ${formatFileSize(result.bytes)}`,
        );
      }
      setDeletingEntity(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  /** Renderiza una fila de archivo del almacén. */
  const renderStorageRow = (item: TrashItem) => (
    <li
      key={item.id}
      className="flex flex-wrap items-center gap-3 rounded-lg border border-border/70 bg-background/60 p-2.5"
    >
      {item.kind === "image" ? (
        <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
          <AttachmentImage
            url={item.url}
            className="size-full object-cover"
            alt=""
          />
        </span>
      ) : (
        <span className="flex size-10 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
          <File className="size-5" />
        </span>
      )}

      <div className="flex min-w-[10rem] flex-1 flex-col">
        <span className="text-xs font-semibold leading-4">
          {item.contentType}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatFileSize(item.size)}
          {item.fromForm ? " · del formulario público" : " · huérfano"}
          {item.kept
            ? " · rescatado"
            : ` · caduca el ${formatDateTime(item.purgeAt)}`}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {item.url && (
          <Button
            asChild
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
            disabled={busyId === item.id}
            onClick={() => void handleRestoreStorage(item)}
            title={
              item.fromForm
                ? `Devolverle su vale del formulario, con ${retentionDays} días de ventana nueva`
                : "Que se quede: deja de caducar y solo se borra a mano"
            }
          >
            <Undo2 className="size-4" />
            {item.fromForm ? "Recuperar" : "Conservar"}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5 text-destructive hover:text-destructive"
          disabled={busyId === item.id}
          onClick={() => setDeletingEntity({ type: "storage", item })}
        >
          <Trash2 className="size-4" />
          Borrar
        </Button>
      </div>
    </li>
  );

  const isLoading =
    trash === undefined ||
    (canManageIncidents && incidentTrash === undefined) ||
    (canDecideRequests && requestTrash === undefined);

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
          <Trash2 className="size-4" />
        </span>
        <div className="max-w-2xl">
          <p className="text-sm font-semibold tracking-tight">
            Papelera del taller
          </p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            Las incidencias retiradas desde su ficha, las peticiones y los
            archivos retirados del almacén se guardan aquí {retentionDays} días
            antes de borrarse de verdad. Durante este plazo se pueden recuperar
            con su expediente, notas y repuestos intactos, o borrarlos para
            siempre sin esperar.
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

      {isLoading ? (
        <div className="mt-5 grid gap-2">
          <Skeleton className="h-14 rounded-lg" />
          <Skeleton className="h-14 rounded-lg" />
        </div>
      ) : totalItems === 0 ? (
        <p className="mt-5 rounded-lg border border-dashed border-border px-3.5 py-4 text-xs leading-5 text-muted-foreground text-center">
          La papelera está vacía: las incidencias o peticiones retiradas y los
          archivos purgados aparecerán aquí durante su plazo de retención antes
          de borrarse.
        </p>
      ) : (
        <div className="mt-5 flex flex-col gap-4">
          {/* Píldoras de filtro rápido si hay varias categorías con elementos */}
          <div className="flex flex-wrap items-center gap-1.5 border-b border-border/60 pb-3">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                filter === "all"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              Todo
              <span className="ml-1 opacity-75 tabular-nums">({totalItems})</span>
            </button>
            {canManageIncidents && trashedIncidents.length > 0 && (
              <button
                type="button"
                onClick={() => setFilter("incidents")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  filter === "incidents"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                Incidencias
                <span className="ml-1 opacity-75 tabular-nums">
                  ({trashedIncidents.length})
                </span>
              </button>
            )}
            {canDecideRequests && trashedRequests.length > 0 && (
              <button
                type="button"
                onClick={() => setFilter("requests")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  filter === "requests"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                Peticiones
                <span className="ml-1 opacity-75 tabular-nums">
                  ({trashedRequests.length})
                </span>
              </button>
            )}
            {storageTotal > 0 && (
              <button
                type="button"
                onClick={() => setFilter("storage")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  filter === "storage"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                Archivos del almacén
                <span className="ml-1 opacity-75 tabular-nums">
                  ({storageTotal})
                </span>
              </button>
            )}
          </div>

          {/* Sección de Incidencias Retiradas */}
          {canManageIncidents &&
            (filter === "all" || filter === "incidents") &&
            trashedIncidents.length > 0 && (
              <TrashSection
                title="Incidencias retiradas"
                count={trashedIncidents.length}
              >
                {trashedIncidents.map((item) => {
                  const meta =
                    INCIDENT_STATUS_META[item.status] ??
                    INCIDENT_STATUS_META.reported;
                  return (
                    <article
                      key={item.id}
                      className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border/70 bg-background/60 p-3"
                    >
                      <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-muted-foreground">
                            {item.reference}
                          </span>
                          <Badge
                            variant="outline"
                            className={meta.badgeClassName}
                          >
                            {meta.label}
                          </Badge>
                          <span className="text-[11px] font-medium uppercase tracking-wide text-destructive">
                            {trashRemainingLabel(item.purgeAt)}
                          </span>
                        </div>
                        <p className="text-sm font-medium leading-5">
                          {[item.equipmentKind, item.model]
                            .filter(Boolean)
                            .join(" ") || "Incidencia sin equipo"}
                        </p>
                        {item.description !== "" && (
                          <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                            {item.description}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Retirada el {formatDateTime(item.deletedAt)}
                          {item.deletedBy ? ` por ${item.deletedBy}` : ""}
                          {item.deletedReason
                            ? ` · ${item.deletedReason}`
                            : ""}
                          {item.archived
                            ? " · saldrá del archivo al recuperarla"
                            : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Aviso a quien notificó: {reporterNoticeText(item)}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          disabled={busyId === item.id}
                          onClick={() => void handleRestoreIncident(item)}
                        >
                          <ArchiveRestore className="size-4" />
                          Recuperar
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-destructive hover:text-destructive"
                          disabled={busyId === item.id}
                          onClick={() =>
                            setDeletingEntity({ type: "incident", item })
                          }
                        >
                          <Trash2 className="size-4" />
                          Borrar ya
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </TrashSection>
            )}

          {/* Sección de Peticiones Retiradas */}
          {canDecideRequests &&
            (filter === "all" || filter === "requests") &&
            trashedRequests.length > 0 && (
              <TrashSection
                title="Peticiones retiradas"
                count={trashedRequests.length}
              >
                {trashedRequests.map((item) => {
                  const meta =
                    STATUS_META[item.status] ?? STATUS_META.pending;
                  const context = [
                    item.requesterName,
                    item.requesterTeam,
                    item.equipment,
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <article
                      key={item.id}
                      className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border/70 bg-background/60 p-3"
                    >
                      <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-muted-foreground">
                            {item.reference}
                          </span>
                          <Badge
                            variant="outline"
                            className={meta.badgeClassName}
                          >
                            {meta.label}
                          </Badge>
                          <span className="text-[11px] font-medium uppercase tracking-wide text-destructive">
                            {trashRemainingLabel(item.purgeAt)}
                          </span>
                        </div>
                        <p className="text-sm font-medium leading-5">
                          {item.summary || "Petición sin repuesto"}
                        </p>
                        {context !== "" && (
                          <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                            {context}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Retirada el {formatDateTime(item.deletedAt)}
                          {item.deletedBy ? ` por ${item.deletedBy}` : ""}
                          {item.deletedReason
                            ? ` · ${item.deletedReason}`
                            : ""}
                          {item.archived
                            ? " · saldrá del archivo al recuperarla"
                            : ""}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          disabled={busyId === item.id}
                          onClick={() => void handleRestoreRequest(item)}
                        >
                          <ArchiveRestore className="size-4" />
                          Recuperar
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-destructive hover:text-destructive"
                          disabled={busyId === item.id}
                          onClick={() =>
                            setDeletingEntity({ type: "request", item })
                          }
                        >
                          <Trash2 className="size-4" />
                          Borrar ya
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </TrashSection>
            )}

          {/* Sección de Archivos del Almacén */}
          {(filter === "all" || filter === "storage") && storageTotal > 0 && (
            <TrashSection
              title="Archivos del almacén"
              count={storageTotal}
            >
              {storagePending.length > 0 && (
                <>
                  <p className="text-xs text-muted-foreground">
                    {`${storagePending.length} ${
                      storagePending.length === 1 ? "archivo" : "archivos"
                    } · ${formatFileSize(trash?.pendingBytes ?? 0)} · ${
                      trash?.nextPurgeAt === null ||
                      trash?.nextPurgeAt === undefined
                        ? "se borran al cumplir su plazo"
                        : `el primero ${trashRemainingLabel(trash.nextPurgeAt)}`
                    }`}
                  </p>
                  <AttachmentGroup>
                    <ul className="mt-2 grid gap-2">
                      {storagePending.map(renderStorageRow)}
                    </ul>
                  </AttachmentGroup>
                </>
              )}

              {storageKept.length > 0 && (
                <>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Rescatados ({storageKept.length}): no se borran solos, solo
                    si los borras tú.
                  </p>
                  <AttachmentGroup>
                    <ul className="mt-2 grid gap-2">
                      {storageKept.map(renderStorageRow)}
                    </ul>
                  </AttachmentGroup>
                </>
              )}
            </TrashSection>
          )}
        </div>
      )}

      {/* Diálogo unificado de confirmación de borrado definitivo */}
      {deletingEntity && (
        <Dialog
          open
          onOpenChange={(open) => !open && setDeletingEntity(null)}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {deletingEntity.type === "incident"
                  ? `¿Borrar incidencia ${deletingEntity.item.reference} definitivamente?`
                  : deletingEntity.type === "request"
                    ? `¿Borrar petición ${deletingEntity.item.reference} definitivamente?`
                    : "Borrar archivo de la papelera"}
              </DialogTitle>
              <DialogDescription>
                {deletingEntity.type === "incident"
                  ? "Se borrará ahora, sin esperar el plazo de la papelera, y con ella su expediente: sus documentos, sus notas y los avisos que la señalaban. Esta acción no se puede deshacer."
                  : deletingEntity.type === "request"
                    ? "Se borrará ahora, sin esperar el plazo de la papelera: la petición y los archivos que adjuntaba. Las compras que se pidieron por ella se quedan en su módulo. Esta acción no se puede deshacer."
                    : `Se borrará del almacén este archivo (${formatFileSize(
                        deletingEntity.item.size,
                      )}) sin esperar a su plazo. Después ya no se puede recuperar.`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDeletingEntity(null)}
                disabled={busyId === deletingEntity.item.id}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="gap-2"
                disabled={busyId === deletingEntity.item.id}
                onClick={() => void handleConfirmDelete()}
              >
                <Trash2 className="size-4" />
                {busyId === deletingEntity.item.id
                  ? "Borrando..."
                  : "Borrar definitivamente"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
