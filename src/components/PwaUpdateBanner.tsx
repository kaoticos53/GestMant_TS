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
 * Va abajo y a la izquierda en escritorio, no a la derecha: esa esquina es donde
 * sonner apila sus avisos y el «Recargar» quedaría debajo de un toast. En móvil
 * ocupa el ancho de abajo, y mientras está visible el `Toaster` sube sus avisos
 * con `mobileOffset` (ver `components/ui/sonner.tsx`), así que tampoco se pisan.
 *
 * Arriba no cabe: en móvil comparte sitio con la cabecera del sitio y con el
 * aviso de dirección de la API, y tapar un error de configuración con un «hay
 * versión nueva» sería al revés de lo que hace falta.
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
      className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-lg border border-border bg-background p-3 shadow-lg sm:inset-x-auto sm:bottom-4 sm:left-4"
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
