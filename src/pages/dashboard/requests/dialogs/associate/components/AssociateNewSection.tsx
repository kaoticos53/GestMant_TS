import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { AutocompleteInput } from "@/components/ui/AutocompleteInput";
import { RichTextEditor } from "@/components/RichTextEditor";
import { PART_CATEGORIES } from "@/lib/workshop";
import type { NewPartFormData } from "../types";

export interface AssociateNewSectionProps {
  form: NewPartFormData;
  onChangeField: <K extends keyof NewPartFormData>(
    field: K,
    value: NewPartFormData[K],
  ) => void;
  quantity: string;
  onChangeQuantity: (qty: string) => void;
  catalogSuppliers: { name: string }[];
  catalogCategories: { name: string }[];
  catalogLocations: { name: string }[];
  disabled: boolean;
}

export function AssociateNewSection({
  form,
  onChangeField,
  quantity,
  onChangeQuantity,
  catalogSuppliers,
  catalogCategories,
  catalogLocations,
  disabled,
}: AssociateNewSectionProps) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="new-code">Código interno *</Label>
          <Input
            id="new-code"
            value={form.code}
            onChange={(event) => onChangeField("code", event.target.value)}
            placeholder="MON-10012"
            className="font-mono"
            disabled={disabled}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="new-name">Nombre *</Label>
          <Input
            id="new-name"
            value={form.name}
            onChange={(event) => onChangeField("name", event.target.value)}
            placeholder="Monitor de realización 10 pulgadas"
            disabled={disabled}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="new-supplier">Proveedor</Label>
          <AutocompleteInput
            id="new-supplier"
            value={form.supplier}
            onChange={(value: string) => onChangeField("supplier", value)}
            items={catalogSuppliers}
            kind="supplier"
            placeholder="SmallHD"
            disabled={disabled}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="new-part-number">Nº de parte</Label>
          <Input
            id="new-part-number"
            value={form.partNumber}
            onChange={(event) => onChangeField("partNumber", event.target.value)}
            placeholder="OD-10-SDI"
            className="font-mono"
            disabled={disabled}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="new-url">URL de la ficha</Label>
          <Input
            id="new-url"
            value={form.purchaseUrl}
            onChange={(event) => onChangeField("purchaseUrl", event.target.value)}
            placeholder="https://..."
            disabled={disabled}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="new-price">Precio unitario (€)</Label>
          <Input
            id="new-price"
            inputMode="decimal"
            value={form.priceText}
            onChange={(event) => onChangeField("priceText", event.target.value)}
            placeholder="29,90"
            className="tabular-nums"
            disabled={disabled}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="new-category">Categoría</Label>
          <AutocompleteInput
            id="new-category"
            value={form.category}
            onChange={(value: string) => onChangeField("category", value)}
            items={[
              ...PART_CATEGORIES.map((cat: string) => ({ name: cat })),
              ...catalogCategories,
            ]}
            kind="partCategory"
            placeholder="p. ej. Electrónica, Conectividad..."
            disabled={disabled}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="new-unit">Unidad</Label>
          <Input
            id="new-unit"
            value={form.unit}
            onChange={(event) => onChangeField("unit", event.target.value)}
            placeholder="ud"
            disabled={disabled}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="new-stock">Stock inicial</Label>
          <Input
            id="new-stock"
            type="number"
            min={0}
            value={form.stockText}
            onChange={(event) => onChangeField("stockText", event.target.value)}
            className="tabular-nums"
            disabled={disabled}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="new-min">Stock mínimo</Label>
          <Input
            id="new-min"
            type="number"
            min={0}
            value={form.minStockText}
            onChange={(event) => onChangeField("minStockText", event.target.value)}
            className="tabular-nums"
            disabled={disabled}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="new-location">Ubicación</Label>
          <AutocompleteInput
            id="new-location"
            value={form.location}
            onChange={(value: string) => onChangeField("location", value)}
            items={catalogLocations}
            kind="partLocation"
            placeholder="D-09"
            className="font-mono"
            disabled={disabled}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="new-qty">Cantidad a asociar</Label>
          <Input
            id="new-qty"
            type="number"
            min={1}
            value={quantity}
            onChange={(event) => onChangeQuantity(event.target.value)}
            className="tabular-nums"
            disabled={disabled}
          />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="new-description">Descripción</Label>
        <RichTextEditor
          id="new-description"
          value={form.description}
          onChange={(value: string) => onChangeField("description", value)}
          placeholder="Especificaciones, nº de parte, compatibilidad..."
          disabled={disabled}
        />
      </div>
    </div>
  );
}
