import { CircleAlert } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  addressAnswers,
  addressTrouble,
  unreachableDocument,
} from "@/lib/apiAddress";
import { missingAttachment } from "@/lib/attachment";
import { cn } from "@/lib/utils";

/**
 * Un documento del expediente que se abre por su enlace, con el aviso puesto
 * donde toca cuando ese enlace no lleva a ninguna parte.
 *
 * Hasta ahora un documento era un `<a href>` y ya: si su archivo se había ido del
 * almacén, o si la dirección pública de la API no era la que alcanza el
 * navegador, el enlace seguía ahí, con su pinta de funcionar, y quien lo pulsaba
 * se encontraba con una pestaña en blanco. Aquí se dice antes:
 *
 *   - **Sin archivo**: el backend no da dirección ninguna (el documento se quedó
 *     con su nombre). No hay nada que abrir y se dice con esas palabras, en vez de
 *     dejar un enlace muerto.
 *   - **Lo que se sabe sin pedirlo**: dentro de una página HTTPS, el navegador no
 *     carga un archivo servido por HTTP —contenido mixto—, y desde luego no va a
 *     buscar el archivo a un sitio que no es el de la API. Son las dos cosas que
 *     `addressTrouble` ve de un vistazo, y las dos se arreglan donde se arregla
 *     todo lo demás (`CONVEX_CLOUD_ORIGIN`).
 *   - **Lo que dice el navegador**: para el resto, se le pregunta a la dirección
 *     —una petición que no necesita permiso de lectura (`addressAnswers`)— y, si
 *     no contesta nadie, el enlace deja su sitio al aviso. Es la misma avería que
 *     la del aviso de arriba de la app, dicha aquí para este documento.
 *
 * El caso hermano —el archivo que sí está pero el navegador no lo alcanza ahora
 * mismo— se queda con un «Volver a comprobar» y un «Abrirlo de todas formas»: la
 * pestaña se abre igual si quien mira sabe lo que hace, que la app no es quién
 * para decírselo.
 */
export function DocumentLink({
  url,
  name,
  label = "Ver el archivo",
  icon,
  className,
  apiUrl,
  pageProtocol,
  probe,
}: {
  url: string | null | undefined;
  /** Cómo se llama el documento: el aviso lo nombra. */
  name: string;
  /** El texto del enlace, si el sitio lleva otro. */
  label?: string;
  /** El icono que va delante del enlace, si el sitio lo lleva. */
  icon?: ReactNode;
  /** Las clases del enlace, para que encaje donde se pone. */
  className?: string;
  /** Las dos cosas que juzgan la dirección, si quien pinta sabe más que el entorno. */
  apiUrl?: string | null;
  pageProtocol?: string | null;
  /** Cómo se le pregunta a la dirección, si quien pinta sabe mejor cómo. */
  probe?: (url: string) => Promise<boolean>;
}) {
  // Lo que se sabe de la dirección antes de pedirla.
  const trouble = addressTrouble(url, { apiUrl, pageProtocol });
  const [unreachable, setUnreachable] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // Sin dirección no hay nada que preguntar, y con una avería ya sabida
    // tampoco: la petición no contaría nada que no esté dicho.
    if (!url || trouble) return;
    let cancelled = false;
    const ask = probe ?? ((address: string) => addressAnswers(address));
    void ask(url).then((answers) => {
      if (!cancelled) setUnreachable(!answers);
    });
    return () => {
      cancelled = true;
    };
    // `attempt` está a propósito: «Volver a comprobar» vuelve a preguntar, y al
    // cambiar la clave del intento esta capa se rehace.
  }, [url, trouble, probe, attempt]);

  if (!url) {
    const missing = missingAttachment();
    return (
      <p
        className={cn("mt-0.5 text-xs text-muted-foreground", className)}
        title={missing.detail}
      >
        Sin archivo: de este documento solo quedó el nombre.
      </p>
    );
  }

  const failure = trouble ?? (unreachable ? unreachableDocument(url) : null);

  if (failure) {
    return (
      <span
        role="status"
        className="flex w-full flex-col gap-1.5 rounded-lg bg-amber-500/10 px-3 py-2.5 text-xs leading-5 text-amber-800"
      >
        <span className="flex items-start gap-2">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          <span className="font-medium">
            {name ? `No se abre «${name}»` : "No se abre este documento"} ·{" "}
            {failure.reason}
          </span>
        </span>
        <span className="pl-6">{failure.detail}</span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-6">
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto px-0 text-xs font-medium text-amber-700"
            onClick={() => {
              setUnreachable(false);
              setAttempt((count) => count + 1);
            }}
          >
            Volver a comprobar
          </Button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-amber-700 underline underline-offset-4"
          >
            Abrirlo de todas formas
          </a>
          <span className="font-mono text-[10px] break-all text-amber-800/70">
            {failure.address}
          </span>
        </span>
      </span>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={name || undefined}
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium text-signal underline-offset-4 transition-colors hover:underline",
        className,
      )}
    >
      {icon}
      {label}
    </a>
  );
}
