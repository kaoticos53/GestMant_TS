import { Button } from "@/components/ui/button";
import {
  applyOfferedUpdate,
  dismissUpdate,
  isUpdateReady,
  subscribeUpdateReady,
} from "@/lib/pwaUpdate";
import { BUILD_NUMBER } from "@/version";
import { useSyncExternalStore } from "react";

/**
 * El aviso de compilación nueva. Dice qué build sirve esta pestaña para que
 * nadie depure una interfaz vieja creyendo que es la última, y no recarga hasta
 * que alguien pulsa «Recargar».
 *
 * Va arriba —a la izquierda en escritorio— y no abajo a la derecha, que es donde
 * sonner apila sus avisos: compartir esquina dejaría el «Recargar» debajo de un
 * toast en cuanto saliera uno. Arriba es la única zona que sonner no usa.
 */
export function PwaUpdateBanner() {
  const ready = useSyncExternalStore(
    subscribeUpdateReady,
    isUpdateReady,
    () => false,
  );
  if (!ready) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-3 top-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-lg border border-border bg-background p-3 shadow-lg sm:inset-x-auto sm:top-4 sm:left-4"
    >
      <div className="min-w-0 flex-1 text-xs leading-5">
        <p className="font-medium text-foreground">Hay una versión nueva</p>
        <p className="text-muted-foreground">Esta pestaña sirve la b{BUILD_NUMBER}.</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button type="button" variant="ghost" size="sm" onClick={dismissUpdate}>
          Luego
        </Button>
        <Button type="button" size="sm" onClick={applyOfferedUpdate}>
          Recargar
        </Button>
      </div>
    </div>
  );
}
