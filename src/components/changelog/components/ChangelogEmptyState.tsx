import { Info } from "lucide-react";

export function ChangelogEmptyState() {
  return (
    <div className="py-12 text-center text-muted-foreground">
      <Info className="size-8 mx-auto mb-2 opacity-50" />
      <p className="text-sm font-medium">No se encontraron cambios</p>
      <p className="text-xs text-muted-foreground/80 mt-1">
        Prueba a ajustar la búsqueda o el filtro de categoría.
      </p>
    </div>
  );
}
