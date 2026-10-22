import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/RichTextEditor";
import type { EquipmentFormDialogProps } from "../types";
import { useEquipmentForm } from "./useEquipmentForm";
import { EquipmentIdentityFields } from "./components/EquipmentIdentityFields";
import { EquipmentDetailsFields } from "./components/EquipmentDetailsFields";
import { EquipmentDatesFields } from "./components/EquipmentDatesFields";

export function EquipmentFormDialog(props: EquipmentFormDialogProps) {
  const { onClose } = props;
  const {
    isEdit,
    busy,
    error,
    codeValue,
    autoCode,
    brand,
    name,
    model,
    location,
    description,
    serialNumber,
    supplier,
    purchaseDate,
    warrantyEndDate,
    decommissionDate,
    intervalDays,
    matchedTemplate,
    allSuggestedModels,
    catalogBrands,
    catalogLocations,
    catalogSuppliers,
    setCode,
    setBrand,
    setName,
    setLocation,
    setDescription,
    setSerialNumber,
    setSupplier,
    setPurchaseDate,
    setWarrantyEndDate,
    setDecommissionDate,
    setIntervalDays,
    handleModelChange,
    applyModelTemplate,
    handleSubmit,
  } = useEquipmentForm(props);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar equipo" : "Nuevo equipo"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Actualiza los datos del equipo en el inventario."
              : "El equipo quedará disponible en las peticiones de repuestos."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <EquipmentIdentityFields
            isEdit={isEdit}
            busy={busy}
            codeValue={codeValue}
            autoCode={autoCode}
            brand={brand}
            name={name}
            model={model}
            matchedTemplate={matchedTemplate}
            allSuggestedModels={allSuggestedModels}
            catalogBrands={catalogBrands}
            onCodeChange={setCode}
            onBrandChange={setBrand}
            onNameChange={setName}
            onModelChange={handleModelChange}
            onApplyTemplate={applyModelTemplate}
          />

          <EquipmentDetailsFields
            busy={busy}
            location={location}
            serialNumber={serialNumber}
            supplier={supplier}
            catalogLocations={catalogLocations}
            catalogSuppliers={catalogSuppliers}
            onLocationChange={setLocation}
            onSerialNumberChange={setSerialNumber}
            onSupplierChange={setSupplier}
          />

          <EquipmentDatesFields
            busy={busy}
            purchaseDate={purchaseDate}
            warrantyEndDate={warrantyEndDate}
            decommissionDate={decommissionDate}
            intervalDays={intervalDays}
            onPurchaseDateChange={setPurchaseDate}
            onWarrantyEndDateChange={setWarrantyEndDate}
            onDecommissionDateChange={setDecommissionDate}
            onIntervalDaysChange={setIntervalDays}
          />

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="eq-description">Descripción</Label>
            <RichTextEditor
              id="eq-description"
              value={description}
              onChange={setDescription}
              placeholder="Notas, particularidades, historial de mantenimiento..."
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
          <Button type="button" onClick={handleSubmit} disabled={busy}>
            {busy
              ? "Guardando..."
              : isEdit
                ? "Guardar cambios"
                : "Añadir equipo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
