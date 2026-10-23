import { AutocompleteInput } from "@/components/ui/AutocompleteInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ExternalCompanyFieldsProps } from "../types";

export function ExternalCompanyFields({
  companyName,
  setCompanyName,
  contactName,
  setContactName,
  contactPhone,
  setContactPhone,
  catalogWorkshops,
  disabled = false,
}: ExternalCompanyFieldsProps) {
  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor="companyName">
          Empresa externa / SAT <span className="text-destructive">*</span>
        </Label>
        <AutocompleteInput
          id="companyName"
          placeholder="Ej. Servicio Técnico Oficial Sony, Talleres AudioPro..."
          value={companyName}
          onChange={setCompanyName}
          items={catalogWorkshops}
          kind="externalWorkshop"
          disabled={disabled}
          autoFocus
          required
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="contactName">Persona de contacto (opcional)</Label>
          <Input
            id="contactName"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Ej. Juan Pérez"
            disabled={disabled}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="contactPhone">Teléfono de contacto (opcional)</Label>
          <Input
            id="contactPhone"
            type="tel"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="Ej. 912 345 678"
            disabled={disabled}
          />
        </div>
      </div>
    </>
  );
}
