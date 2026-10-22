import { useAttachmentGroup } from "@/hooks/use-attachment-group";
import { PictureWithNotice } from "./attachmentImage/components/PictureWithNotice";
import type {
  AttachmentImageProps,
  AttachmentLayout,
} from "./attachmentImage/types";

export type { AttachmentImageProps, AttachmentLayout };

/**
 * Una foto del taller —un adjunto de una petición, una imagen dentro de una
 * nota— que, cuando no se abre, se convierte en el aviso de por qué.
 *
 * El fallo se detecta donde ocurre, en el propio navegador: la foto se pide con
 * su dirección pública y, si esa dirección no llega, el navegador avisa a onError.
 * Ahí es donde se cambia la foto por el aviso de por qué.
 */
export function AttachmentImage(props: AttachmentImageProps) {
  // El grupo se lee aquí —sin apuntarse— solo para el intento en curso: al
  // «Reintentar las fotos», la capa se rehace igual que si hubiera cambiado de
  // foto, y cada una vuelve a pedir la suya sin el fallo de antes.
  const group = useAttachmentGroup();
  return (
    <PictureWithNotice
      key={`${props.url ?? ""}|${group?.attempt ?? 0}`}
      {...props}
    />
  );
}
