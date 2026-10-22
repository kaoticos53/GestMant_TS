import { Button } from "@/components/ui/button";
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
        <input
          id="manual-scan-input"
          type="text"
          value={manualCode}
          onChange={(e) => onManualCodeChange(e.target.value)}
          placeholder="Ej. EQ-CAM-0042 o REP-001..."
          className="flex-1 h-9 px-3 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary"
        />
        <Button type="submit" size="sm" disabled={!manualCode.trim()}>
          Aceptar
        </Button>
      </div>
    </form>
  );
}
