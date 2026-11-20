import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ScannerManualFallbackProps } from "./types";

export function ScannerManualFallback({
  manualCode,
  onManualCodeChange,
  onSubmit,
}: ScannerManualFallbackProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="p-4 bg-muted/40 border-t flex flex-col gap-2"
    >
      <label
        htmlFor="manual-scan-input"
        className="text-xs font-medium text-muted-foreground"
      >
        O introduce/pega el código manualmente o mediante lector USB:
      </label>
      <div className="flex gap-2">
        <Input
          id="manual-scan-input"
          type="text"
          value={manualCode}
          onChange={(e) => onManualCodeChange(e.target.value)}
          placeholder="Ej. EQ-CAM-0042 o REP-001..."
          className="h-9 flex-1 bg-background"
        />
        <Button type="submit" size="sm" disabled={!manualCode.trim()}>
          Aceptar
        </Button>
      </div>
    </form>
  );
}
