import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ExternalDefectFieldsProps } from "../types";

export function ExternalDefectFields({
  includedAccessories,
  setIncludedAccessories,
  defectNotes,
  setDefectNotes,
  dispatchNotes,
  setDispatchNotes,
  disabled = false,
}: ExternalDefectFieldsProps) {
  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor="includedAccessories">
          Accesorios incluidos en el envío (opcional)
        </Label>
        <Input
          id="includedAccessories"
          value={includedAccessories}
          onChange={(e) => setIncludedAccessories(e.target.value)}
          placeholder="Ej. Batería, cargador, cable de control"
          disabled={disabled}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="defectNotes">
          Descripción de la avería / Trabajos a realizar{" "}
          <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="defectNotes"
          value={defectNotes}
          onChange={(e) => setDefectNotes(e.target.value)}
          placeholder="Describe el síntoma o los trabajos solicitados..."
          rows={3}
          disabled={disabled}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="dispatchNotes">
          Notas internas de expedición / Transporte (opcional)
        </Label>
        <Textarea
          id="dispatchNotes"
          value={dispatchNotes}
          onChange={(e) => setDispatchNotes(e.target.value)}
          placeholder="Ej. Enviado con agencia SEUR - Nº seguimiento..."
          rows={2}
          disabled={disabled}
        />
      </div>
    </>
  );
}
