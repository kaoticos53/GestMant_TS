import { useMutation, useQuery } from "convex/react";
import { ArrowRight } from "lucide-react";
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
import { useAuth } from "@/hooks/use-auth";
import type { Priority } from "@/lib/workshop";

import type { EquipmentDoc, PartDoc } from "../types";
import { useRequestAttachments } from "../hooks/useRequestAttachments";
import { useRequestPartsSelection } from "../hooks/useRequestPartsSelection";
import { useNewRequestForm } from "../hooks/useNewRequestForm";
import { RequestEquipmentSection } from "./components/RequestEquipmentSection";
import { RequestAttachmentsSection } from "./components/RequestAttachmentsSection";
import { RequestPartsSection } from "./components/RequestPartsSection";

export function NewRequestDialog({
  parts,
  equipment,
  onClose,
}: {
  parts: PartDoc[];
  equipment: EquipmentDoc[];
  onClose: () => void;
}) {
  const { user } = useAuth();
  const catalogPositions =
    useQuery(api.catalogs.list, { kind: "position" }) ?? [];
  const catalogModels = useQuery(api.equipmentModels.list) ?? [];
  const create = useMutation(api.partRequests.create);
  const generateUploadUrl = useMutation(api.partRequests.generateUploadUrl);
  const ensureCatalogItem = useMutation(api.catalogs.ensureItem);

  const form = useNewRequestForm({
    user,
    onClose,
    createMutation: create,
    ensureCatalogItemMutation: ensureCatalogItem,
  });

  const attachments = useRequestAttachments({
    generateUploadUrl,
  });

  const partsSelection = useRequestPartsSelection({
    parts,
    equipment,
    catalogModels,
    equipmentChoice: form.equipmentChoice,
  });

  const onSubmit = () => {
    void form.handleSubmit({
      lines: partsSelection.lines,
      files: attachments.files,
      isUploading: attachments.isUploading,
      selectedEquipment: partsSelection.selectedEquipment,
      onSuccess: () => {
        partsSelection.clearLines();
        attachments.clearFiles();
      },
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Nueva petición de repuestos</DialogTitle>
          <DialogDescription>
            Si tienes el repuesto, añádelo del catálogo. Si no, describe lo que
            necesitas y el responsable buscará proveedor y nº de parte.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="requester">Solicitante *</Label>
            <Input
              id="requester"
              value={form.requesterNameValue}
              onChange={(event) => form.setRequesterName(event.target.value)}
              placeholder="Nombre y apellido"
              disabled={form.busy}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="team">Puesto</Label>
            <AutocompleteInput
              id="team"
              value={form.requesterTeamValue}
              onChange={form.setRequesterTeam}
              items={catalogPositions}
              kind="position"
              placeholder="p. ej. Realización, Audio, Cámaras..."
              disabled={form.busy}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="priority">Prioridad</Label>
            <Select
              value={form.priority}
              onValueChange={(value) => form.setPriority(value as Priority)}
            >
              <SelectTrigger id="priority" className="w-full" disabled={form.busy}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="urgent">Urgente</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="low">Baja</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <RequestEquipmentSection
            equipment={equipment}
            selectedEquipment={partsSelection.selectedEquipment}
            equipmentChoice={form.equipmentChoice}
            onEquipmentChoiceChange={form.setEquipmentChoice}
            equipmentManual={form.equipmentManual}
            onEquipmentManualChange={form.setEquipmentManual}
            disabled={form.busy}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="description">Descripción de lo que se pide</Label>
          <RichTextEditor
            id="description"
            value={form.description}
            onChange={form.setDescription}
            placeholder="Qué necesitas, para qué, cantidades, plazos... (obligatorio si no añades repuestos)"
            disabled={form.busy}
          />
        </div>

        <RequestAttachmentsSection
          files={attachments.files}
          fileAccept={attachments.fileAccept}
          fileInputRef={attachments.fileInputRef}
          openFileDialog={attachments.openFileDialog}
          onFilesChosen={attachments.handleFilesChosen}
          onRemoveFile={attachments.removeFile}
          disabled={form.busy}
        />

        <RequestPartsSection
          parts={parts}
          visibleParts={partsSelection.visibleParts}
          compatibleParts={partsSelection.compatibleParts}
          partById={partsSelection.partById}
          selectedEquipment={partsSelection.selectedEquipment}
          showOnly={partsSelection.showOnly}
          onToggleOnlyCompatible={() => partsSelection.setOnlyCompatible((v) => !v)}
          selectedId={partsSelection.selectedId}
          onSelectIdChange={partsSelection.setSelectedId}
          onAddLine={partsSelection.addLine}
          lines={partsSelection.lines}
          onUpdateQuantity={partsSelection.updateQuantity}
          onRemoveLine={partsSelection.removeLine}
          disabled={form.busy}
        />

        <div className="grid gap-2">
          <Label htmlFor="notes">Contexto o diagnóstico (opcional)</Label>
          <RichTextEditor
            id="notes"
            value={form.notes}
            onChange={form.setNotes}
            placeholder="Síntoma, diagnóstico o cualquier contexto útil"
            disabled={form.busy}
          />
        </div>

        {form.error && <p className="text-sm text-destructive">{form.error}</p>}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={form.busy}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="gap-2"
            onClick={onSubmit}
            disabled={form.busy || attachments.isUploading}
          >
            {form.busy
              ? "Enviando..."
              : attachments.isUploading
                ? "Subiendo archivos..."
                : "Crear petición"}
            {!form.busy && !attachments.isUploading && (
              <ArrowRight className="size-4" />
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
