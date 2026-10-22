import { Button } from "@/components/ui/button";
import type { ChangelogFooterProps } from "../types";

export function ChangelogFooter({ onClose }: ChangelogFooterProps) {
  return (
    <div className="p-4 border-t border-border/60 bg-muted/10 flex items-center justify-between text-xs text-muted-foreground">
      <span>Pulso Taller · Registro de versiones y trazabilidad</span>
      <Button
        size="sm"
        variant="outline"
        onClick={onClose}
        className="h-8 text-xs"
      >
        Cerrar
      </Button>
    </div>
  );
}
