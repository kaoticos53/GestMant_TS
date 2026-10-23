import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FILE_ACCEPT,
  MAX_FILE_SIZE_LABEL,
  exceedsFileLimit,
} from "@/lib/upload";
import type { ReceiveDeliveryNoteInputProps } from "../types";

export function ReceiveDeliveryNoteInput({
  onSelectArchivo,
  disabled = false,
}: ReceiveDeliveryNoteInputProps) {
  return (
    <div className="grid gap-2">
      <Label htmlFor="albaran">Albarán de entrega</Label>
      <Input
        id="albaran"
        type="file"
        accept={FILE_ACCEPT}
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          if (file && exceedsFileLimit(file)) {
            toast.error(`El albarán no puede pasar de ${MAX_FILE_SIZE_LABEL}.`);
            return;
          }
          onSelectArchivo(file);
        }}
        disabled={disabled}
      />
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <Upload className="size-3" />
        Foto o PDF del albarán del proveedor.
      </p>
    </div>
  );
}
