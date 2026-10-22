import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EquipmentDoc, PartDoc } from "../types";

export interface AssociateExistingSectionProps {
  requestEquipment: EquipmentDoc | undefined;
  compatiblePartsCount: number;
  allPartsCount: number;
  showOnlyCompatible: boolean;
  onToggleOnlyCompatible: () => void;
  visibleParts: PartDoc[];
  selectedId: string;
  onSelectPart: (id: string) => void;
  quantity: string;
  onChangeQuantity: (qty: string) => void;
  disabled: boolean;
}

export function AssociateExistingSection({
  requestEquipment,
  compatiblePartsCount,
  allPartsCount,
  showOnlyCompatible,
  onToggleOnlyCompatible,
  visibleParts,
  selectedId,
  onSelectPart,
  quantity,
  onChangeQuantity,
  disabled,
}: AssociateExistingSectionProps) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="associate-part">Repuesto del catálogo</Label>
        {requestEquipment && (
          <div className="flex flex-wrap items-center gap-2">
            {compatiblePartsCount > 0 ? (
              <button
                type="button"
                onClick={onToggleOnlyCompatible}
                disabled={disabled}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  showOnlyCompatible
                    ? "border-signal bg-signal/10 text-signal"
                    : "border-border/70 text-muted-foreground hover:text-foreground",
                )}
              >
                {showOnlyCompatible
                  ? `Solo compatibles con ${requestEquipment.model} (${compatiblePartsCount})`
                  : `Ver todo el catálogo (${allPartsCount})`}
              </button>
            ) : (
              <span className="text-xs text-muted-foreground">
                Sin repuestos marcados como compatibles con{" "}
                {requestEquipment.model}: se muestra todo el catálogo.
              </span>
            )}
          </div>
        )}
        <Select value={selectedId} onValueChange={onSelectPart}>
          <SelectTrigger
            id="associate-part"
            className="w-full"
            disabled={disabled}
          >
            <SelectValue placeholder="Buscar por código o nombre" />
          </SelectTrigger>
          <SelectContent>
            {visibleParts.map((part) => (
              <SelectItem key={part._id} value={part._id}>
                {part.code} — {part.name} (stock {part.stock})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid w-32 gap-2">
        <Label htmlFor="associate-qty">Cantidad</Label>
        <Input
          id="associate-qty"
          type="number"
          min={1}
          value={quantity}
          onChange={(event) => onChangeQuantity(event.target.value)}
          className="tabular-nums"
          disabled={disabled}
        />
      </div>
    </div>
  );
}
