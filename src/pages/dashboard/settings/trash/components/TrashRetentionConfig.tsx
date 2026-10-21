import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MAX_TRASH_RETENTION_DAYS,
  MIN_TRASH_RETENTION_DAYS,
} from "@/lib/trash";
import { Trash2 } from "lucide-react";

interface TrashRetentionConfigProps {
  days: string;
  setDays: (value: string) => void;
  savingDays: boolean;
  daysValid: boolean;
  daysValue: number;
  retentionDays: number;
  disabled: boolean;
  onSaveDays: () => void | Promise<void>;
}

/**
 * Cabecera e interfaz de configuración para el plazo de retención de la papelera.
 */
export function TrashRetentionConfig({
  days,
  setDays,
  savingDays,
  daysValid,
  daysValue,
  retentionDays,
  disabled,
  onSaveDays,
}: TrashRetentionConfigProps) {
  return (
    <>
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
          <Trash2 className="size-4" />
        </span>
        <div className="max-w-2xl">
          <p className="text-sm font-semibold tracking-tight">
            Papelera del taller
          </p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            Las incidencias retiradas desde su ficha, las peticiones y los
            archivos retirados del almacén se guardan aquí {retentionDays} días
            antes de borrarse de verdad. Durante este plazo se pueden recuperar
            con su expediente, notas y repuestos intactos, o borrarlos para
            siempre sin esperar.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        <Label htmlFor="ajustes-papelera-plazo" className="text-sm">
          Plazo de la papelera (días)
        </Label>
        <div className="flex flex-wrap items-end gap-3">
          <Input
            id="ajustes-papelera-plazo"
            type="number"
            inputMode="numeric"
            min={MIN_TRASH_RETENTION_DAYS}
            max={MAX_TRASH_RETENTION_DAYS}
            step={1}
            value={days}
            disabled={disabled || savingDays}
            onChange={(event) => setDays(event.target.value)}
            className="w-28"
          />
          <Button
            type="button"
            disabled={savingDays || disabled || !daysValid}
            onClick={() => void onSaveDays()}
          >
            {savingDays ? "Guardando..." : "Guardar plazo"}
          </Button>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          {daysValid
            ? `Lo que se retire a partir de ahora se guardará ${daysValue} ${
                daysValue === 1 ? "día" : "días"
              } en la papelera antes de borrarse de verdad. Lo que ya está dentro cumple el plazo con el que entró.`
            : `Escribe un número entero de días entre ${MIN_TRASH_RETENTION_DAYS} y ${MAX_TRASH_RETENTION_DAYS}.`}
        </p>
      </div>
    </>
  );
}
