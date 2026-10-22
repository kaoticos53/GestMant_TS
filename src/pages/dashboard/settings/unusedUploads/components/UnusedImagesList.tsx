import { AttachmentGroup } from "@/components/AttachmentGroup";
import { AttachmentImage } from "@/components/AttachmentImage";
import { formatDateTime, formatFileSize } from "@/lib/workshop";
import type { UnusedImageItem } from "../types";

export interface UnusedImagesListProps {
  images: UnusedImageItem[];
}

/**
 * Muestra la lista de fotos sin usar agrupadas con AttachmentGroup,
 * de modo que si la dirección de almacenamiento pública falla, se reporte una sola vez.
 */
export function UnusedImagesList({ images }: UnusedImagesListProps) {
  if (images.length === 0) return null;

  return (
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
                {formatFileSize(image.size)} · sin citar en ninguna incidencia
              </p>
            </div>
          </li>
        ))}
      </ul>
    </AttachmentGroup>
  );
}
