import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AutocompleteInput } from "@/components/ui/AutocompleteInput";

export interface EquipmentDetailsFieldsProps {
  busy: boolean;
  location: string;
  serialNumber: string;
  supplier: string;
  catalogLocations: { id: string; name: string }[];
  catalogSuppliers: { id: string; name: string }[];
  onLocationChange: (value: string) => void;
  onSerialNumberChange: (value: string) => void;
  onSupplierChange: (value: string) => void;
}

export function EquipmentDetailsFields({
  busy,
  location,
  serialNumber,
  supplier,
  catalogLocations,
  catalogSuppliers,
  onLocationChange,
  onSerialNumberChange,
  onSupplierChange,
}: EquipmentDetailsFieldsProps) {
  return (
    <>
      <div className="grid gap-2 sm:col-span-2">
        <Label htmlFor="eq-location">Ubicación</Label>
        <AutocompleteInput
          id="eq-location"
          value={location}
          onChange={onLocationChange}
          items={catalogLocations}
          kind="equipmentLocation"
          placeholder="Plató 1"
          disabled={busy}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="eq-serial">Nº de serie</Label>
        <Input
          id="eq-serial"
          value={serialNumber}
          onChange={(event) => onSerialNumberChange(event.target.value)}
          placeholder="FX888D-2505-0147"
          className="font-mono"
          disabled={busy}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="eq-supplier">Proveedor</Label>
        <AutocompleteInput
          id="eq-supplier"
          value={supplier}
          onChange={onSupplierChange}
          items={catalogSuppliers}
          kind="supplier"
          placeholder="Farnell"
          disabled={busy}
        />
      </div>
    </>
  );
}
