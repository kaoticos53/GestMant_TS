import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import {
  ArrowRight,
  FileText,
  Loader2,
  Plus,
  Upload,
  X,
} from "lucide-react";

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
import type { Id } from "@/convex/_generated/dataModel";
import { richDocIsEmpty, richDocToStore } from "@/lib/richDoc";
import {
  FILE_ACCEPT,
  MAX_FILE_SIZE_LABEL,
  compressForUpload,
  exceedsFileLimit,
  uploadToStorage,
} from "@/lib/upload";
import { cn } from "@/lib/utils";
import {
  equipmentLabel,
  getErrorMessage,
  type Priority,
} from "@/lib/workshop";

import type { EquipmentDoc, PartDoc } from "../types";

type PendingFile = {
  id: string;
  file: File;
  previewUrl?: string;
  storageId?: Id<"_storage">;
  uploading: boolean;
  error?: string;
};

export function NewRequestDialog({
  parts,
  equipment,
  onClose,
}: {
  parts: PartDoc[];
  equipment: EquipmentDoc[];
  onClose: () => void;
}) {
  const create = useMutation(api.partRequests.create);
  const generateUploadUrl = useMutation(api.partRequests.generateUploadUrl);
  const { user } = useAuth();
  const catalogPositions = useQuery(api.catalogs.list, { kind: "position" }) ?? [];
  const ensureCatalogItem = useMutation(api.catalogs.ensureItem);

  const [requesterName, setRequesterName] = useState(user?.name ?? "");
  const [requesterTeam, setRequesterTeam] = useState(user?.position ?? "");

  // Si los datos de usuario cargan de forma asíncrona tras el primer render
  useEffect(() => {
    if (user?.name && !requesterName) {
      setRequesterName(user.name);
    }
    if (user?.position && !requesterTeam) {
      setRequesterTeam(user.position);
    }
  }, [user]);
  const [equipmentChoice, setEquipmentChoice] = useState("");
  const [equipmentManual, setEquipmentManual] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<
    { sparePartId: Id<"spareParts">; quantity: number }[]
  >([]);
  const [selectedId, setSelectedId] = useState("");
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [onlyCompatible, setOnlyCompatible] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const partById = new Map(parts.map((part) => [part._id, part]));
  const uploading = files.some((file) => file.uploading);

  // Equipo elegido: permite filtrar las referencias por modelo compatible.
  const selectedEquipment = equipment.find(
    (item) => item._id === equipmentChoice,
  );
  const compatibleParts = selectedEquipment
    ? parts.filter(
        (part) =>
          part.compatibleWith?.includes(selectedEquipment._id) ||
          (selectedEquipment.modelId &&
            part.compatibleModels?.includes(selectedEquipment.modelId)),
      )
    : parts;
  const showOnly =
    Boolean(selectedEquipment) && onlyCompatible && compatibleParts.length > 0;
  const visibleParts = showOnly ? compatibleParts : parts;

  const reset = () => {
    setRequesterName("");
    setRequesterTeam("");
    setEquipmentChoice("");
    setEquipmentManual("");
    setOnlyCompatible(true);
    setPriority("normal");
    setDescription("");
    setNotes("");
    setLines([]);
    setSelectedId("");
    setFiles((current) => {
      current.forEach((file) => {
        if (file.previewUrl) URL.revokeObjectURL(file.previewUrl);
      });
      return [];
    });
    setError(null);
  };

  const addLine = () => {
    if (!selectedId) return;
    const part = parts.find((candidate) => candidate._id === selectedId);
    if (!part) return;
    if (lines.some((line) => line.sparePartId === part._id)) {
      toast.info("Ese repuesto ya está en la petición");
      return;
    }
    setLines([...lines, { sparePartId: part._id, quantity: 1 }]);
    setSelectedId("");
  };

  const updateQuantity = (sparePartId: string, quantity: number) => {
    setLines((current) =>
      current.map((line) =>
        line.sparePartId === sparePartId
          ? { ...line, quantity: Math.max(1, Math.floor(quantity || 1)) }
          : line,
      ),
    );
  };

  const uploadFile = async (entry: PendingFile) => {
    try {
      const uploadUrl = await generateUploadUrl();
      const storageId = await uploadToStorage(uploadUrl, entry.file);
      setFiles((current) =>
        current.map((item) =>
          item.id === entry.id
            ? { ...item, storageId, uploading: false }
            : item,
        ),
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "No se pudo subir el archivo.";
      setFiles((current) =>
        current.map((item) =>
          item.id === entry.id
            ? { ...item, uploading: false, error: message }
            : item,
        ),
      );
    }
  };

  const handleFilesChosen = async (chosen: FileList | null) => {
    if (!chosen) return;
    const accepted: PendingFile[] = [];
    for (const picked of Array.from(chosen)) {
      // Cada foto se recomprime antes de mirar el tope: la de un móvil se queda
      // en unos cientos de kB, así que cabe sin acercarse al límite.
      const file = await compressForUpload(picked);
      if (exceedsFileLimit(file)) {
        toast.error(`${picked.name}: supera los ${MAX_FILE_SIZE_LABEL}`);
        continue;
      }
      const entry: PendingFile = {
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}`,
        file,
        previewUrl: file.type.startsWith("image/")
          ? URL.createObjectURL(file)
          : undefined,
        uploading: true,
      };
      accepted.push(entry);
    }
    if (accepted.length === 0) return;
    setFiles((current) => [...current, ...accepted]);
    accepted.forEach((entry) => void uploadFile(entry));
  };

  const removeFile = (id: string) => {
    setFiles((current) => {
      const target = current.find((file) => file.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return current.filter((file) => file.id !== id);
    });
  };

  const handleSubmit = async () => {
    setError(null);
    if (!requesterName.trim()) {
      setError("Indica quién solicita el repuesto.");
      return;
    }
    const hasAttachments = files.some((file) => file.storageId);
    if (lines.length === 0 && richDocIsEmpty(description) && !hasAttachments) {
      setError(
        "Añade un repuesto del catálogo o describe lo que necesitas (con fotos o documentos si los tienes).",
      );
      return;
    }
    if (uploading) {
      setError("Espera a que se suban los archivos adjuntos.");
      return;
    }
    const failed = files.find((file) => file.error);
    if (failed) {
      setError(
        `No se ha podido subir «${failed.file.name}». Quítalo o inténtalo de nuevo.`,
      );
      return;
    }
    const equipmentText = selectedEquipment
      ? equipmentLabel(selectedEquipment)
      : equipmentChoice === "manual"
        ? equipmentManual.trim()
        : "";
    if (equipmentChoice === "manual" && !equipmentText) {
      setError("Escribe el equipo afectado o elige uno del inventario.");
      return;
    }

    setBusy(true);
    try {
      // El editor ya entrega el documento en bloques; esto solo decide qué se
      // guarda, y evita dejar un párrafo vacío por una descripción escrita y
      // luego borrada.
      const descriptionToSend = richDocToStore(description);
      const notesToSend = richDocToStore(notes);
      const attachments = files
        .filter((file): file is PendingFile & { storageId: Id<"_storage"> } =>
          Boolean(file.storageId),
        )
        .map((file) => ({
          storageId: file.storageId,
          name: file.file.name,
          kind: file.file.type.startsWith("image/")
            ? ("image" as const)
            : ("document" as const),
        }));

      const reference = await create({
        requesterName: requesterName.trim(),
        ...(requesterTeam.trim()
          ? { requesterTeam: requesterTeam.trim() }
          : {}),
        ...(equipmentText ? { equipment: equipmentText } : {}),
        ...(selectedEquipment ? { equipmentId: selectedEquipment._id } : {}),
        priority,
        ...(descriptionToSend ? { description: descriptionToSend } : {}),
        ...(attachments.length > 0 ? { attachments } : {}),
        ...(notesToSend ? { notes: notesToSend } : {}),
        lines,
      });
      toast.success(`Petición ${reference} creada`);

      // Registro transparente en catálogo maestro de puestos
      if (requesterTeam.trim()) {
        void ensureCatalogItem({
          kind: "position",
          name: requesterTeam.trim(),
        }).catch(() => {});
      }

      reset();
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
              value={requesterName}
              onChange={(event) => setRequesterName(event.target.value)}
              placeholder="Nombre y apellido"
              disabled={busy}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="team">Puesto</Label>
            <AutocompleteInput
              id="team"
              value={requesterTeam}
              onChange={setRequesterTeam}
              items={catalogPositions}
              kind="position"
              placeholder="p. ej. Realización, Audio, Cámaras..."
              disabled={busy}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="priority">Prioridad</Label>
            <Select
              value={priority}
              onValueChange={(value) => setPriority(value as Priority)}
            >
              <SelectTrigger id="priority" className="w-full" disabled={busy}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="urgent">Urgente</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="low">Baja</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="equipment-choice">Equipo afectado</Label>
            <Select value={equipmentChoice} onValueChange={setEquipmentChoice}>
              <SelectTrigger
                id="equipment-choice"
                className="w-full"
                disabled={busy}
              >
                <SelectValue placeholder="Elegir equipo del inventario" />
              </SelectTrigger>
              <SelectContent>
                {equipment.map((item) => (
                  <SelectItem key={item._id} value={item._id}>
                    {equipmentLabel(item)}
                    {item.brand ? ` · ${item.brand}` : ""}
                  </SelectItem>
                ))}
                <SelectItem value="manual">
                  Otro — escribir el equipo a mano
                </SelectItem>
              </SelectContent>
            </Select>
            {equipmentChoice === "manual" && (
              <Input
                value={equipmentManual}
                onChange={(event) => setEquipmentManual(event.target.value)}
                placeholder="p. ej. Router de vídeo 7800FR"
                disabled={busy}
                aria-label="Equipo afectado (a mano)"
              />
            )}
            {selectedEquipment && (
              <p className="text-xs text-muted-foreground">
                En inventario
                {selectedEquipment.location
                  ? ` · ${selectedEquipment.location}`
                  : ""}
              </p>
            )}
            {equipment.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No hay equipos en el inventario todavía: escríbelo a mano.
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="description">Descripción de lo que se pide</Label>
          <RichTextEditor
            id="description"
            value={description}
            onChange={setDescription}
            placeholder="Qué necesitas, para qué, cantidades, plazos... (obligatorio si no añades repuestos)"
            disabled={busy}
          />
        </div>

        <div className="grid gap-2">
          <Label>Fotos y documentos</Label>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={FILE_ACCEPT}
            className="hidden"
            onChange={(event) => {
              void handleFilesChosen(event.target.files);
              event.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
          >
            <Upload className="size-4" />
            Añadir fotos o documentos
          </Button>

          {files.length > 0 && (
            <ul className="space-y-1.5">
              {files.map((file) => (
                <li
                  key={file.id}
                  className="flex items-center gap-3 rounded-lg border border-border/70 bg-card px-3 py-2"
                >
                  {file.previewUrl ? (
                    <img
                      src={file.previewUrl}
                      alt=""
                      className="size-9 shrink-0 rounded-md border border-border/70 object-cover"
                    />
                  ) : (
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <FileText className="size-4" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">
                      {file.file.name}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {file.error ? (
                        <span className="text-destructive">{file.error}</span>
                      ) : file.uploading ? (
                        "Subiendo..."
                      ) : (
                        `${Math.max(1, Math.round(file.file.size / 1024))} KB · listo`
                      )}
                    </span>
                  </span>
                  {file.uploading && (
                    <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeFile(file.id)}
                    disabled={busy || file.uploading}
                    aria-label={`Quitar ${file.file.name}`}
                  >
                    <X className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">
            Imágenes, PDF o documentos de oficina. Máximo {MAX_FILE_SIZE_LABEL}{" "}
            por archivo.
          </p>
        </div>

        <div className="grid gap-2">
          <Label>Referencias del catálogo (opcional)</Label>
          {selectedEquipment && (
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
                    ? `Solo compatibles con ${selectedEquipment.model} (${compatibleParts.length})`
                    : `Ver todo el catálogo (${parts.length})`}
                </button>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Sin repuestos marcados como compatibles con{" "}
                  {selectedEquipment.model}: se muestra todo el catálogo.
                </span>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="w-full" disabled={busy}>
                <SelectValue placeholder="Buscar repuesto en el catálogo" />
              </SelectTrigger>
              <SelectContent>
                {visibleParts.map((part) => (
                  <SelectItem key={part._id} value={part._id}>
                    {part.code} — {part.name} (stock {part.stock})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              className="shrink-0 gap-1.5"
              onClick={addLine}
              disabled={busy || !selectedId}
            >
              <Plus className="size-4" />
              Añadir
            </Button>
          </div>

          {lines.length > 0 && (
            <ul className="divide-y divide-border/70 rounded-lg border border-border/70 bg-card">
              {lines.map((line) => {
                const part = partById.get(line.sparePartId);
                return (
                  <li
                    key={line.sparePartId}
                    className="flex items-center justify-between gap-3 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {part?.name ?? "Repuesto"}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {part?.code}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(event) =>
                          updateQuantity(
                            line.sparePartId,
                            Number(event.target.value),
                          )
                        }
                        className="h-8 w-16 text-right tabular-nums"
                        disabled={busy}
                        aria-label={`Cantidad de ${part?.code ?? "repuesto"}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        onClick={() =>
                          setLines((current) =>
                            current.filter(
                              (item) => item.sparePartId !== line.sparePartId,
                            ),
                          )
                        }
                        disabled={busy}
                        aria-label="Quitar repuesto"
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="notes">Contexto o diagnóstico (opcional)</Label>
          <RichTextEditor
            id="notes"
            value={notes}
            onChange={setNotes}
            placeholder="Síntoma, diagnóstico o cualquier contexto útil"
            disabled={busy}
          />
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
          <Button
            type="button"
            className="gap-2"
            onClick={handleSubmit}
            disabled={busy || uploading}
          >
            {busy
              ? "Enviando..."
              : uploading
                ? "Subiendo archivos..."
                : "Crear petición"}
            {!busy && !uploading && <ArrowRight className="size-4" />}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
