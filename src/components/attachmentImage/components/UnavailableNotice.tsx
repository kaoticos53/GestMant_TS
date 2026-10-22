import { ImageOff } from "lucide-react";

export interface UnavailableNoticeProps {
  detail: string;
}

/**
 * El hueco de una foto que no se abre cuando el porqué ya está dicho arriba, en
 * el aviso del grupo: se queda con su icono —en un cuadrado o en una rejilla, da
 * igual, que se estira con el marco que le pongan— y el porqué largo, en el
 * `title`, para quien lo quiera leer entero sin buscarlo en otra parte.
 */
export function UnavailableNotice({ detail }: UnavailableNoticeProps) {
  return (
    <span
      title={detail}
      className="flex size-full min-h-10 items-center justify-center bg-muted/60 text-muted-foreground"
    >
      <ImageOff className="size-4" />
    </span>
  );
}
