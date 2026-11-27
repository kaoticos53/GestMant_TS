import { useRef } from "react";
import { toast } from "sonner";
import { Paperclip, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FILE_ACCEPT,
  MAX_FILE_SIZE_LABEL,
  exceedsFileLimit,
} from "@/lib/upload";
import type { ReceiveDeliveryNoteInputProps } from "../types";

export function ReceiveDeliveryNoteInput({
  archivo,
  onSelectArchivo,
  disabled = false,
}: ReceiveDeliveryNoteInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClear = () => {
    onSelectArchivo(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <div className="grid gap-2">
      <Label htmlFor="albaran">Albarán de entrega (opcional)</Label>
      <Input
        ref={inputRef}
        id="albaran"
        type="file"
        accept={FILE_ACCEPT}
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          if (file && exceedsFileLimit(file)) {
            toast.error(`El albarán no puede pasar de ${MAX_FILE_SIZE_LABEL}.`);
            event.target.value = "";
            return;
          }
          onSelectArchivo(file);
        }}
        disabled={disabled}
      />
      {archivo && (
        <div className="flex min-w-0 items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-xs">
          <span className="flex min-w-0 items-center gap-1.5 font-medium">
            <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{archivo.name}</span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 shrink-0 gap-1 px-2 text-xs text-muted-foreground hover:text-destructive"
            onClick={handleClear}
            disabled={disabled}
            aria-label="Quitar albarán adjunto"
          >
            <X className="size-3.5" />
            Quitar
          </Button>
        </div>
      )}
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <Upload className="size-3" />
        Opcional. Foto o PDF del albarán del proveedor.
      </p>
    </div>
  );
}
