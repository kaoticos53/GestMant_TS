import { useMutation, useQuery } from "convex/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";

import { useRequestAttachments } from "../hooks/useRequestAttachments";
import { useRequestPartsSelection } from "../hooks/useRequestPartsSelection";
import { useNewRequestForm } from "../hooks/useNewRequestForm";
import { RequestEquipmentSection } from "./components/RequestEquipmentSection";
import { RequestAttachmentsSection } from "./components/RequestAttachmentsSection";
import { RequestPartsSection } from "./components/RequestPartsSection";
import {
  RequestHeaderFields,
  RequestDescriptionField,
  RequestNotesField,
  RequestDialogFooter,
  type NewRequestDialogProps,
} from "./newRequest";

export function NewRequestDialog({
  parts,
  equipment,
  onClose,
}: NewRequestDialogProps) {
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
          <RequestHeaderFields
            requesterName={form.requesterNameValue}
            onRequesterNameChange={form.setRequesterName}
            requesterTeam={form.requesterTeamValue}
            onRequesterTeamChange={form.setRequesterTeam}
            catalogPositions={catalogPositions}
            priority={form.priority}
            onPriorityChange={form.setPriority}
            disabled={form.busy}
          />

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

        <RequestDescriptionField
          value={form.description}
          onChange={form.setDescription}
          disabled={form.busy}
        />

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

        <RequestNotesField
          value={form.notes}
          onChange={form.setNotes}
          disabled={form.busy}
        />

        {form.error && <p className="text-sm text-destructive">{form.error}</p>}

        <RequestDialogFooter
          busy={form.busy}
          isUploading={attachments.isUploading}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}
