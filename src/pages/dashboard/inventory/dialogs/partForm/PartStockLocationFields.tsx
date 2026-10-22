import { AutocompleteInput } from "@/components/ui/AutocompleteInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PartStockLocationFieldsProps } from "./types";

export function PartStockLocationFields({
  form,
  catalogLocations,
  catalogSuppliers,
  updateField,
  disabled,
}: PartStockLocationFieldsProps) {
  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor="part-stock">Stock actual</Label>
        <Input
          id="part-stock"
          type="number"
          min={0}
          value={form.stockText}
          onChange={(event) => updateField("stockText", event.target.value)}
          className="tabular-nums"
          disabled={disabled}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="part-min">Stock mínimo</Label>
        <Input
          id="part-min"
          type="number"
          min={0}
          value={form.minStockText}
          onChange={(event) => updateField("minStockText", event.target.value)}
          className="tabular-nums"
          disabled={disabled}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="part-location">Ubicación</Label>
        <AutocompleteInput
          id="part-location"
          value={form.location}
          onChange={(value) => updateField("location", value)}
          items={catalogLocations}
          kind="partLocation"
          placeholder="B-03"
          className="font-mono"
          disabled={disabled}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="part-supplier">Proveedor</Label>
        <AutocompleteInput
          id="part-supplier"
          value={form.supplier}
          onChange={(value) => updateField("supplier", value)}
          items={catalogSuppliers}
          kind="supplier"
          placeholder="Mean Well"
          disabled={disabled}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="part-number">Nº de parte</Label>
        <Input
          id="part-number"
          value={form.partNumber}
          onChange={(event) => updateField("partNumber", event.target.value)}
          placeholder="NDR-150-24"
          className="font-mono"
          disabled={disabled}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="part-price">Precio unitario (€)</Label>
        <Input
          id="part-price"
          inputMode="decimal"
          value={form.priceText}
          onChange={(event) => updateField("priceText", event.target.value)}
          placeholder="2,35"
          className="tabular-nums"
          disabled={disabled}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="part-url">Ficha del proveedor</Label>
        <Input
          id="part-url"
          value={form.purchaseUrl}
          onChange={(event) => updateField("purchaseUrl", event.target.value)}
          placeholder="https://..."
          disabled={disabled}
        />
      </div>
    </>
  );
}
