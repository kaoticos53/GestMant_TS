import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Moon } from "lucide-react";
import type { AutomaticArchiveHeaderProps } from "../types";

export function AutomaticArchiveHeader({
  enabled,
  isLoading,
  disabled,
  onToggle,
}: AutomaticArchiveHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-signal/10 text-signal">
          <Moon className="size-4" />
        </span>
        <div className="max-w-xl">
          <p className="text-sm font-semibold tracking-tight">
            Archivado automático
          </p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            Cada noche el taller manda solo al archivo lo que ya está
            terminado —incidencias cerradas y peticiones ya decididas—
            anterior a la antigüedad elegida. No se borra nada: todo sigue en
            el módulo Archivo.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "text-xs font-medium",
            enabled ? "text-signal" : "text-muted-foreground",
          )}
        >
          {isLoading
            ? "Cargando..."
            : enabled
              ? "Activado"
              : "Desactivado"}
        </span>
        <Switch
          checked={enabled}
          disabled={disabled}
          aria-label="Archivado automático de cada noche"
          onCheckedChange={onToggle}
        />
      </div>
    </div>
  );
}
