import { CircleAlert } from "lucide-react";
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  AttachmentGroupContext,
  type AttachmentGroupValue,
} from "@/hooks/use-attachment-group";
import type { AttachmentFailure } from "@/lib/attachment";

/**
 * Las fotos de una ficha, como un grupo: cuando lo que falla es la dirección
 * pública de la API, el porqué se dice una vez aquí arriba y cada hueco se queda
 * con su icono, en vez de repetir la explicación en cada foto que se cae.
 *
 * Es el caso que se viene a arreglar: un `CONVEX_CLOUD_ORIGIN` que apunta a otro
 * sitio, o un HTTP dentro de una página HTTPS, no rompe una foto, las rompe
 * todas —son la misma dirección—, y leer el mismo párrafo cinco veces, una por
 * hueco, tapa lo que de verdad hay que hacer: arreglar la dirección. Con el grupo
 * delante se lee una vez, con un solo «Reintentar las fotos» que las pide todas
 * otra vez cuando la dirección ya esté bien.
 *
 * Qué se dice una vez y qué se sigue diciendo en cada hueco lo decide `blame`
 * (`lib/attachment`): lo de la dirección sube al grupo; lo del archivo —ya no
 * está, nunca lo tuvo— se queda en su hueco, que es de esa foto y de nadie más.
 *
 * Y con una sola foto el grupo no dice nada: no hay nada que repetir, así que el
 * aviso se queda en su sitio, con el nombre de la foto delante, como si no
 * hubiera grupo. Por eso el grupo se fija en cuántas fotos trae en vez de darlo
 * todo por dicho.
 *
 * Se pone envolviendo las fotos, sin caja propia —lo único que añade al DOM es el
 * aviso, y solo cuando hay algo que decir—:
 *
 *   <AttachmentGroup>
 *     {fotos.map((foto) => <AttachmentImage ... />)}
 *   </AttachmentGroup>
 */
export function AttachmentGroup({ children }: { children: ReactNode }) {
  const [announced, setAnnounced] = useState<AttachmentFailure | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Cuántas fotos trae el grupo. Es un ref, y no estado, porque solo se consulta
  // cuando una falla —para saber si hay repetición que evitar— y apuntarse no
  // tiene por qué volver a pintarlas.
  const photos = useRef(0);

  const enroll = useCallback(() => {
    photos.current += 1;
    return () => {
      photos.current -= 1;
    };
  }, []);

  const report = useCallback((failure: AttachmentFailure) => {
    // Una foto sola no repite nada: su aviso se queda donde está, que además
    // nombra la foto y el de arriba no puede.
    if (photos.current <= 1) return;
    setAnnounced((current) => current ?? failure);
  }, []);

  const retryAll = useCallback(() => {
    // Se vuelve a pedir todo: con la dirección arreglada, las cinco se abren y el
    // aviso se va con el intento anterior.
    setAnnounced(null);
    setAttempt((count) => count + 1);
  }, []);

  const value = useMemo<AttachmentGroupValue>(
    () => ({ announced, attempt, report, enroll }),
    [announced, attempt, report, enroll],
  );

  return (
    <AttachmentGroupContext.Provider value={value}>
      {announced && <AddressNotice failure={announced} onRetry={retryAll} />}
      {children}
    </AttachmentGroupContext.Provider>
  );
}

/**
 * El aviso de la dirección, una vez por grupo: el porqué —el mismo para todas— y
 * volver a pedirlas todas, que es lo único que se puede hacer desde aquí.
 */
function AddressNotice({
  failure,
  onRetry,
}: {
  failure: AttachmentFailure;
  onRetry: () => void;
}) {
  return (
    <div
      role="status"
      className="mb-3 flex w-full flex-col gap-1.5 rounded-lg bg-amber-500/10 px-3 py-2.5 text-xs leading-5 text-amber-800"
    >
      <span className="flex items-start gap-2">
        <CircleAlert className="mt-0.5 size-4 shrink-0" />
        <span className="font-medium">No llegan las fotos</span>
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
          Reintentar las fotos
        </Button>
        <span className="text-amber-800/80">
          La dirección es la misma para todas: el porqué se dice aquí una vez,
          no en cada hueco.
        </span>
      </span>
    </div>
  );
}
