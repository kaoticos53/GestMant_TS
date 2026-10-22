import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ModelBasicFields,
  ModelDetailsFields,
  useEquipmentModelForm,
} from "./modelDialog";
import type {
  EquipmentModelDialogProps,
  EquipmentModelDoc,
} from "./modelDialog";

export type { EquipmentModelDoc };

export function EquipmentModelDialog({
  open,
  onOpenChange,
  model,
}: EquipmentModelDialogProps) {
  const {
    isEdit,
    modelCode,
    setModelCode,
    name,
    setName,
    brand,
    setBrand,
    category,
    setCategory,
    defaultSupplier,
    setDefaultSupplier,
    maintenanceInterval,
    setMaintenanceInterval,
    description,
    setDescription,
    busy,
    error,
    catalogBrands,
    catalogSuppliers,
    handleSubmit,
  } = useEquipmentModelForm({
    model,
    onOpenChange,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar modelo de equipo" : "Nuevo modelo de equipo"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Corrige los datos técnicos de este modelo. Los cambios se reflejarán en todos los equipos físicos y repuestos vinculados."
              : "Registra la ficha técnica de un modelo. Permite asociar manuales y repuestos compatibles sin necesidad de crear un equipo físico concreto."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </div>
          )}

          <ModelBasicFields
            modelCode={modelCode}
            onModelCodeChange={setModelCode}
            brand={brand}
            onBrandChange={setBrand}
            name={name}
            onNameChange={setName}
            catalogBrands={catalogBrands}
            disabled={busy}
          />

          <ModelDetailsFields
            category={category}
            onCategoryChange={setCategory}
            defaultSupplier={defaultSupplier}
            onDefaultSupplierChange={setDefaultSupplier}
            maintenanceInterval={maintenanceInterval}
            onMaintenanceIntervalChange={setMaintenanceInterval}
            description={description}
            onDescriptionChange={setDescription}
            catalogSuppliers={catalogSuppliers}
            disabled={busy}
          />

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={busy}>
              {busy
                ? "Guardando..."
                : isEdit
                  ? "Guardar cambios"
                  : "Crear modelo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
