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
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/RichTextEditor";
import { api } from "@/convex/_generated/api";
import { usePartForm } from "../hooks/usePartForm";
import { CompatibleModelsSection } from "../components/CompatibleModelsSection";
import {
  PartBasicFields,
  PartStockLocationFields,
  buildPartCategoryOptions,
} from "./partForm";
import type { PartFormDialogProps } from "./partForm";

export type { PartFormDialogProps };

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

  const categoryOptions = buildPartCategoryOptions(catalogCategories);

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
          <PartBasicFields
            form={form}
            categoryOptions={categoryOptions}
            updateField={updateField}
            disabled={busy}
          />

          <PartStockLocationFields
            form={form}
            catalogLocations={catalogLocations}
            catalogSuppliers={catalogSuppliers}
            updateField={updateField}
            disabled={busy}
          />

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
