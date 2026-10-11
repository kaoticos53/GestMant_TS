import { CircleAlert, ImageOff } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  useAttachmentGroup,
  useAttachmentGroupPhoto,
} from "@/hooks/use-attachment-group";
import { attachmentFailure, missingAttachment } from "@/lib/attachment";
import { cn } from "@/lib/utils";

/**
 * Las tres formas de enseñar una foto, según dónde caiga.
 *
 *   - `cell`: el hueco cuadrado de una rejilla de adjuntos.
 *   - `block`: ancho, dentro de un texto (una nota, una descripción).
 *   - `row`: la miniatura de una fila de lista, que solo ocupa su sitio mientras
 *     hay foto: cuando no se puede abrir, el aviso se lleva la fila entera.
 */
export type AttachmentLayout = "cell" | "block" | "row";

type AttachmentImageProps = {
  url: string | null | undefined;
  /** Con qué se identifica la foto: el `alt` y el nombre del aviso. */
  name: string;
  /** Dónde cae la foto: el hueco de una rejilla, un texto o una fila de lista. */
  layout?: AttachmentLayout;
  /** ¿La foto se abre en otra pestaña al pulsarla? */
  link?: boolean;
  /**
   * Las clases del marco —la celda, la miniatura—. Valen para los dos estados,
   * salvo en una fila de lista: allí el aviso no cabe en el marco y se lleva la
   * fila entera.
   */
  frameClassName?: string;
  /** Las clases de la propia foto. */
  imageClassName?: string;
  /**
   * Las dos cosas que hacen falta para juzgar el fallo —la dirección de la API
   * y si la página va por HTTPS—, solo si quien pinta la foto las sabe mejor que
   * el entorno. De normal se dejan sin poner y las mira el propio aviso.
   */
  apiUrl?: string | null;
  pageProtocol?: string | null;
};

/**
 * Una foto del taller —un adjunto de una petición, una imagen dentro de una
 * nota— que, cuando no se abre, se convierte en el aviso de por qué.
 *
 * El fallo se detecta donde ocurre, en el propio navegador: la foto se pide con
 * su dirección pública y, si esa dirección no llega (otro dominio, HTTP dentro de
 * una página HTTPS, un archivo que ya no está), el navegador avisa a `onError`.
 * Ahí es donde se cambia la foto por el aviso, en lugar de dejar el hueco con el
 * icono roto: quien mira la ficha se entera de si el archivo se ha perdido o de
 * si es la dirección la que está mal, y puede volver a intentarlo.
 *
 * Y el caso hermano también va aquí: cuando el documento se quedó sin archivo (el
 * backend no da dirección ninguna), el hueco lo dice, que si no se lee como una
 * foto que aún no ha cargado.
 *
 * Tres formas de enseñarlo, según dónde caiga la foto:
 *
 *   - `cell`: el hueco cuadrado de una rejilla de adjuntos. Poco sitio: el icono,
 *     el motivo en corto y un «Reintentar»; la explicación larga, en el `title`.
 *   - `block`: dentro de un texto (una nota, una descripción), donde sí cabe la
 *     explicación entera y la dirección que ha fallado.
 *   - `row`: la miniatura de 40 px de una fila de lista —la papelera del almacén,
 *     las imágenes sin usar del formulario—, donde el aviso no cabe dentro del
 *     hueco: la miniatura ocupa su sitio mientras hay foto y, cuando no se abre,
 *     el aviso entero se lleva la fila. La fila tiene que dejar envolver sus
 *     piezas (un `flex-wrap`), que el aviso va detrás de lo demás: quien lee la
 *     fila ve primero de qué va y debajo por qué le falta la foto.
 *
 * El estado —si falló y cuántas veces se ha intentado— es de una foto concreta,
 * así que vive en una capa de dentro con la dirección por `key`: al cambiar de
 * foto (otra petición, otra nota) la capa se rehace y se empieza de cero, en vez
 * de arrastrar el aviso de la anterior.
 *
 * Dentro de un `AttachmentGroup` —las fotos de una ficha— el aviso se reparte: lo
 * que es de la dirección pública se dice una vez arriba, y el hueco se queda con
 * su icono, que leer el mismo párrafo en cada foto no arregla nada. Lo que es del
 * archivo —ya no está, o nunca lo tuvo— sigue diciéndose aquí, que es cosa de
 * esta foto y de ninguna otra.
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

function PictureWithNotice({
  url,
  name,
  layout = "block",
  link = false,
  frameClassName,
  imageClassName,
  apiUrl,
  pageProtocol,
}: AttachmentImageProps) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // El grupo de la ficha, si lo hay: la foto se le apunta —para que sepa cuántas
  // van— y le cuenta lo que es de la dirección pública.
  const group = useAttachmentGroupPhoto();

  const failure = useMemo(
    () =>
      failed && url ? attachmentFailure(url, { apiUrl, pageProtocol }) : null,
    [failed, url, apiUrl, pageProtocol],
  );

  // Lo que es de la dirección se cuenta arriba, una vez, en lugar de repetirlo
  // aquí: el grupo lo enseña por todas y ofrece volver a pedirlas todas.
  const report = group?.report;
  useEffect(() => {
    if (failure && failure.blame === "address") report?.(failure);
  }, [failure, report]);

  // Con el grupo diciéndolo, el hueco se queda con su icono y el porqué largo en
  // el `title`.
  const saidAbove = failure?.blame === "address" && group?.announced != null;

  // De un documento sin archivo solo queda el nombre, y en una rejilla eso hay
  // que decirlo: un hueco vacío se lee como que la foto no ha cargado todavía.
  // En una fila de lista se dice igual, pero con la explicación entera: ahí hay
  // ancho para leerla. Va después del grupo porque `useAttachmentGroupPhoto` es
  // un enganche, y los enganches van todos antes de cualquier salida.
  if (!url) {
    if (layout === "cell") {
      return (
        <span
          className={cn(
            "flex flex-col items-center justify-center gap-1 bg-muted/60 text-muted-foreground",
            frameClassName,
          )}
        >
          <ImageOff className="size-4" />
          <span className="text-[10px] leading-tight">
            {missingAttachment().reason}
          </span>
        </span>
      );
    }
    if (layout === "row") return <NoFile />;
    return null;
  }

  const retry = () => {
    setFailed(false);
    setAttempt((count) => count + 1);
  };

  // En una fila de lista la miniatura deja su sitio al aviso: el marco pequeño
  // no se le pone, que lo dejaría en un cuadrado de 40 px, y el aviso va detrás
  // de lo que ya contaba la fila —quien la lee primero ve de qué va, y debajo el
  // porqué de la foto que falta—.
  if (failure && layout === "row" && !saidAbove) {
    return (
      <span className="order-last w-full">
        <NotOpened
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
          <Unavailable detail={failure.detail} />
        ) : (
          <NotOpened
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
          // El intento del grupo cuenta como intento propio: al reintentar todas,
          // la foto se pide con dirección nueva y el navegador no puede contestar
          // con el error que ya tenía guardado.
          attempt={attempt + (group?.attempt ?? 0)}
          link={link}
          imageClassName={imageClassName}
          onFail={() => setFailed(true)}
        />
      )}
    </span>
  );
}

/** La foto en sí, con su enlace si se abre en otra pestaña. */
function Picture({
  url,
  name,
  attempt,
  link,
  imageClassName,
  onFail,
}: {
  url: string;
  name: string;
  attempt: number;
  link: boolean;
  imageClassName?: string;
  onFail: () => void;
}) {
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

/** El aviso que ocupa el sitio de la foto que no se ha podido abrir. */
function NotOpened({
  url,
  name,
  layout,
  apiUrl,
  pageProtocol,
  onRetry,
}: {
  url: string;
  name: string;
  layout: AttachmentLayout;
  apiUrl?: string | null;
  pageProtocol?: string | null;
  onRetry: () => void;
}) {
  const failure = attachmentFailure(url, { apiUrl, pageProtocol });

  if (layout === "cell") {
    return (
      <span
        role="status"
        title={failure.detail}
        className="flex size-full flex-col items-center justify-center gap-1 bg-muted/60 px-2 text-center"
      >
        <CircleAlert className="size-4 text-amber-600" />
        <span className="text-[11px] font-medium leading-tight">
          No se abre
        </span>
        <span className="text-[10px] leading-tight text-muted-foreground">
          {failure.reason}
        </span>
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={onRetry}
          className="h-auto px-0 text-[10px] font-medium"
        >
          Reintentar
        </Button>
      </span>
    );
  }

  return (
    <span
      role="status"
      className="flex w-full flex-col gap-1.5 rounded-lg bg-amber-500/10 px-3 py-2.5 text-xs leading-5 text-amber-800"
    >
      <span className="flex items-start gap-2">
        <CircleAlert className="mt-0.5 size-4 shrink-0" />
        <span className="font-medium">
          {name ? `No se abre «${name}»` : "No se abre este adjunto"}
        </span>
      </span>
      <span className="pl-6">{failure.detail}</span>
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-6">
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={onRetry}
          className="h-auto px-0 text-xs font-medium text-amber-700"
        >
          Reintentar
        </Button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-amber-700 underline underline-offset-4"
        >
          Abrir la dirección
        </a>
        <span className="font-mono text-[10px] break-all text-amber-800/70">
          {failure.address}
        </span>
      </span>
    </span>
  );
}

/**
 * El hueco de una foto que no se abre cuando el porqué ya está dicho arriba, en
 * el aviso del grupo: se queda con su icono —en un cuadrado o en una rejilla, da
 * igual, que se estira con el marco que le pongan— y el porqué largo, en el
 * `title`, para quien lo quiera leer entero sin buscarlo en otra parte.
 */
function Unavailable({ detail }: { detail: string }) {
  return (
    <span
      title={detail}
      className="flex size-full min-h-10 items-center justify-center bg-muted/60 text-muted-foreground"
    >
      <ImageOff className="size-4" />
    </span>
  );
}

/**
 * El aviso de un adjunto que se quedó sin archivo, en la fila de una lista: el
 * mismo trazo que el de una foto que no llega, pero sin `Reintentar` ni
 * dirección que abrir —no hay ninguna—.
 */
function NoFile() {
  const missing = missingAttachment();
  return (
    <span
      role="status"
      className="flex w-full flex-col gap-1.5 rounded-lg bg-amber-500/10 px-3 py-2.5 text-xs leading-5 text-amber-800"
    >
      <span className="flex items-start gap-2">
        <ImageOff className="mt-0.5 size-4 shrink-0" />
        <span className="font-medium">{missing.reason}</span>
      </span>
      <span className="pl-6">{missing.detail}</span>
    </span>
  );
}

/**
 * La misma dirección con el número del intento detrás. Sin eso, «Reintentar»
 * pediría lo mismo que ya falló y el navegador podría contestar con lo que tiene
 * guardado; con eso, la petición es nueva.
 */
function withAttempt(url: string, attempt: number): string {
  if (attempt === 0) return url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("reintento", String(attempt));
    return parsed.toString();
  } catch {
    return url;
  }
}
