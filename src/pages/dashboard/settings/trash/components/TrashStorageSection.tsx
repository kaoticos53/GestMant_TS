import { AttachmentGroup } from "@/components/AttachmentGroup";
import { AttachmentImage } from "@/components/AttachmentImage";
import { Button } from "@/components/ui/button";
import type { TrashItem } from "@/convex/trash";
import { trashRemainingLabel } from "@/lib/trash";
import { formatDateTime, formatFileSize } from "@/lib/workshop";
import { ExternalLink, File, Trash2, Undo2 } from "lucide-react";
import { TrashSection } from "./TrashSection";

interface TrashStorageSectionProps {
  trashData?: {
    pendingBytes?: number;
    nextPurgeAt?: number | null;
  };
  storagePending: TrashItem[];
  storageKept: TrashItem[];
  storageTotal: number;
  retentionDays: number;
  busyId: string | null;
  onRestore: (item: TrashItem) => void | Promise<void>;
  onDelete: (item: TrashItem) => void;
}

/**
 * Sección de visualización y acciones para archivos del almacén en la papelera.
 */
export function TrashStorageSection({
  trashData,
  storagePending,
  storageKept,
  storageTotal,
  retentionDays,
  busyId,
  onRestore,
  onDelete,
}: TrashStorageSectionProps) {
  if (storageTotal === 0) return null;

  const renderStorageRow = (item: TrashItem) => (
    <li
      key={item.id}
      className="flex flex-wrap items-center gap-3 rounded-lg border border-border/70 bg-background/60 p-2.5"
    >
      {item.kind === "image" ? (
        <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
          <AttachmentImage
            url={item.url}
            name=""
            layout="row"
            frameClassName="size-full"
            imageClassName="size-full object-cover"
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
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
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
            onClick={() => void onRestore(item)}
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
          onClick={() => onDelete(item)}
        >
          <Trash2 className="size-4" />
          Borrar
        </Button>
      </div>
    </li>
  );

  return (
    <TrashSection title="Archivos del almacén" count={storageTotal}>
      {storagePending.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground">
            {`${storagePending.length} ${
              storagePending.length === 1 ? "archivo" : "archivos"
            } · ${formatFileSize(trashData?.pendingBytes ?? 0)} · ${
              trashData?.nextPurgeAt === null ||
              trashData?.nextPurgeAt === undefined
                ? "se borran al cumplir su plazo"
                : `el primero ${trashRemainingLabel(trashData.nextPurgeAt)}`
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
            Rescatados ({storageKept.length}): no se borran solos, solo si los
            borras tú.
          </p>
          <AttachmentGroup>
            <ul className="mt-2 grid gap-2">
              {storageKept.map(renderStorageRow)}
            </ul>
          </AttachmentGroup>
        </>
      )}
    </TrashSection>
  );
}
