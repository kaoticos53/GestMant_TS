import { cn } from "@/lib/utils";
import { usePictureNoticeState } from "../hooks/usePictureNoticeState";
import type { AttachmentImageProps } from "../types";
import { NoFileNotice } from "./NoFileNotice";
import { NotOpenedNotice } from "./NotOpenedNotice";
import { Picture } from "./Picture";
import { UnavailableNotice } from "./UnavailableNotice";

export function PictureWithNotice({
  url,
  name,
  layout = "block",
  link = false,
  frameClassName,
  imageClassName,
  apiUrl,
  pageProtocol,
}: AttachmentImageProps) {
  const {
    failure,
    saidAbove,
    effectiveAttempt,
    retry,
    handleFail,
  } = usePictureNoticeState({ url, apiUrl, pageProtocol });

  // De un documento sin archivo solo queda el nombre, y en una rejilla eso hay
  // que decirlo: un hueco vacío se lee como que la foto no ha cargado todavía.
  // En una fila de lista se dice igual, pero con la explicación entera: ahí hay
  // ancho para leerla.
  if (!url) {
    return <NoFileNotice layout={layout} frameClassName={frameClassName} />;
  }

  // En una fila de lista la miniatura deja su sitio al aviso: el marco pequeño
  // no se le pone, que lo dejaría en un cuadrado de 40 px, y el aviso va detrás
  // de lo que ya contaba la fila —quien la lee primero ve de qué va, y debajo el
  // porqué de la foto que falta—.
  if (failure && layout === "row" && !saidAbove) {
    return (
      <span className="order-last w-full">
        <NotOpenedNotice
          url={url}
          name={name}
          layout={layout}
          apiUrl={apiUrl}
          pageProtocol={pageProtocol}
          onRetry={retry}
        />
      </span>
    );
  }

  return (
    <span className={cn("relative block", frameClassName)}>
      {failure ? (
        saidAbove ? (
          <UnavailableNotice detail={failure.detail} />
        ) : (
          <NotOpenedNotice
            url={url}
            name={name}
            layout={layout}
            apiUrl={apiUrl}
            pageProtocol={pageProtocol}
            onRetry={retry}
          />
        )
      ) : (
        <Picture
          url={url}
          name={name}
          attempt={effectiveAttempt}
          link={link}
          imageClassName={imageClassName}
          onFail={handleFail}
        />
      )}
    </span>
  );
}
