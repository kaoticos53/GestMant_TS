import { cn } from "@/lib/utils";
import { withAttempt } from "../helpers";

export interface PictureProps {
  url: string;
  name: string;
  attempt: number;
  link: boolean;
  imageClassName?: string;
  onFail: () => void;
}

/** La foto en sí, con su enlace si se abre en otra pestaña. */
export function Picture({
  url,
  name,
  attempt,
  link,
  imageClassName,
  onFail,
}: PictureProps) {
  const image = (
    <img
      // La clave cambia con cada intento: el navegador vuelve a pedir la foto en
      // lugar de quedarse con el error que ya tenía.
      key={attempt}
      src={withAttempt(url, attempt)}
      alt={name}
      title={name || undefined}
      loading="lazy"
      onError={onFail}
      className={cn(!link && "block max-w-full", imageClassName)}
    />
  );

  if (!link) return image;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={name}
      className="block size-full"
    >
      {image}
    </a>
  );
}
