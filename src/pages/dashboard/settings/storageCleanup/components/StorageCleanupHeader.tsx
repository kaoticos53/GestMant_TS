import { Button } from "@/components/ui/button";
import { Play, Trash2 } from "lucide-react";
import type { StorageCleanupHeaderProps } from "../types";

export function StorageCleanupHeader({
  running,
  disabled,
  onRunNow,
}: StorageCleanupHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Trash2 className="size-4" />
        </span>
        <div className="max-w-xl">
          <p className="text-sm font-semibold tracking-tight">
            Limpieza del almacén
          </p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            Cada madrugada el taller retira los archivos que ya no usa nadie:
            lo que dejó a medias el formulario público y los que ya no cita
            ninguna ficha. Lo retirado se guarda unos días en la papelera, que
            vacía la tercera pasada. Aquí ves la última vez de cada una
            —cuándo fue y qué se llevó— y las puedes adelantar de una vez.
          </p>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        className="gap-2"
        disabled={running || disabled}
        onClick={onRunNow}
      >
        <Play className="size-4" />
        {running ? "Limpiando..." : "Ejecutar ahora"}
      </Button>
    </div>
  );
}
