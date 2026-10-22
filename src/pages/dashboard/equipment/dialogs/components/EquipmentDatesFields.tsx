import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface EquipmentDatesFieldsProps {
  busy: boolean;
  purchaseDate: string;
  warrantyEndDate: string;
  decommissionDate: string;
  intervalDays: string;
  onPurchaseDateChange: (value: string) => void;
  onWarrantyEndDateChange: (value: string) => void;
  onDecommissionDateChange: (value: string) => void;
  onIntervalDaysChange: (value: string) => void;
}

export function EquipmentDatesFields({
  busy,
  purchaseDate,
  warrantyEndDate,
  decommissionDate,
  intervalDays,
  onPurchaseDateChange,
  onWarrantyEndDateChange,
  onDecommissionDateChange,
  onIntervalDaysChange,
}: EquipmentDatesFieldsProps) {
  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor="eq-purchase">Fecha de alta</Label>
        <Input
          id="eq-purchase"
          type="date"
          value={purchaseDate}
          onChange={(event) => onPurchaseDateChange(event.target.value)}
          disabled={busy}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="eq-warranty">Fin de garantía</Label>
        <Input
          id="eq-warranty"
          type="date"
          value={warrantyEndDate}
          onChange={(event) => onWarrantyEndDateChange(event.target.value)}
          disabled={busy}
        />
      </div>

      <div className="grid gap-2 sm:col-span-2">
        <Label htmlFor="eq-decommission">Fecha de baja</Label>
        <Input
          id="eq-decommission"
          type="date"
          value={decommissionDate}
          onChange={(event) => onDecommissionDateChange(event.target.value)}
          disabled={busy}
        />
        <p className="text-xs text-muted-foreground">
          Déjala vacía si el equipo sigue en activo.
        </p>
      </div>

      <div className="grid gap-2 sm:col-span-2">
        <Label htmlFor="eq-interval">Revisión preventiva cada (días)</Label>
        <Input
          id="eq-interval"
          type="number"
          min={1}
          step={1}
          value={intervalDays}
          onChange={(event) => onIntervalDaysChange(event.target.value)}
          placeholder="180"
          disabled={busy}
        />
        <p className="text-xs text-muted-foreground">
          Déjalo vacío si el equipo no tiene plan de mantenimiento preventivo.
        </p>
      </div>
    </>
  );
}
