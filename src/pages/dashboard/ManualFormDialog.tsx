import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MANUAL_FILE_FORMAT } from "@/lib/manuals";
import { ManualClassificationFields } from "./manuals/form/components/ManualClassificationFields";
import { ManualFileUploadField } from "./manuals/form/components/ManualFileUploadField";
import { ManualKindSelector } from "./manuals/form/components/ManualKindSelector";
import { ManualNotesField } from "./manuals/form/components/ManualNotesField";
import { useManualForm } from "./manuals/form/hooks/useManualForm";
import type { ManualFormDialogProps } from "./manuals/form/types";

/**
 * Formulario de un manual. La forma se elige al crearlo y no cambia después:
 * un archivo subido o una nota del taller. Quien no gestiona el módulo solo
 * puede escribir notas —es suyo lo que escribe—, así que el archivo no se le
 * ofrece.
 *
 * Con `fixedEquipmentId` se abre desde la ficha de un equipo: el manual nace
 * asignado a él y el equipo no se cambia desde aquí.
 */
export function ManualFormDialog(props: ManualFormDialogProps) {
  const {
    isEdit,
    kind,
    setKind,
    title,
    setTitle,
    type,
    setType,
    brand,
    setBrand,
    model,
    handleModelChange,
    equipmentId,
    handleEquipmentChange,
    classification,
    linked,
    uniqueModels,
    isFile,
    file,
    handleFileChange,
    handleClearFile,
    notes,
    setNotes,
    busy,
    error,
    handleSubmit,
  } = useManualForm(props);

  return (
    <Dialog open onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar manual" : "Nuevo manual"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Cambia la ficha del manual" +
                (isFile ? " o sustituye su archivo por otro PDF." : ".")
              : isFile
                ? `Sube el manual en ${MANUAL_FILE_FORMAT} y clasifícalo por tipo, marca y modelo.`
                : "Escribe una nota del taller sobre un modelo o un equipo."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {!isEdit && (
            <ManualKindSelector
              kind={kind}
              canManage={props.canManage}
              busy={busy}
              onKindChange={setKind}
            />
          )}

          <ManualClassificationFields
            title={title}
            type={type}
            equipmentId={equipmentId}
            brand={brand}
            model={model}
            classificationBrand={classification.brand}
            classificationModel={classification.model}
            linked={linked}
            fixedEquipmentId={props.fixedEquipmentId}
            equipment={props.equipment}
            uniqueModels={uniqueModels}
            busy={busy}
            onTitleChange={setTitle}
            onTypeChange={setType}
            onEquipmentChange={handleEquipmentChange}
            onBrandChange={setBrand}
            onModelChange={handleModelChange}
          />

          {isFile && (
            <ManualFileUploadField
              file={file}
              isEdit={isEdit}
              busy={busy}
              onFileChange={handleFileChange}
              onClearFile={handleClearFile}
            />
          )}

          <ManualNotesField
            notes={notes}
            isFile={isFile}
            busy={busy}
            onChange={setNotes}
          />

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={props.onClose}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={busy}
          >
            {busy
              ? "Guardando..."
              : isEdit
                ? "Guardar cambios"
                : "Añadir manual"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
