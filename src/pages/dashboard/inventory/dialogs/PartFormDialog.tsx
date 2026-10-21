import { useQuery } from "convex/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AutocompleteInput } from "@/components/ui/AutocompleteInput";
import { RichTextEditor } from "@/components/RichTextEditor";
import { api } from "@/convex/_generated/api";
import { PART_CATEGORIES } from "@/lib/workshop";
import { usePartForm } from "../hooks/usePartForm";
import { CompatibleModelsSection } from "../components/CompatibleModelsSection";
import type { EquipmentModelDoc, PartDoc } from "../types";

export interface PartFormDialogProps {
  part: PartDoc | null;
  catalogModels: EquipmentModelDoc[];
  onClose: () => void;
}

/** Alta / edición de repuesto */
export function PartFormDialog({
  part,
  catalogModels,
  onClose,
}: PartFormDialogProps) {
  const {
    form,
    isEdit,
    busy,
    error,
    updateField,
    addCompatibleModel,
    removeCompatibleModel,
    save,
  } = usePartForm(part, onClose);

  const catalogLocations =
    useQuery(api.catalogs.list, { kind: "partLocation" }) ?? [];
  const catalogSuppliers =
    useQuery(api.catalogs.list, { kind: "supplier" }) ?? [];
  const catalogCategories =
    useQuery(api.catalogs.list, { kind: "partCategory" }) ?? [];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar repuesto" : "Nuevo repuesto"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Actualiza los datos del repuesto en el catálogo."
              : "Añade un repuesto al catálogo del taller."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="part-code">Código *</Label>
            <Input
              id="part-code"
              value={form.code}
              onChange={(event) => updateField("code", event.target.value)}
              placeholder="ALI-24015"
              className="font-mono"
              disabled={busy}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="part-name">Nombre *</Label>
            <Input
              id="part-name"
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
              placeholder="Fuente de alimentación 24 V 150 W"
              disabled={busy}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="part-category">Categoría</Label>
            <AutocompleteInput
              id="part-category"
              value={form.category}
              onChange={(value) => updateField("category", value)}
              items={[
                ...PART_CATEGORIES.map((cat) => ({ name: cat })),
                ...catalogCategories,
              ]}
              kind="partCategory"
              placeholder="p. ej. Electrónica, Conectividad..."
              disabled={busy}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="part-unit">Unidad</Label>
            <Input
              id="part-unit"
              value={form.unit}
              onChange={(event) => updateField("unit", event.target.value)}
              placeholder="ud"
              disabled={busy}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="part-stock">Stock actual</Label>
            <Input
              id="part-stock"
              type="number"
              min={0}
              value={form.stockText}
              onChange={(event) => updateField("stockText", event.target.value)}
              className="tabular-nums"
              disabled={busy}
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
              disabled={busy}
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
              disabled={busy}
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
              disabled={busy}
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
              disabled={busy}
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
              disabled={busy}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="part-url">Ficha del proveedor</Label>
            <Input
              id="part-url"
              value={form.purchaseUrl}
              onChange={(event) => updateField("purchaseUrl", event.target.value)}
              placeholder="https://..."
              disabled={busy}
            />
          </div>

          <CompatibleModelsSection
            catalogModels={catalogModels}
            compatibleModelIds={form.compatibleModelIds}
            onAddModel={addCompatibleModel}
            onRemoveModel={removeCompatibleModel}
            disabled={busy}
          />

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="part-description">Descripción</Label>
            <RichTextEditor
              id="part-description"
              value={form.description}
              onChange={(value) => updateField("description", value)}
              placeholder="Especificaciones, nº de parte, compatibilidad..."
              disabled={busy}
            />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={save} disabled={busy}>
            {busy
              ? "Guardando..."
              : isEdit
                ? "Guardar cambios"
                : "Añadir repuesto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
