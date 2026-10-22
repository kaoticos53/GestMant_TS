import { Camera } from "lucide-react";
import type { ScannerCameraUnavailableProps } from "./types";

export function ScannerCameraUnavailable({
  errorMessage,
}: ScannerCameraUnavailableProps) {
  return (
    <div className="p-6 text-center text-zinc-300 flex flex-col items-center gap-3">
      <Camera className="size-10 text-muted-foreground opacity-50" />
      <p className="text-sm font-medium">Cámara no disponible</p>
      <p className="text-xs text-muted-foreground max-w-xs">
        {errorMessage ||
          "No se detecta un sensor de cámara o se han denegado los permisos del navegador."}
      </p>
    </div>
  );
}
