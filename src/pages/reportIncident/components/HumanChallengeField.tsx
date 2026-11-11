import type { RefObject } from "react";

interface HumanChallengeFieldProps {
  visible: boolean;
  containerRef: RefObject<HTMLDivElement | null>;
  error: string | null;
}

/**
 * Contenedor del widget Cloudflare Turnstile (modo Managed/invisible).
 * Solo se renderiza para visitantes sin sesión cuando `VITE_TURNSTILE_SITE_KEY`
 * está configurada; en modo PoW no muestra ningún elemento visual.
 */
export function HumanChallengeField({
  visible,
  containerRef,
  error,
}: HumanChallengeFieldProps) {
  if (!visible) return null;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div ref={containerRef} />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

