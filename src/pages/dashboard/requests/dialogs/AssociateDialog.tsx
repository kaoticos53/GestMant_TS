import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Check } from "lucide-react";

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
import { AutocompleteInput } from "@/components/ui/AutocompleteInput";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RichTextEditor } from "@/components/RichTextEditor";
import { api } from "@/convex/_generated/api";
import { richDocToStore } from "@/lib/richDoc";
import { cn } from "@/lib/utils";
import {
  PART_CATEGORIES,
  getErrorMessage,
} from "@/lib/workshop";

import type { EquipmentDoc, PartDoc, RequestDoc } from "../types";

export function AssociateDialog({
  request,
  parts,
  equipment,
  onClose,
}: {
  request: RequestDoc;
  parts: PartDoc[];
  equipment: EquipmentDoc[];
  onClose: () => void;
}) {
  const associateExisting = useMutation(api.partRequests.associateExisting);
  const associateNew = useMutation(api.partRequests.associateNew);
  const catalogSuppliers = useQuery(api.catalogs.list, { kind: "supplier" }) ?? [];
  const catalogLocations = useQuery(api.catalogs.list, { kind: "partLocation" }) ?? [];
  const catalogCategories = useQuery(api.catalogs.list, { kind: "partCategory" }) ?? [];
  const ensureCatalogItem = useMutation(api.catalogs.ensureItem);

  const [mode, setMode] = useState<"existing" | "new">(
    parts.length > 0 ? "existing" : "new",
  );
  const [selectedId, setSelectedId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onlyCompatible, setOnlyCompatible] = useState(true);

  // Si la petición trae equipo del inventario, filtra el catálogo por modelo.
  const requestEquipment = equipment.find(
    (item) => item._id === request.equipmentId,
  );
  const compatibleParts = requestEquipment
    ? parts.filter(
        (part) =>
          part.compatibleWith?.includes(requestEquipment._id) ||
          (requestEquipment.modelId &&
            part.compatibleModels?.includes(requestEquipment.modelId)),
      )
    : parts;
  const showOnly =
    Boolean(requestEquipment) && onlyCompatible && compatibleParts.length > 0;
  const visibleParts = showOnly ? compatibleParts : parts;

  // Datos investigados para la creación del repuesto
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>(
    PART_CATEGORIES[0] as string,
  );
  const [unit, setUnit] = useState("ud");
  const [stockText, setStockText] = useState("1");
  const [minStockText, setMinStockText] = useState("0");
  const [location, setLocation] = useState("");
  const [supplier, setSupplier] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [priceText, setPriceText] = useState("");
  const [purchaseUrl, setPurchaseUrl] = useState("");
  const [description, setDescription] = useState("");

  const parseNumber = (value: string, fallback: number) => {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const handleAssociateExisting = async () => {
    const part = parts.find((candidate) => candidate._id === selectedId);
    if (!part) {
      setError("Selecciona el repuesto del catálogo.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const message = await associateExisting({
        requestId: request._id,
        sparePartId: part._id,
        quantity: Math.max(1, Math.floor(parseNumber(quantity, 1))),
      });
      toast.success(message);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleAssociateNew = async () => {
    setError(null);
    if (!code.trim() || !name.trim()) {
      setError("El código y el nombre son obligatorios.");
      return;
    }
    const stock = parseNumber(stockText, -1);
    const minStock = parseNumber(minStockText, -1);
    const price = priceText.trim() ? parseNumber(priceText, -1) : 0;
    if (stock < 0 || minStock < 0 || price < 0) {
      setError("Stock, mínimo y precio deben ser números positivos.");
      return;
    }
    // La ficha del repuesto que nace aquí se describe con el editor: se manda
    // el documento y, si no dice nada, no se guarda descripción.
    const descriptionToSend = richDocToStore(description);
    setBusy(true);
    try {
      const message = await associateNew({
        requestId: request._id,
        quantity: Math.max(1, Math.floor(parseNumber(quantity, 1))),
        part: {
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
        },
      });
      toast.success(message);

      // Registro transparente en catálogos
      if (supplier.trim()) {
        void ensureCatalogItem({ kind: "supplier", name: supplier.trim() }).catch(() => {});
      }
      if (location.trim()) {
        void ensureCatalogItem({ kind: "partLocation", name: location.trim() }).catch(() => {});
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Asociar repuesto a {request.reference}</DialogTitle>
          <DialogDescription>
            Elige un repuesto del catálogo o registra el que has investigado
            (proveedor, nº de parte, precio).
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <Label>Origen del repuesto</Label>
          <div className="inline-flex w-fit rounded-lg border border-border/70 bg-card p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setMode("existing")}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                mode === "existing"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Catálogo existente
            </button>
            <button
              type="button"
              onClick={() => setMode("new")}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                mode === "new"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Investigación nueva
            </button>
          </div>
        </div>

        {mode === "existing" ? (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="associate-part">Repuesto del catálogo</Label>
              {requestEquipment && (
                <div className="flex flex-wrap items-center gap-2">
                  {compatibleParts.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setOnlyCompatible((value) => !value)}
                      disabled={busy}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                        showOnly
                          ? "border-signal bg-signal/10 text-signal"
                          : "border-border/70 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {showOnly
                        ? `Solo compatibles con ${requestEquipment.model} (${compatibleParts.length})`
                        : `Ver todo el catálogo (${parts.length})`}
                    </button>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Sin repuestos marcados como compatibles con{" "}
                      {requestEquipment.model}: se muestra todo el catálogo.
                    </span>
                  )}
                </div>
              )}
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger
                  id="associate-part"
                  className="w-full"
                  disabled={busy}
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
                onChange={(event) => setQuantity(event.target.value)}
                className="tabular-nums"
                disabled={busy}
              />
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="new-code">Código interno *</Label>
                <Input
                  id="new-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="MON-10012"
                  className="font-mono"
                  disabled={busy}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-name">Nombre *</Label>
                <Input
                  id="new-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Monitor de realización 10 pulgadas"
                  disabled={busy}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-supplier">Proveedor</Label>
                <AutocompleteInput
                  id="new-supplier"
                  value={supplier}
                  onChange={setSupplier}
                  items={catalogSuppliers}
                  kind="supplier"
                  placeholder="SmallHD"
                  disabled={busy}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-part-number">Nº de parte</Label>
                <Input
                  id="new-part-number"
                  value={partNumber}
                  onChange={(event) => setPartNumber(event.target.value)}
                  placeholder="OD-10-SDI"
                  className="font-mono"
                  disabled={busy}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-url">URL de la ficha</Label>
                <Input
                  id="new-url"
                  value={purchaseUrl}
                  onChange={(event) => setPurchaseUrl(event.target.value)}
                  placeholder="https://..."
                  disabled={busy}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-price">Precio unitario (€)</Label>
                <Input
                  id="new-price"
                  inputMode="decimal"
                  value={priceText}
                  onChange={(event) => setPriceText(event.target.value)}
                  placeholder="29,90"
                  className="tabular-nums"
                  disabled={busy}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-category">Categoría</Label>
                <AutocompleteInput
                  id="new-category"
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
                <Label htmlFor="new-unit">Unidad</Label>
                <Input
                  id="new-unit"
                  value={unit}
                  onChange={(event) => setUnit(event.target.value)}
                  placeholder="ud"
                  disabled={busy}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-stock">Stock inicial</Label>
                <Input
                  id="new-stock"
                  type="number"
                  min={0}
                  value={stockText}
                  onChange={(event) => setStockText(event.target.value)}
                  className="tabular-nums"
                  disabled={busy}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-min">Stock mínimo</Label>
                <Input
                  id="new-min"
                  type="number"
                  min={0}
                  value={minStockText}
                  onChange={(event) => setMinStockText(event.target.value)}
                  className="tabular-nums"
                  disabled={busy}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-location">Ubicación</Label>
                <AutocompleteInput
                  id="new-location"
                  value={location}
                  onChange={setLocation}
                  items={catalogLocations}
                  kind="location"
                  placeholder="D-09"
                  className="font-mono"
                  disabled={busy}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-qty">Cantidad a asociar</Label>
                <Input
                  id="new-qty"
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  className="tabular-nums"
                  disabled={busy}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-description">Descripción</Label>
              <RichTextEditor
                id="new-description"
                value={description}
                onChange={setDescription}
                placeholder="Especificaciones, nº de parte, compatibilidad..."
                disabled={busy}
              />
            </div>
          </div>
        )}

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
          <Button
            type="button"
            className="gap-2"
            onClick={
              mode === "existing" ? handleAssociateExisting : handleAssociateNew
            }
            disabled={busy}
          >
            {busy
              ? "Asociando..."
              : mode === "existing"
                ? "Asociar al catálogo"
                : "Crear y asociar"}
            {!busy && <Check className="size-4" />}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
