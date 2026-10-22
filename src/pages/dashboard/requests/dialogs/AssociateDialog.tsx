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
import type { AssociateDialogProps } from "./associate/types";
import { useAssociateState } from "./associate/hooks/useAssociateState";
import { AssociateModeToggle } from "./associate/components/AssociateModeToggle";
import { AssociateExistingSection } from "./associate/components/AssociateExistingSection";
import { AssociateNewSection } from "./associate/components/AssociateNewSection";

export function AssociateDialog({
  request,
  parts,
  equipment,
  onClose,
}: AssociateDialogProps) {
  const {
    mode,
    setMode,
    selectedId,
    setSelectedId,
    quantity,
    setQuantity,
    busy,
    error,
    form,
    handleChangeField,
    requestEquipment,
    compatiblePartsCount,
    allPartsCount,
    showOnlyCompatible,
    handleToggleOnlyCompatible,
    visibleParts,
    catalogSuppliers,
    catalogCategories,
    catalogLocations,
    handleAssociateExisting,
    handleAssociateNew,
  } = useAssociateState({ request, parts, equipment, onClose });

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

        <AssociateModeToggle
          mode={mode}
          onChange={setMode}
          disabled={busy}
        />

        {mode === "existing" ? (
          <AssociateExistingSection
            requestEquipment={requestEquipment}
            compatiblePartsCount={compatiblePartsCount}
            allPartsCount={allPartsCount}
            showOnlyCompatible={showOnlyCompatible}
            onToggleOnlyCompatible={handleToggleOnlyCompatible}
            visibleParts={visibleParts}
            selectedId={selectedId}
            onSelectPart={setSelectedId}
            quantity={quantity}
            onChangeQuantity={setQuantity}
            disabled={busy}
          />
        ) : (
          <AssociateNewSection
            form={form}
            onChangeField={handleChangeField}
            quantity={quantity}
            onChangeQuantity={setQuantity}
            catalogSuppliers={catalogSuppliers}
            catalogCategories={catalogCategories}
            catalogLocations={catalogLocations}
            disabled={busy}
          />
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
