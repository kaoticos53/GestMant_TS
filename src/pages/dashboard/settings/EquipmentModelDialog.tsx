import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AutocompleteInput } from "@/components/ui/AutocompleteInput";
import { getErrorMessage } from "@/lib/workshop";
import { toast } from "sonner";

export type EquipmentModelDoc = Doc<"equipmentModels">;

interface EquipmentModelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  model: EquipmentModelDoc | null;
}

export function EquipmentModelDialog({
  open,
  onOpenChange,
  model,
}: EquipmentModelDialogProps) {
  const isEdit = model !== null;
  const createModel = useMutation(api.equipmentModels.create);
  const updateModel = useMutation(api.equipmentModels.update);

  const catalogBrands = useQuery(api.catalogs.list, { kind: "brand" }) ?? [];
  const catalogSuppliers = useQuery(api.catalogs.list, { kind: "supplier" }) ?? [];
  const catalogCategories = useQuery(api.catalogs.list, { kind: "equipmentCategory" }) ?? [];

  const [modelCode, setModelCode] = useState("");
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [defaultSupplier, setDefaultSupplier] = useState("");
  const [maintenanceInterval, setMaintenanceInterval] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (model) {
        setModelCode(model.model);
        setName(model.name);
        setBrand(model.brand ?? "");
        setCategory(model.category ?? "");
        setDefaultSupplier(model.defaultSupplier ?? "");
        setMaintenanceInterval(
          model.defaultMaintenanceIntervalDays !== undefined
            ? String(model.defaultMaintenanceIntervalDays)
            : "",
        );
        setDescription(model.description ?? "");
      } else {
        setModelCode("");
        setName("");
        setBrand("");
        setCategory("");
        setDefaultSupplier("");
        setMaintenanceInterval("");
        setDescription("");
      }
      setError(null);
    }
  }, [open, model]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanModel = modelCode.trim();
    const cleanName = name.trim();
    if (!cleanModel) {
      setError("El código o denominación del modelo es obligatorio.");
      return;
    }
    if (!cleanName) {
      setError("La designación genérica del modelo es obligatoria.");
      return;
    }

    let intervalNum: number | undefined = undefined;
    if (maintenanceInterval.trim()) {
      const parsed = parseInt(maintenanceInterval.trim(), 10);
      if (isNaN(parsed) || parsed <= 0) {
        setError("El intervalo preventivo debe ser un número entero de días mayor a 0.");
        return;
      }
      intervalNum = parsed;
    }

    setBusy(true);
    try {
      if (isEdit && model) {
        await updateModel({
          id: model._id,
          model: cleanModel,
          name: cleanName,
          brand: brand.trim() || undefined,
          category: category.trim() || undefined,
          defaultSupplier: defaultSupplier.trim() || undefined,
          defaultMaintenanceIntervalDays: intervalNum,
          description: description.trim() || undefined,
        });
        toast.success(`Modelo «${cleanModel}» actualizado`);
      } else {
        await createModel({
          model: cleanModel,
          name: cleanName,
          brand: brand.trim() || undefined,
          category: category.trim() || undefined,
          defaultSupplier: defaultSupplier.trim() || undefined,
          defaultMaintenanceIntervalDays: intervalNum,
          description: description.trim() || undefined,
        });
        toast.success(`Modelo «${cleanModel}» registrado en el catálogo maestro`);
      }
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="model-code">
                Código / Modelo comercial <span className="text-destructive">*</span>
              </Label>
              <Input
                id="model-code"
                value={modelCode}
                onChange={(e) => setModelCode(e.target.value)}
                placeholder="ej. 8FGF25 o HDC-3500"
                disabled={busy}
                autoFocus
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="model-brand">Marca comercial</Label>
              <AutocompleteInput
                id="model-brand"
                value={brand}
                onChange={setBrand}
                items={catalogBrands}
                kind="brand"
                placeholder="ej. Toyota, Sony, Rexroth..."
                disabled={busy}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="model-name">
              Designación genérica <span className="text-destructive">*</span>
            </Label>
            <Input
              id="model-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ej. Carretilla elevadora diésel 2.5T"
              disabled={busy}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="model-category">Categoría de equipo</Label>
              <AutocompleteInput
                id="model-category"
                value={category}
                onChange={setCategory}
                items={catalogCategories}
                kind="equipmentCategory"
                placeholder="ej. Elevación, Mecanizado..."
                disabled={busy}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="model-supplier">Proveedor habitual</Label>
              <AutocompleteInput
                id="model-supplier"
                value={defaultSupplier}
                onChange={setDefaultSupplier}
                items={catalogSuppliers}
                kind="supplier"
                placeholder="ej. Toyota Material Handling"
                disabled={busy}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="model-interval">
              Intervalo preventivo por defecto (días)
            </Label>
            <Input
              id="model-interval"
              type="number"
              min="1"
              value={maintenanceInterval}
              onChange={(e) => setMaintenanceInterval(e.target.value)}
              placeholder="ej. 90 (cada 3 meses)"
              disabled={busy}
            />
            <p className="text-[11px] text-muted-foreground">
              Se propondrá automáticamente al dar de alta nuevos equipos físicos de este modelo.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="model-description">Notas técnicas / Especificaciones</Label>
            <Textarea
              id="model-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Características destacadas, capacidad de carga, potencia o requisitos..."
              rows={3}
              disabled={busy}
            />
          </div>

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
              {busy ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear modelo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
