import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Plus, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
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
import type { Id } from "@/convex/_generated/dataModel";
import { matchesQuery } from "@/lib/browse";
import { richDocToStore } from "@/lib/richDoc";
import { PART_CATEGORIES, getErrorMessage } from "@/lib/workshop";
import { modelLabel } from "../helpers";
import { COMPATIBLE_RESULTS, type EquipmentModelDoc, type PartDoc } from "../types";

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
  const create = useMutation(api.spareParts.create);
  const update = useMutation(api.spareParts.update);
  const catalogLocations = useQuery(api.catalogs.list, { kind: "partLocation" }) ?? [];
  const catalogSuppliers = useQuery(api.catalogs.list, { kind: "supplier" }) ?? [];
  const catalogCategories = useQuery(api.catalogs.list, { kind: "partCategory" }) ?? [];
  const ensureCatalogItem = useMutation(api.catalogs.ensureItem);
  const ensureModel = useMutation(api.equipmentModels.ensureModel);

  const isEdit = part !== null;
  const [code, setCode] = useState(part?.code ?? "");
  const [name, setName] = useState(part?.name ?? "");
  const [description, setDescription] = useState(part?.description ?? "");
  const [category, setCategory] = useState(
    part?.category ?? (PART_CATEGORIES[0] as string),
  );
  const [unit, setUnit] = useState(part?.unit ?? "ud");
  const [stockText, setStockText] = useState(String(part?.stock ?? 0));
  const [minStockText, setMinStockText] = useState(String(part?.minStock ?? 0));
  const [location, setLocation] = useState(part?.location ?? "");
  const [supplier, setSupplier] = useState(part?.supplier ?? "");
  const [partNumber, setPartNumber] = useState(part?.partNumber ?? "");
  const [priceText, setPriceText] = useState(
    part?.unitPrice ? String(part.unitPrice) : "",
  );
  const [purchaseUrl, setPurchaseUrl] = useState(part?.purchaseUrl ?? "");
  const [compatibleModelIds, setCompatibleModelIds] = useState<Id<"equipmentModels">[]>(
    part?.compatibleModels ?? [],
  );
  const [modelQuery, setModelQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [isCreatingModel, setIsCreatingModel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parseNumber = (value: string, fallback: number) => {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  /** Modelos ya añadidos */
  const compatiblesModels = compatibleModelIds
    .map((id) => catalogModels.find((m) => m._id === id))
    .filter((m): m is EquipmentModelDoc => m !== undefined);

  /** Coincidencias de búsqueda de modelos */
  const trimmedModelQuery = modelQuery.trim();
  const buscandoModelos = trimmedModelQuery !== "";
  const modelosEncontrados = buscandoModelos
    ? catalogModels.filter(
        (m) =>
          !compatibleModelIds.includes(m._id) &&
          matchesQuery(
            [modelLabel(m), m.model, m.name, m.brand, m.category],
            trimmedModelQuery,
          ),
      )
    : [];
  const coincidenciasModelos = modelosEncontrados.slice(0, COMPATIBLE_RESULTS);

  const hasExactMatch = catalogModels.some(
    (m) =>
      m.model.toLowerCase() === trimmedModelQuery.toLowerCase() ||
      modelLabel(m).toLowerCase() === trimmedModelQuery.toLowerCase(),
  );

  const addCompatibleModel = (id: Id<"equipmentModels">) => {
    setCompatibleModelIds((curr) => (curr.includes(id) ? curr : [...curr, id]));
  };

  const removeCompatibleModel = (id: Id<"equipmentModels">) => {
    setCompatibleModelIds((curr) => curr.filter((item) => item !== id));
  };

  const handleCreateAndAddModel = async () => {
    if (!trimmedModelQuery) return;
    setIsCreatingModel(true);
    try {
      const modelId = await ensureModel({
        model: trimmedModelQuery,
      });
      addCompatibleModel(modelId);
      setModelQuery("");
      toast.success(`Modelo «${trimmedModelQuery}» registrado en el catálogo y asociado`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsCreatingModel(false);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    if (!code.trim()) {
      setError("El código es obligatorio.");
      return;
    }
    if (!name.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    const stock = parseNumber(stockText, -1);
    const minStock = parseNumber(minStockText, -1);
    const price = parseNumber(priceText, 0);
    if (stock < 0 || minStock < 0) {
      setError("El stock y el stock mínimo deben ser números positivos.");
      return;
    }
    if (price < 0) {
      setError("El precio no puede ser negativo.");
      return;
    }

    setBusy(true);
    try {
      const descriptionToSend = richDocToStore(description);
      if (isEdit && part) {
        await update({
          id: part._id,
          code: code.trim(),
          name: name.trim(),
          description: descriptionToSend ?? "",
          category,
          unit: unit.trim() || "ud",
          stock,
          minStock,
          location: location.trim(),
          supplier: supplier.trim(),
          partNumber: partNumber.trim(),
          unitPrice: price,
          purchaseUrl: purchaseUrl.trim(),
          compatibleModels: compatibleModelIds,
          compatibleWith: [],
        });
        toast.success(`${code.trim().toUpperCase()} actualizado`);
      } else {
        await create({
          code: code.trim(),
          name: name.trim(),
          ...(descriptionToSend ? { description: descriptionToSend } : {}),
          category,
          unit: unit.trim() || "ud",
          stock,
          minStock,
          location: location.trim(),
          supplier: supplier.trim(),
          partNumber: partNumber.trim(),
          unitPrice: price,
          purchaseUrl: purchaseUrl.trim(),
          compatibleModels: compatibleModelIds,
          compatibleWith: [],
        });
        toast.success(`${code.trim().toUpperCase()} añadido al catálogo`);
      }

      // Registro transparente en catálogos maestros
      if (location.trim()) {
        void ensureCatalogItem({ kind: "partLocation", name: location.trim() }).catch(() => {});
      }
      if (supplier.trim()) {
        void ensureCatalogItem({ kind: "supplier", name: supplier.trim() }).catch(() => {});
      }
      if (category.trim()) {
        void ensureCatalogItem({ kind: "partCategory", name: category.trim() }).catch(() => {});
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
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="ALI-24015"
              className="font-mono"
              disabled={busy}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="part-name">Nombre *</Label>
            <Input
              id="part-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Fuente de alimentación 24 V 150 W"
              disabled={busy}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="part-category">Categoría</Label>
            <AutocompleteInput
              id="part-category"
              value={category}
              onChange={setCategory}
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
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
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
              value={stockText}
              onChange={(event) => setStockText(event.target.value)}
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
              value={minStockText}
              onChange={(event) => setMinStockText(event.target.value)}
              className="tabular-nums"
              disabled={busy}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="part-location">Ubicación</Label>
            <AutocompleteInput
              id="part-location"
              value={location}
              onChange={setLocation}
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
              value={supplier}
              onChange={setSupplier}
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
              value={partNumber}
              onChange={(event) => setPartNumber(event.target.value)}
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
              value={priceText}
              onChange={(event) => setPriceText(event.target.value)}
              placeholder="2,35"
              className="tabular-nums"
              disabled={busy}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="part-url">Ficha del proveedor</Label>
            <Input
              id="part-url"
              value={purchaseUrl}
              onChange={(event) => setPurchaseUrl(event.target.value)}
              placeholder="https://..."
              disabled={busy}
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="part-model-search">
              Modelos compatibles (recomendado)
            </Label>
            <p className="text-xs leading-5 text-muted-foreground">
              Asocia el repuesto al modelo técnico para que sea compatible con
              todos los equipos físicos de ese modelo.
            </p>
            <div className="grid gap-2">
              <Input
                id="part-model-search"
                value={modelQuery}
                onChange={(event) => setModelQuery(event.target.value)}
                placeholder="Buscar modelo por marca o nombre (ej. Toyota, Rexroth...)"
                autoComplete="off"
                disabled={busy || isCreatingModel}
              />
              {coincidenciasModelos.length > 0 && (
                <ul
                  aria-label="Modelos que coinciden"
                  className="overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm"
                >
                  {coincidenciasModelos.map((item) => (
                    <li key={item._id}>
                      <button
                        type="button"
                        onClick={() => {
                          addCompatibleModel(item._id);
                          setModelQuery("");
                        }}
                        disabled={busy || isCreatingModel}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs transition-colors hover:bg-muted/60"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-foreground font-medium">
                            {modelLabel(item)}
                          </span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {item.name}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
                          {item.category && <span>{item.category}</span>}
                          <Plus className="size-3.5" />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {buscandoModelos && !hasExactMatch && (
                <button
                  type="button"
                  onClick={handleCreateAndAddModel}
                  disabled={busy || isCreatingModel}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-left text-xs text-primary transition-colors hover:bg-primary/10 font-medium"
                >
                  <span className="flex items-center gap-2 truncate">
                    <Sparkles className="size-3.5 shrink-0 text-amber-500" />
                    <span>
                      Registrar nuevo modelo «<strong>{trimmedModelQuery}</strong>» y asociar
                    </span>
                  </span>
                  <Plus className="size-3.5 shrink-0" />
                </button>
              )}
              {compatiblesModels.length === 0 ? (
                <p className="text-xs leading-5 text-muted-foreground">
                  Ningún modelo asociado todavía.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {compatiblesModels.map((item) => (
                    <button
                      key={item._id}
                      type="button"
                      onClick={() => removeCompatibleModel(item._id)}
                      disabled={busy}
                      title="Quitar modelo compatible"
                      aria-label={`Quitar ${modelLabel(item)}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-signal bg-signal/10 px-3 py-1 text-xs font-medium text-signal transition-colors hover:border-destructive/40 hover:text-destructive"
                    >
                      {modelLabel(item)}
                      <X className="size-3.5" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="part-description">Descripción</Label>
            <RichTextEditor
              id="part-description"
              value={description}
              onChange={setDescription}
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
          <Button type="button" onClick={handleSubmit} disabled={busy}>
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
