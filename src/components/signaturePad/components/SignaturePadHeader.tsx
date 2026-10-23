import { PenLine, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface SignaturePadHeaderProps {
  title: string;
  description: string;
  onClear: () => void;
  canClear: boolean;
}

/**
 * Cabecera del pad de firma con título, descripción y botón para limpiar el trazo.
 */
export function SignaturePadHeader({
  title,
  description,
  onClear,
  canClear,
}: SignaturePadHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <PenLine className="size-4 text-primary" />
          {title}
        </h4>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onClear}
        disabled={!canClear}
        className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <RotateCcw className="size-3.5" />
        Limpiar
      </Button>
    </div>
  );
}
