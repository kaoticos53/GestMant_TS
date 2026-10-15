import { RichTextEditor } from "@/components/RichTextEditor";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  DEFAULT_MANUAL_TYPE,
  MANUAL_ACCEPT,
  MANUAL_FILE_FORMAT,
  MANUAL_TYPES,
  isPdfFile,
  manualClassification,
  manualTitleFromFile,
  type ManualKind,
} from "@/lib/manuals";
import { richDocToStore } from "@/lib/richDoc";
import {
  MAX_MANUAL_FILE_SIZE_LABEL,
  exceedsManualLimit,
  looksLikePdf,
  uploadToStorage,
} from "@/lib/upload";
import {
  equipmentLabel,
  formatFileSize,
  getErrorMessage,
} from "@/lib/workshop";
import { useAction, useMutation } from "convex/react";
import { FileText, NotebookPen, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { ManualDoc } from "./ManualsView";

type EquipmentDoc = Doc<"equipment">;

/* ------------------------------------------------------------------ */
/* Alta / edición de manual                                            */
/* ------------------------------------------------------------------ */

/**
 * Formulario de un manual. La forma se elige al crearlo y no cambia después:
 * un archivo subido o una nota del taller. Quien no gestiona el módulo solo
 * puede escribir notas —es suyo lo que escribe—, así que el archivo no se le
 * ofrece.
 *
 * Con `fixedEquipmentId` se abre desde la ficha de un equipo: el manual nace
 * asignado a él y el equipo no se cambia desde aquí —para dejarlo suelto o del
 * modelo está el módulo de manuales—. Su marca y su modelo se toman de la ficha
 * del equipo, que es lo que hace que el manual aparezca también en ella.
 */
export function ManualFormDialog({
  manual,
  equipment,
  canManage,
  fixedEquipmentId = null,
  onClose,
}: {
  manual: ManualDoc | null;
  equipment: EquipmentDoc[];
  canManage: boolean;
  /** Se abre desde la ficha de este equipo: el manual queda asignado a él. */
  fixedEquipmentId?: string | null;
  onClose: () => void;
}) {
  const create = useMutation(api.manuals.create);
  const update = useMutation(api.manuals.update);
  const generateUploadUrl = useMutation(api.manuals.generateUploadUrl);
  const verifyManualPdf = useAction(api.manuals.verifyManualPdf);

  const isEdit = manual !== null;
  const initialKind: ManualKind = manual?.kind ?? (canManage ? "file" : "note");
  const [kind, setKind] = useState<ManualKind>(initialKind);
  const [title, setTitle] = useState(manual?.title ?? "");
  const [type, setType] = useState<string>(manual?.type ?? DEFAULT_MANUAL_TYPE);
  const [brand, setBrand] = useState(manual?.brand ?? "");
  const [model, setModel] = useState(manual?.model ?? "");
  const [equipmentId, setEquipmentId] = useState<string>(
    manual?.equipmentId ?? fixedEquipmentId ?? "none",
  );
  const [notes, setNotes] = useState(manual?.notes ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFile = kind === "file";
  // La clasificación efectiva: con equipo, la marca y el modelo son los suyos
  // —lo mismo que enseña el formulario, para no guardar algo distinto de lo que
  // se ve—; sin él, lo que se haya escrito.
  const classification = manualClassification(equipment, {
    equipmentId,
    brand,
    model,
  });
  const linked = classification.linked;
  /** El equipo al que queda asignado el manual, si es de uno del inventario. */
  const linkedId = linked?._id ?? null;

  /** Al elegir equipo, la clasificación se hereda de él (si está vacía). */
  const handleEquipmentChange = (value: string) => {
    setEquipmentId(value);
    const item = equipment.find((option) => option._id === value);
    if (!item) return;
    if (!brand.trim()) setBrand(item.brand ?? "");
    if (!model.trim()) setModel(item.model);
  };

  const handleFileChange = async (chosen: File | null) => {
    setError(null);
    if (!chosen) {
      setFile(null);
      return;
    }
    if (!isPdfFile({ name: chosen.name, contentType: chosen.type })) {
      setError(`El manual se sube en ${MANUAL_FILE_FORMAT}.`);
      setFile(null);
      return;
    }
    if (exceedsManualLimit(chosen)) {
      setError(
        `El manual puede pesar como mucho ${MAX_MANUAL_FILE_SIZE_LABEL}.`,
      );
      setFile(null);
      return;
    }
    try {
      const head = new Uint8Array(await chosen.slice(0, 4).arrayBuffer());
      if (!looksLikePdf(head)) {
        setError(
          `El manual se sube en ${MANUAL_FILE_FORMAT}. El archivo seleccionado no contiene una cabecera PDF válida (%PDF-).`,
        );
        setFile(null);
        return;
      }
    } catch {
      // Si la lectura directa de cabecera no está disponible en el entorno cliente, valida el backend
    }
    setFile(chosen);
    // El título vacío se propone a partir del nombre del archivo.
    if (!title.trim()) setTitle(manualTitleFromFile(chosen.name));
  };

  const handleSubmit = async () => {
    setError(null);
    if (!title.trim() && !(isFile && (file || manual))) {
      setError("Ponle un título al manual.");
      return;
    }
    if (isFile && !isEdit && !file) {
      setError("Elige el archivo del manual.");
      return;
    }
    if (!isFile && !richDocToStore(notes)) {
      setError("Escribe la nota del manual: es su contenido.");
      return;
    }

    setBusy(true);
    try {
      // El archivo se sube antes de guardar la ficha: el manual guarda su
      // identificador, no el archivo.
      let uploaded: Id<"_storage"> | null = null;
      if (isFile && file) {
        const uploadUrl = await generateUploadUrl();
        uploaded = await uploadToStorage(uploadUrl, file);
        await verifyManualPdf({ storageId: uploaded });
      }
      if (isEdit && manual) {
        await update({
          id: manual._id,
          title: title.trim(),
          type,
          brand: classification.brand,
          model: classification.model,
          equipmentId: linkedId,
          ...(uploaded
            ? { storageId: uploaded, fileName: file?.name ?? "" }
            : {}),
          // La nota viaja siempre: el backend la normaliza y, en los manuales
          // de tipo nota, no deja que se quede vacía.
          notes,
        });
        toast.success(`«${title.trim()}» actualizado`);
      } else if (isFile) {
        if (!uploaded) {
          setError("Elige el archivo del manual.");
          return;
        }
        await create({
          title: title.trim(),
          kind: "file",
          type,
          brand: classification.brand,
          model: classification.model,
          ...(linkedId ? { equipmentId: linkedId } : {}),
          storageId: uploaded,
          fileName: file?.name ?? "",
          notes,
        });
        toast.success(`«${title.trim()}» añadido a los manuales`);
      } else {
        await create({
          title: title.trim(),
          kind: "note",
          type,
          brand: classification.brand,
          model: classification.model,
          ...(linkedId ? { equipmentId: linkedId } : {}),
          notes,
        });
        toast.success(`Nota «${title.trim()}» añadida a los manuales`);
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
          {/* La forma del manual: se elige al crearlo y no cambia después. */}
          {!isEdit && (
            <div className="grid gap-2">
              <Label>Qué se añade</Label>
              <div className="flex flex-wrap gap-2">
                {canManage && (
                  <Button
                    type="button"
                    variant={isFile ? "default" : "outline"}
                    size="sm"
                    className="gap-1.5"
                    disabled={busy}
                    onClick={() => setKind("file")}
                  >
                    <FileText className="size-4" />
                    Archivo {MANUAL_FILE_FORMAT}
                  </Button>
                )}
                <Button
                  type="button"
                  variant={!isFile ? "default" : "outline"}
                  size="sm"
                  className="gap-1.5"
                  disabled={busy}
                  onClick={() => setKind("note")}
                >
                  <NotebookPen className="size-4" />
                  Nota del taller
                </Button>
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="manual-title">Título *</Label>
              <Input
                id="manual-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Manual de servicio HDC-3500"
                disabled={busy}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="manual-type">Tipo *</Label>
              <Select value={type} onValueChange={setType} disabled={busy}>
                <SelectTrigger id="manual-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MANUAL_TYPES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="manual-equipment">Equipo del inventario</Label>
              {fixedEquipmentId && linked ? (
                // Se viene de la ficha del equipo: ya está asignado y no hay
                // nada que elegir (el selector sería una forma de perderlo).
                <p className="rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-sm">
                  {equipmentLabel(linked)}
                </p>
              ) : (
                <Select
                  value={equipmentId}
                  onValueChange={handleEquipmentChange}
                  disabled={busy}
                >
                  <SelectTrigger id="manual-equipment" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      Sin equipo (es del modelo)
                    </SelectItem>
                    {equipment.map((item) => (
                      <SelectItem key={item._id} value={item._id}>
                        {equipmentLabel(item)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="manual-brand">Marca</Label>
              <Input
                id="manual-brand"
                value={linked ? classification.brand : brand}
                onChange={(event) => setBrand(event.target.value)}
                placeholder="Sony"
                disabled={busy || Boolean(linked)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="manual-model">Modelo</Label>
              <Input
                id="manual-model"
                value={linked ? classification.model : model}
                onChange={(event) => setModel(event.target.value)}
                placeholder="HDC-3500"
                disabled={busy || Boolean(linked)}
              />
            </div>
          </div>

          {linked && (
            <p className="text-xs leading-5 text-muted-foreground">
              {fixedEquipmentId
                ? `Se añade a ${equipmentLabel(linked)}: la marca y el modelo son los suyos, así que el manual aparecerá también en su ficha.`
                : `Al asignarlo a ${equipmentLabel(linked)}, la marca y el modelo se toman del equipo: así el manual aparece también en su ficha.`}
            </p>
          )}

          {isFile && (
            <div className="grid gap-2">
              <Label htmlFor="manual-file">
                Archivo ({MANUAL_FILE_FORMAT}){!isEdit && " *"}
              </Label>
              <Input
                id="manual-file"
                type="file"
                accept={MANUAL_ACCEPT}
                disabled={busy}
                onChange={(event) =>
                  handleFileChange(event.target.files?.[0] ?? null)
                }
              />
              <p className="text-xs leading-5 text-muted-foreground">
                {isEdit
                  ? "Elige un archivo solo si quieres sustituir el que tiene: el anterior se conserva en el historial de la ficha, por si hace falta volver a él."
                  : `Se sube al almacén del taller. Hasta ${MAX_MANUAL_FILE_SIZE_LABEL}.`}
              </p>
              {file && (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <FileText className="size-3.5" />
                  {file.name} · {formatFileSize(file.size)}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    aria-label="Quitar el archivo elegido"
                    onClick={() => setFile(null)}
                  >
                    <X className="size-3.5" />
                  </Button>
                </p>
              )}
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="manual-notes">
              {isFile ? "Nota del taller (opcional)" : "Nota del taller *"}
            </Label>
            <RichTextEditor
              id="manual-notes"
              value={notes}
              onChange={setNotes}
              disabled={busy}
              placeholder="Lo que conviene saber de este equipo: puesta en marcha, ajustes, avisos..."
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

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
