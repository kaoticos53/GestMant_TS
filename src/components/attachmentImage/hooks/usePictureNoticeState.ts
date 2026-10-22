import { useEffect, useMemo, useState } from "react";
import { useAttachmentGroupPhoto } from "@/hooks/use-attachment-group";
import { attachmentFailure } from "@/lib/attachment";

export interface UsePictureNoticeStateParams {
  url: string | null | undefined;
  apiUrl?: string | null;
  pageProtocol?: string | null;
}

export function usePictureNoticeState({
  url,
  apiUrl,
  pageProtocol,
}: UsePictureNoticeStateParams) {
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

  const retry = () => {
    setFailed(false);
    setAttempt((count) => count + 1);
  };

  const handleFail = () => {
    setFailed(true);
  };

  return {
    group,
    failure,
    saidAbove,
    effectiveAttempt: attempt + (group?.attempt ?? 0),
    retry,
    handleFail,
  };
}
