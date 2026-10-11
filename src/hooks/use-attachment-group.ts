import { createContext, useContext, useEffect } from "react";

import type { AttachmentFailure } from "@/lib/attachment";

/**
 * El grupo de fotos de una ficha, tal y como lo ven las fotos de dentro.
 *
 * Es el enganche —y el contexto— de `AttachmentGroup` (`components`), que es
 * quien lo pone: aquí solo está lo que una foto necesita para no repetir el porqué
 * de la dirección pública y para volver a pedirse cuando el grupo la reintenta.
 * Va en su propio módulo, como los demás enganches del taller, para que el
 * componente que lo envuelve solo exporte componentes.
 */
export interface AttachmentGroupValue {
  /** El intento en curso: al cambiar, cada foto vuelve a pedir la suya. */
  attempt: number;
  /** Lo que el grupo está diciendo por todas; `null` mientras no haya nada. */
  announced: AttachmentFailure | null;
  /** Una foto cuenta que la dirección pública no le llega. */
  report: (failure: AttachmentFailure) => void;
  /** Una foto se apunta al grupo —y se borra sola al irse—. */
  enroll: () => () => void;
}

export const AttachmentGroupContext =
  createContext<AttachmentGroupValue | null>(null);

/** El grupo tal y como está ahora, para quien solo necesita leerlo. */
export function useAttachmentGroup(): AttachmentGroupValue | null {
  return useContext(AttachmentGroupContext);
}

/**
 * Lo mismo, y además la foto se apunta: a partir de aquí el grupo sabe que esta
 * foto existe. Lo usa la capa de dentro de `AttachmentImage`, que es la que lleva
 * la cuenta de una foto concreta.
 */
export function useAttachmentGroupPhoto(): AttachmentGroupValue | null {
  const group = useAttachmentGroup();
  const enroll = group?.enroll;
  useEffect(() => enroll?.(), [enroll]);
  return group;
}
