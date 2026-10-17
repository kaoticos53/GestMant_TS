import { useMemo, useState } from "react";
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
import { RichTextEditor } from "@/components/RichTextEditor";
import { api } from "@/convex/_generated/api";
import { richDocToStore } from "@/lib/richDoc";
import { getErrorMessage } from "@/lib/workshop";
import type { Doc } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { dateToInput, inputToDate } from "../helpers";
import type { EquipmentDoc, EquipmentFormDialogProps } from "../types";

interface MatchedTemplate {
  brand?: string;
  name?: string;
  supplier?: string;
  maintenanceIntervalDays?: number;
  description?: string;
  source: "catalog" | "inventory";
  sourceLabel: string;
}

/** El primero que trae algo escrito: la ficha, lo que llega de fuera o la plantilla. */
function firstFilled(...values: (string | undefined)[]): string {
  return values.find((value) => value?.trim()) ?? "";
}

/**
 * La plantilla que corresponde a un modelo: primero el catálogo oficial y, si
 * no está, un equipo que ya exista con ese modelo. Es lo que rellena la ficha
 * nada más elegir el modelo y lo que anuncia el enlace «Cargar datos».
 */
function findModelTemplate(
  model: string,
  catalogModels: Doc<"equipmentModels">[],
  allEquipment: EquipmentDoc[],
): MatchedTemplate | null {
  const trimmed = model.trim().toLowerCase();
  if (!trimmed) return null;

  const cat = catalogModels.find(
    (cm) => cm.model.trim().toLowerCase() === trimmed,
  );
  if (cat) {
    return {
      brand: cat.brand,
      name: cat.name,
      supplier: cat.defaultSupplier,
      maintenanceIntervalDays: cat.defaultMaintenanceIntervalDays,
      description: cat.description,
      source: "catalog",
      sourceLabel: `Plantilla: ${cat.name}`,
    };
  }

  const inv = allEquipment.find(
    (eq) => eq.model?.trim().toLowerCase() === trimmed,
  );
  if (inv) {
    return {
      brand: inv.brand,
      name: inv.name,
      supplier: inv.supplier,
      maintenanceIntervalDays: inv.maintenanceIntervalDays,
      description: inv.description,
      source: "inventory",
      sourceLabel: `Equipo previo: ${inv.name}`,
    };
  }

  return null;
}

export function EquipmentFormDialog({
  item,
  initialValues,
  onSuccess,
  onClose,
}: EquipmentFormDialogProps) {
  const create = useMutation(api.equipment.create);
  const update = useMutation(api.equipment.update);
  const catalogModels = useQuery(api.equipmentModels.list) ?? [];
  const inventoryModels = useQuery(api.equipment.uniqueModels, {}) ?? [];
  const allEquipment = useQuery(api.equipment.list, {}) ?? [];
  const autoCode = useQuery(api.equipment.nextCode);

  const isEdit = item !== null;
  // La plantilla del modelo con el que se abre la ficha, si ya se conoce: los
  // campos nacen con ella. Si el catálogo llega después, queda el enlace
  // «Cargar datos» del modelo, que la aplica cuando se pulse.
  const initialTemplate = isEdit
    ? null
    : findModelTemplate(
        initialValues?.model ?? "",
        catalogModels,
        allEquipment,
      );
  const [code, setCode] = useState<string | null>(item?.code ?? null);
  // El código que se ve y el que se manda: el escrito o, en un alta, el libre
  // que propone el taller. Así el campo lo enseña sin copiarlo a un estado
  // aparte que se quedaría con el primero que llegara.
  const codeValue = isEdit ? (code ?? "") : (code ?? autoCode ?? "");
  const [brand, setBrand] = useState(
    firstFilled(item?.brand, initialValues?.brand, initialTemplate?.brand),
  );
  const [name, setName] = useState(
    firstFilled(item?.name, initialValues?.name, initialTemplate?.name),
  );
  const [model, setModel] = useState(item?.model ?? initialValues?.model ?? "");
  const [location, setLocation] = useState(item?.location ?? initialValues?.location ?? "");
  const [description, setDescription] = useState(
    firstFilled(
      item?.description,
      initialValues?.description,
      initialTemplate?.description,
    ),
  );
  const [serialNumber, setSerialNumber] = useState(
    item?.serialNumber ?? initialValues?.serialNumber ?? "",
  );
  const [supplier, setSupplier] = useState(
    firstFilled(
      item?.supplier,
      initialValues?.supplier,
      initialTemplate?.supplier,
    ),
  );
  const [purchaseDate, setPurchaseDate] = useState(
    dateToInput(item?.purchaseDate),
  );
  const [warrantyEndDate, setWarrantyEndDate] = useState(
    dateToInput(item?.warrantyEndDate),
  );
  const [decommissionDate, setDecommissionDate] = useState(
    dateToInput(item?.decommissionDate),
  );
  const [intervalDays, setIntervalDays] = useState(() => {
    const days =
      item?.maintenanceIntervalDays ??
      initialValues?.maintenanceIntervalDays ??
      initialTemplate?.maintenanceIntervalDays;
    return days !== undefined ? String(days) : "";
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Combinar modelos únicos de inventario y catálogo para sugerencias
  const allSuggestedModels = useMemo(() => {
    const set = new Set<string>();
    for (const cm of catalogModels) {
      if (cm.model?.trim()) set.add(cm.model.trim());
    }
    for (const eq of allEquipment) {
      if (eq.model?.trim()) set.add(eq.model.trim());
    }
    for (const m of inventoryModels) {
      if (m?.trim()) set.add(m.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [catalogModels, allEquipment, inventoryModels]);

  // Plantilla del modelo coincidente (prioridad catálogo, fallback inventario existente)
  const matchedTemplate = useMemo(
    () => findModelTemplate(model, catalogModels, allEquipment),
    [model, catalogModels, allEquipment],
  );

  /**
   * El modelo del catálogo oficial que coincide con lo escrito, si lo hay: es
   * lo que enlaza el equipo con su ficha de modelo (`modelId`) al guardarlo.
   */
  const matchedCatalogModel = useMemo(
    () =>
      catalogModels.find(
        (cm) => cm.model.trim().toLowerCase() === model.trim().toLowerCase(),
      ) ?? null,
    [catalogModels, model],
  );

  // Aplicar datos de plantilla del modelo
  const applyModelTemplate = (
    template: MatchedTemplate | null,
    force = false,
  ) => {
    if (!template) return;
    if (template.brand && (force || !brand.trim())) {
      setBrand(template.brand);
    }
    if (template.name && (force || !name.trim())) {
      setName(template.name);
    }
    if (template.supplier && (force || !supplier.trim())) {
      setSupplier(template.supplier);
    }
    if (
      template.maintenanceIntervalDays !== undefined &&
      (force || !intervalDays.trim())
    ) {
      setIntervalDays(String(template.maintenanceIntervalDays));
    }
    if (template.description && (force || !description.trim())) {
      setDescription(template.description);
    }
  };

  const handleModelChange = (newModel: string) => {
    setModel(newModel);
    applyModelTemplate(
      findModelTemplate(newModel, catalogModels, allEquipment),
      false,
    );
  };

  const handleSubmit = async () => {
    setError(null);
    const finalCode = (
      (code ?? "").trim() || (!isEdit ? (autoCode ?? "") : "")
    ).trim();
    if (isEdit && !finalCode) {
      setError("El código de inventario es obligatorio.");
      return;
    }
    if (!name.trim() || !model.trim()) {
      setError("La designación y el modelo son obligatorios.");
      return;
    }

    const purchase = inputToDate(purchaseDate);
    const decommission = inputToDate(decommissionDate);
    const warranty = inputToDate(warrantyEndDate);
    const interval = intervalDays.trim() ? Number(intervalDays) : undefined;
    if (
      interval !== undefined &&
      (!Number.isFinite(interval) || interval <= 0)
    ) {
      setError(
        "El intervalo de revisión debe ser un número de días mayor que cero.",
      );
      return;
    }
    if (
      purchase !== undefined &&
      decommission !== undefined &&
      decommission < purchase
    ) {
      setError("La fecha de baja no puede ser anterior a la fecha de alta.");
      return;
    }
    if (
      purchase !== undefined &&
      warranty !== undefined &&
      warranty < purchase
    ) {
      setError("El fin de garantía no puede ser anterior a la fecha de alta.");
      return;
    }

    setBusy(true);
    try {
      const payload = {
        modelId: matchedCatalogModel?._id ?? initialValues?.modelId,
        code: finalCode || undefined,
        brand: brand.trim(),
        name: name.trim(),
        model: model.trim(),
        location: location.trim(),
        // El editor ya entrega el documento formado: se manda tal cual (el
        // servidor lo vuelve a normalizar) y una nota vacía viaja como
        // `undefined`, que es lo que deja al equipo sin descripción.
        description: richDocToStore(description),
        serialNumber: serialNumber.trim(),
        supplier: supplier.trim(),
        purchaseDate: purchase,
        decommissionDate: decommission,
        warrantyEndDate: warranty,
        maintenanceIntervalDays: interval,
      };
      if (isEdit && item) {
        await update({ id: item._id, ...payload });
        toast.success(`${payload.model} actualizado`);
      } else {
        const createdId = await create(payload);
        toast.success(`${payload.model} añadido al inventario`);
        if (createdId && onSuccess) {
          onSuccess(createdId);
        }
      }
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

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
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="eq-code">Código *</Label>
              {!isEdit && (
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  Autogenerado y único
                </span>
              )}
            </div>
            <Input
              id="eq-code"
              value={codeValue}
              onChange={(event) => setCode(event.target.value)}
              placeholder={autoCode ?? "EQ-001"}
              className="font-mono"
              disabled={busy}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="eq-brand">Marca</Label>
            <Input
              id="eq-brand"
              value={brand}
              onChange={(event) => setBrand(event.target.value)}
              placeholder="Sony"
              disabled={busy}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="eq-name">Designación *</Label>
            <Input
              id="eq-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Cámara de estudio"
              disabled={busy}
            />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="eq-model">Modelo *</Label>
              {matchedTemplate && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    {matchedTemplate.sourceLabel}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      applyModelTemplate(matchedTemplate, true);
                      toast.success(
                        `Datos cargados desde la plantilla de ${matchedTemplate.name || model}`,
                      );
                    }}
                    className="text-[11px] font-medium text-signal underline hover:opacity-85"
                    title="Cargar datos de la plantilla en los campos"
                  >
                    (Cargar datos)
                  </button>
                </div>
              )}
            </div>
            <Input
              id="eq-model"
              list="eq-models-datalist"
              value={model}
              onChange={(event) => handleModelChange(event.target.value)}
              placeholder="HDC-3500"
              className="font-mono"
              disabled={busy}
            />
            <datalist id="eq-models-datalist">
              {allSuggestedModels.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="eq-location">Ubicación</Label>
            <Input
              id="eq-location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Plató 1"
              disabled={busy}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="eq-serial">Nº de serie</Label>
            <Input
              id="eq-serial"
              value={serialNumber}
              onChange={(event) => setSerialNumber(event.target.value)}
              placeholder="FX888D-2505-0147"
              className="font-mono"
              disabled={busy}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="eq-supplier">Proveedor</Label>
            <Input
              id="eq-supplier"
              value={supplier}
              onChange={(event) => setSupplier(event.target.value)}
              placeholder="Farnell"
              disabled={busy}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="eq-purchase">Fecha de alta</Label>
            <Input
              id="eq-purchase"
              type="date"
              value={purchaseDate}
              onChange={(event) => setPurchaseDate(event.target.value)}
              disabled={busy}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="eq-warranty">Fin de garantía</Label>
            <Input
              id="eq-warranty"
              type="date"
              value={warrantyEndDate}
              onChange={(event) => setWarrantyEndDate(event.target.value)}
              disabled={busy}
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="eq-decommission">Fecha de baja</Label>
            <Input
              id="eq-decommission"
              type="date"
              value={decommissionDate}
              onChange={(event) => setDecommissionDate(event.target.value)}
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
              onChange={(event) => setIntervalDays(event.target.value)}
              placeholder="180"
              disabled={busy}
            />
            <p className="text-xs text-muted-foreground">
              Déjalo vacío si el equipo no tiene plan de mantenimiento
              preventivo.
            </p>
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="eq-description">Descripción</Label>
            {/* La nota del equipo lleva el mismo editor que las incidencias:
                formato e imágenes, y lo que se guarda es su documento. */}
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
