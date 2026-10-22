import { ChangelogDialog } from "@/components/changelog/ChangelogDialog";
import { DETAILED_VERSION, FULL_VERSION } from "@/version";
import { useState } from "react";
import { CONTENEDOR } from "../constants";

/**
 * Pie de página de la portada con versión del sistema, bitácora de cambios y derechos.
 */
export function LandingFooter() {
  const [showChangelog, setShowChangelog] = useState(false);

  return (
    <>
      <footer className="border-t border-border/70 py-12 sm:py-14 lg:py-20">
        <div className={CONTENEDOR}>
          <div className="flex flex-col items-center justify-between gap-2 text-xs text-muted-foreground sm:flex-row">
            <button
              type="button"
              onClick={() => setShowChangelog(true)}
              className="cursor-pointer text-left transition-colors hover:text-foreground"
              title={`${DETAILED_VERSION} · Ver bitácora de cambios entre versiones`}
            >
              {FULL_VERSION}
              <span className="hidden sm:inline">
                {" "}
                · Sistema de Gestión de Mantenimiento Broadcast
              </span>
            </button>
            <p>
              © {new Date().getFullYear()} RGLara. Todos los derechos
              reservados.
            </p>
          </div>
        </div>
      </footer>

      <ChangelogDialog open={showChangelog} onOpenChange={setShowChangelog} />
    </>
  );
}
