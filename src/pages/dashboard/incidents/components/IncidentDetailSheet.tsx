import { useRef, useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  Archive,
  Check,
  ChevronDown,
  FileDown,
  FileText,
  MapPin,
  Paperclip,
  Pen,
  Pencil,
  Plus,
  PackagePlus,
  SearchX,
  Siren,
  Trash2,
  Undo2,
  Upload,
  UserPlus,
  Wrench,
  X,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { BlockedSteps } from "@/components/BlockedSteps";
import { DocumentLink } from "@/components/DocumentLink";
import { RichText } from "@/components/RichText";
import { RichTextEditor } from "@/components/RichTextEditor";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  INCIDENT_STEP_LABELS,
  blockedIncidentSteps,
  canAdvanceIncident,
  isClosedIncident,
} from "@/lib/incidentFlow";
import { reporterNoticeText } from "@/lib/incidentMail";
import {
  noteRemovedToast,
  noteRestoreUndoneToast,
  noteRestoredToast,
  noteVersionRestoredToast,
} from "@/lib/noteToasts";
import { downloadPdf, loadPdfImage } from "@/lib/pdfBrowser";
import { formatPublicCode } from "@/lib/publicCode";
import {
  REPORT_MIME,
  incidentReport,
  incidentReportFilename,
  incidentReportPackageFilename,
  incidentReportPdfFilename,
} from "@/lib/report";
import { reportPackage } from "@/lib/reportPackage";
import {
  downloadReportPackage,
  loadReportPhoto,
} from "@/lib/reportPackageBrowser";
import { reportToPdf } from "@/lib/reportPdf";
import {
  richDocIsEmpty,
  richDocToPlainText,
  richDocToStore,
} from "@/lib/richDoc";
import {
  FILE_ACCEPT,
  MAX_FILE_SIZE_LABEL,
  compressForUpload,
  exceedsFileLimit,
  uploadToStorage,
} from "@/lib/upload";
import { cn } from "@/lib/utils";
import {
  INCIDENT_STATUS_META,
  PRIORITY_META,
  documentTrailLabel,
  equipmentLabel,
  formatClockTime,
  formatDateTime,
  getErrorMessage,
  isNoteWithinEditWindow,
  liveNotes,
  noteEditDeadline,
  noteRestoreUndoIndex,
  retiredNotes,
} from "@/lib/workshop";

import type { EquipmentDoc, IncidentDoc } from "../types";
import { AssignDialog } from "../dialogs/AssignDialog";
import { VerifyDialog } from "../dialogs/VerifyDialog";
import { CloseDialog } from "../dialogs/CloseDialog";
import { CorrectEquipmentDialog } from "../dialogs/CorrectEquipmentDialog";
import { IncidentRequestDialog } from "../dialogs/IncidentRequestDialog";
import { EquipmentFormDialog } from "../../equipment/dialogs/EquipmentFormDialog";
import { NoteHistory } from "./NoteHistory";

export function IncidentDetailSheet({
  incident,
  equipment,
  requests,
  currentUserId,
  currentUserName,
  canAssign,
  onClose,
}: {
  incident: IncidentDoc;
  equipment: EquipmentDoc[];
  requests: Doc<"partRequests">[];
  currentUserId: Id<"users"> | null;
  currentUserName: string;
  canAssign: boolean;
  onClose: () => void;
}) {
  const selfAssign = useMutation(api.incidents.selfAssign);
  const archiveIncident = useMutation(api.incidents.archive);
  const withdrawIncident = useMutation(api.incidents.withdraw);
  const attachDocument = useMutation(api.incidents.attachDocument);
  const updateDocument = useMutation(api.incidents.updateDocument);
  const removeDocument = useMutation(api.incidents.removeDocument);
  const generateUploadUrl = useMutation(api.incidents.generateUploadUrl);
  const updateEquipment = useMutation(api.incidents.updateEquipment);
  const addNote = useMutation(api.incidents.addNote);
  const updateNote = useMutation(api.incidents.updateNote);
  const removeNote = useMutation(api.incidents.removeNote);
  const restoreNote = useMutation(api.incidents.restoreNote);
  const restoreNoteVersion = useMutation(api.incidents.restoreNoteVersion);
  // El rastro de auditoría se pide solo a quien puede gestionar el expediente:
  // al resto el backend se lo negaría, así que ni se consulta.
  const trail = useQuery(
    api.incidents.documentTrail,
    canAssign ? { incidentId: incident._id } : "skip",
  );
  const [assignTarget, setAssignTarget] = useState<
    "assign" | "workshop" | null
  >(null);
  // Retirada a la papelera: el aviso que lo confirma —y el motivo, si lo hay—
  // viven aquí, porque se retira desde la ficha y no desde un módulo aparte.
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState("");
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  // Corrección de los datos del equipo: quien notificó los escribió de memoria,
  // y quien tiene la máquina delante es quien los puede poner bien.
  const [equipmentOpen, setEquipmentOpen] = useState(false);
  const [createEquipmentOpen, setCreateEquipmentOpen] = useState(false);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  // Documento del expediente que se está corrigiendo (null = se adjunta uno
  // nuevo) y documento que se está a punto de quitar.
  const [editingDocumentId, setEditingDocumentId] =
    useState<Id<"incidentDocuments"> | null>(null);
  const [deletingDocumentId, setDeletingDocumentId] =
    useState<Id<"incidentDocuments"> | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [documentName, setDocumentName] = useState("");
  const [documentNote, setDocumentNote] = useState("");
  // Archivo elegido para el documento: al adjuntar es el que se sube al
  // servidor y al corregir es el que reemplaza al que tuviera, que se borra.
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const documentFileInputRef = useRef<HTMLInputElement | null>(null);
  const [note, setNote] = useState("");
  // Nota que se está corrigiendo (null = se está escribiendo una nueva) y nota
  // que se está a punto de borrar.
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // El mismo guardado sirve para adjuntar y para corregir.
  const [savingDoc, setSavingDoc] = useState(false);
  // El PDF se compone al vuelo (mide el texto e incrusta las imágenes): mientras
  // se prepara, el botón lo dice.
  const [preparingPdf, setPreparingPdf] = useState(false);
  // El paquete trae las fotos de una en una: el botón avisa mientras se bajan.
  const [preparingPackage, setPreparingPackage] = useState(false);
  const [removingDoc, setRemovingDoc] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [removingNote, setRemovingNote] = useState(false);
  const [restoringNoteId, setRestoringNoteId] = useState<string | null>(null);
  // Versión del historial que se está restaurando ahora mismo (su posición en
  // el historial, que es como se identifica cada entrada).
  const [restoringVersionAt, setRestoringVersionAt] = useState<number | null>(
    null,
  );

  const status = INCIDENT_STATUS_META[incident.status];
  const linkedEquipment = incident.equipmentId
    ? (equipment.find((item) => item._id === incident.equipmentId) ?? null)
    : null;
  const linkedRequest = requests.find(
    (request) => request.incidentId === incident._id,
  );
  const isAssignee =
    currentUserId !== null &&
    (incident.assigneeId === currentUserId ||
      incident.workshopAssigneeId === currentUserId);
  const canWork = canAssign || isAssignee;
  // Lo que la máquina deja hacer desde aquí y lo que no: los pasos que no se
  // pueden dar se enseñan con su motivo en vez de desaparecer (`lib/incidentFlow`).
  // Solo se cuentan a quien va a actuar: al resto le basta saber que no le toca.
  const blocked = canWork ? blockedIncidentSteps(incident.status) : [];
  // El rastro llega con la consulta: mientras está en camino (solo se pide a
  // quien coordina) no se exporta un informe al que le falte la auditoría.
  const trailPending = canAssign && trail === undefined;
  // Una nota retirada sale del cuaderno pero se puede devolver: la ve quien
  // puede recuperarla —quien la escribió o quien coordina la incidencia—, que
  // es el mismo permiso que pide el backend.
  const restorableNotes = retiredNotes(incident.lifecycleNotes).filter(
    (entry) =>
      canAssign || (currentUserId !== null && entry.authorId === currentUserId),
  );

  /**
   * El parte completo de la incidencia para entregarlo fuera de la aplicación:
   * los datos, el cuaderno, los documentos y, cuando quien lo exporta puede leer
   * el expediente, el rastro de auditoría de documentos. Se compone una sola vez
   * y de aquí salen las dos descargas —Markdown y PDF—, que así no pueden contar
   * cosas distintas.
   */
  const reportContent = () =>
    incidentReport({
      incident,
      equipmentName: linkedEquipment
        ? equipmentLabel(linkedEquipment)
        : undefined,
      trail: trail ?? undefined,
      exportedBy: currentUserName,
    });

  const handleDownloadReport = () => {
    try {
      downloadText(
        incidentReportFilename(incident.reference),
        reportContent(),
        REPORT_MIME,
      );
      toast.success(`Parte de ${incident.reference} descargado`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  /**
   * El parte entregable: el Markdown con sus fotos dentro, en un ZIP. Es la
   * descarga que no depende del servidor —ni de tener sesión— una vez hecha:
   * quien lo recibe descomprime y ve el parte con sus fotos.
   */
  const handleDownloadReportPackage = async () => {
    setPreparingPackage(true);
    try {
      const pack = await reportPackage({
        markdown: reportContent(),
        markdownName: incidentReportFilename(incident.reference),
        loadPhoto: loadReportPhoto,
      });
      downloadReportPackage(
        incidentReportPackageFilename(incident.reference),
        pack.bytes,
      );
      const fotos =
        pack.photos.length === 0
          ? "sin fotos"
          : pack.photos.length === 1
            ? "con 1 foto"
            : `con ${pack.photos.length} fotos`;
      if (pack.missing.length === 0) {
        toast.success(`Paquete de ${incident.reference} descargado ${fotos}`);
      } else {
        // La foto que falta se dice, no se calla: el paquete se entrega igual.
        toast.warning(
          `Paquete de ${incident.reference} descargado ${fotos} · faltó ${pack.missing.join(", ")}`,
        );
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setPreparingPackage(false);
    }
  };

  /**
   * El mismo parte, en PDF. Se compone aquí mismo, en el navegador, y las
   * imágenes que el informe cita se traen de donde estén para incrustarlas: por
   * eso el botón avisa mientras se prepara.
   */
  const handleDownloadReportPdf = async () => {
    setPreparingPdf(true);
    try {
      const bytes = await reportToPdf(reportContent(), {
        footer: `Parte de ${incident.reference} · Pulso Taller`,
        loadImage: loadPdfImage,
      });
      downloadPdf(incidentReportPdfFilename(incident.reference), bytes);
      toast.success(`Parte de ${incident.reference} en PDF descargado`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setPreparingPdf(false);
    }
  };

  const handleSelfAssign = async () => {
    setBusy(true);
    try {
      await selfAssign({ incidentId: incident._id });
      toast.success(`${incident.reference} autoasignada`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const handleArchive = async () => {
    setBusy(true);
    try {
      await archiveIncident({ incidentId: incident._id });
      toast.success(`${incident.reference} enviada al archivo`);
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const handleWithdraw = async () => {
    setBusy(true);
    try {
      const reason = withdrawReason.trim();
      await withdrawIncident({
        incidentId: incident._id,
        ...(reason ? { reason } : {}),
      });
      toast.success(
        `${incident.reference} retirada: queda en la papelera por si hay que volver a por ella`,
      );
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
      setWithdrawOpen(false);
      setWithdrawReason("");
    }
  };

  const deletingDocument = incident.documents?.find(
    (doc) => doc._id === deletingDocumentId,
  );
  // El documento que se está corrigiendo, con su archivo actual: el diálogo
  // necesita saber si hay algo que reemplazar y a qué enlace apunta hoy.
  const editingDocument = incident.documents?.find(
    (doc) => doc._id === editingDocumentId,
  );

  const handleNewDocument = () => {
    setEditingDocumentId(null);
    // Al adjuntar no se corrige nada: el archivo es obligatorio y no hay uno
    // anterior que sustituir.
    setDocumentName("");
    setDocumentNote("");
    setDocumentFile(null);
    setDocumentsOpen(true);
  };

  const handleEditDocument = (
    documentId: Id<"incidentDocuments">,
    name: string,
    note?: string,
  ) => {
    setEditingDocumentId(documentId);
    setDocumentName(name);
    setDocumentNote(note ?? "");
    setDocumentFile(null);
    setDocumentsOpen(true);
  };

  const handleCloseDocument = () => {
    setDocumentsOpen(false);
    setDocumentName("");
    setDocumentNote("");
    setDocumentFile(null);
    setEditingDocumentId(null);
  };

  /**
   * El archivo elegido es el que se sube al guardar. Su nombre propone el
   * nombre visible del documento, que se puede corregir antes de adjuntarlo.
   * Si es una foto, se recomprime antes de seguir: una foto de móvil se queda
   * en unos cientos de kB y no llega a rozar el tope.
   */
  const handleDocumentFileChosen = async (chosen: FileList | null) => {
    const picked = chosen?.[0];
    if (!picked) return;
    const file = await compressForUpload(picked);
    if (exceedsFileLimit(file)) {
      toast.error(`${picked.name}: supera los ${MAX_FILE_SIZE_LABEL}`);
      return;
    }
    setDocumentFile(file);
    setDocumentName((current) => (current.trim() ? current : file.name));
  };

  const handleSaveDocument = async () => {
    // El nombre puede venir del archivo: si se eligió uno, no hace falta
    // escribirlo a mano.
    const name = documentName.trim() || documentFile?.name.trim() || "";
    if (!name) return;
    setSavingDoc(true);
    try {
      // Primero el archivo y luego la ficha: si la subida falla, el expediente
      // no se queda con un documento apuntando a un archivo que no existe —ni
      // se borra el que ya tenía—.
      const storageId = documentFile
        ? await uploadToStorage(await generateUploadUrl(), documentFile)
        : undefined;
      if (editingDocumentId) {
        await updateDocument({
          incidentId: incident._id,
          documentId: editingDocumentId,
          name,
          note: richDocToStore(documentNote),
          ...(storageId ? { storageId } : {}),
        });
        toast.success(
          storageId
            ? "Documento actualizado con su archivo nuevo"
            : "Documento actualizado",
        );
      } else {
        await attachDocument({
          incidentId: incident._id,
          name,
          ...(storageId ? { storageId } : {}),
          note: richDocToStore(documentNote),
        });
        toast.success(
          storageId ? "Documento adjunto con su archivo" : "Documento adjunto",
        );
      }
      handleCloseDocument();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSavingDoc(false);
    }
  };

  const handleRemoveDocument = async () => {
    if (!deletingDocumentId) return;
    setRemovingDoc(true);
    try {
      await removeDocument({
        incidentId: incident._id,
        documentId: deletingDocumentId,
      });
      toast.success("Documento quitado del expediente");
      setDeletingDocumentId(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setRemovingDoc(false);
    }
  };

  const handleCloseNote = () => {
    setNotesOpen(false);
    setNote("");
    setEditingNoteId(null);
  };

  const handleNewNote = () => {
    setEditingNoteId(null);
    setNote("");
    setNotesOpen(true);
  };

  const handleEditNote = (noteId: string, text: string) => {
    setEditingNoteId(noteId);
    setNote(text);
    setNotesOpen(true);
  };

  const handleSaveNote = async () => {
    // El editor deja un párrafo suelto al final: se limpia al guardar, y si al
    // final no queda nada escrito, no hay nada que guardar.
    const noteText = richDocToStore(note);
    if (!noteText) return;
    setSavingNote(true);
    try {
      if (editingNoteId) {
        await updateNote({
          incidentId: incident._id,
          noteId: editingNoteId,
          note: noteText,
        });
        toast.success("Nota corregida");
      } else {
        await addNote({ incidentId: incident._id, note: noteText });
        toast.success("Nota añadida");
      }
      handleCloseNote();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSavingNote(false);
    }
  };

  /** Devuelve al cuaderno una nota retirada: deshace el borrado o la rescata. */
  const handleRestoreNote = async (noteId: string) => {
    setRestoringNoteId(noteId);
    try {
      await restoreNote({ incidentId: incident._id, noteId });
      noteRestoredToast();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setRestoringNoteId(null);
    }
  };

  /**
   * Devuelve la nota a una versión anterior de su historial. El backend exige
   * lo mismo que para corregirla —su autor y dentro del plazo—, porque es una
   * corrección: el texto que había antes queda archivado igual.
   *
   * El aviso deja deshacerlo. Deshacer es volver a la posición donde la
   * restauración archivó el texto que se acaba de quitar (`noteRestoreUndoIndex`),
   * y ese aviso ya no ofrece deshacer: encadenar vueltas dejaría el cuaderno sin
   * saber dónde está.
   */
  const handleRestoreVersion = async (
    noteId: string,
    versionIndex: number,
    mode: "restore" | "undo" = "restore",
  ) => {
    // Se mira antes de restaurar: la posición que guardará el texto que se
    // quita solo se conoce con el historial que hay ahora.
    const entry = liveNotes(incident.lifecycleNotes).find(
      (item) => item.id === noteId,
    );
    const undoIndex = entry ? noteRestoreUndoIndex(entry, versionIndex) : null;
    setRestoringVersionAt(versionIndex);
    try {
      await restoreNoteVersion({
        incidentId: incident._id,
        noteId,
        versionIndex,
      });
      if (mode === "undo") {
        noteRestoreUndoneToast();
      } else {
        // La posición de deshacer se mira antes de restaurar: la guarda el
        // propio aviso. Sin ella (la nota ya decía eso) no hay nada que
        // deshacer.
        noteVersionRestoredToast(
          undoIndex === null
            ? {}
            : {
                onUndo: () =>
                  void handleRestoreVersion(noteId, undoIndex, "undo"),
              },
        );
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setRestoringVersionAt(null);
    }
  };

  const handleRemoveNote = async () => {
    if (!deletingNoteId) return;
    // La nota se retira, no se borra: se guarda su identificador para poder
    // deshacer desde el propio aviso.
    const noteId = deletingNoteId;
    setRemovingNote(true);
    try {
      await removeNote({ incidentId: incident._id, noteId });
      setDeletingNoteId(null);
      noteRemovedToast({ onUndo: () => void handleRestoreNote(noteId) });
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setRemovingNote(false);
    }
  };

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl lg:max-w-2xl">
        <SheetHeader>
          <div className="flex flex-wrap items-center gap-2">
            {/* La referencia es el número con el que el taller cita el caso
                («la INC-0004»): se queda a la vista y se puede seleccionar de un
                clic. Quien notificó no la usa —sigue el suyo por el código, que
                está en los datos de la notificación—. */}
            <span className="select-all font-mono text-sm font-semibold text-muted-foreground">
              {incident.reference}
            </span>
            <Badge variant="outline" className={status.badgeClassName}>
              {status.label}
            </Badge>
            {incident.maintenanceId && (
              <Badge
                variant="outline"
                className="border-emerald-600/25 bg-emerald-600/10 text-emerald-700"
              >
                Ficha creada
              </Badge>
            )}
          </div>
          <SheetTitle className="text-xl tracking-tight">
            {incident.equipmentKind} · {incident.model}
          </SheetTitle>
          <SheetDescription>
            {status.description} · notificada{" "}
            {formatDateTime(incident.reportedAt)}
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-4 px-4 pb-4 sm:px-6">
          <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Datos de la notificación
              </p>
              {canWork && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 px-2 text-xs"
                  onClick={() => setEquipmentOpen(true)}
                >
                  <Pencil className="size-3.5" />
                  Corregir datos del equipo
                </Button>
              )}
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">
                  Notificada por
                </dt>
                <dd>{incident.reporterName}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Puesto</dt>
                <dd>{incident.reporterRole ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Ubicación</dt>
                <dd>{incident.location ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  Fecha de notificación
                </dt>
                <dd>{formatDateTime(incident.reportedAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Modelo</dt>
                <dd>{incident.model ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Nº de serie</dt>
                <dd className="font-mono">{incident.serialNumber ?? "—"}</dd>
              </div>
              {incident.publicCode && (
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground">
                    Código con el que lo sigue quien notificó
                  </dt>
                  {/* El único identificador que sale del taller: es lo que se le
                      dicta por teléfono a quien pregunte por su caso. */}
                  <dd className="select-all font-mono">
                    {formatPublicCode(incident.publicCode)}
                  </dd>
                </div>
              )}
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">
                  Aviso a quien notificó
                </dt>
                {/* Quien avisó no tiene cuenta: este es el único sitio donde el
                    taller ve si su correo salió, o por qué no, sin abrir la
                    base de datos ni quedarse con la duda. */}
                <dd>{reporterNoticeText(incident)}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">
                  Equipo en inventario
                </dt>
                <dd className="mt-1 flex flex-wrap items-center gap-2">
                  {linkedEquipment ? (
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {equipmentLabel(linkedEquipment)}
                      </span>
                      {linkedEquipment.serialNumber && (
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                          s/n: {linkedEquipment.serialNumber}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-amber-700 dark:text-amber-400">
                        Equipo no inventariado
                      </span>
                      {canWork && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-6 gap-1 border-amber-500/30 bg-amber-500/10 px-2 text-xs text-amber-700 hover:bg-amber-500/20 dark:text-amber-300"
                          onClick={() => setCreateEquipmentOpen(true)}
                        >
                          <Plus className="size-3" />
                          Dar de alta en inventario
                        </Button>
                      )}
                    </div>
                  )}
                </dd>
              </div>
            </dl>
            <RichText
              value={incident.description}
              className="mt-3 rounded-lg border border-border/70 bg-background/60 p-3 text-sm leading-6"
            />
          </div>

          <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Asignación
            </p>
            <div className="mt-2 grid gap-2 text-sm">
              <p>
                <span className="text-muted-foreground">Técnico: </span>
                {incident.assigneeName ?? "Sin asignar"}
              </p>
              {(incident.status === "workshop" ||
                incident.workshopAssigneeName) && (
                <p>
                  <span className="text-muted-foreground">
                    Entrada a taller:{" "}
                  </span>
                  {incident.workshopAssigneeName ?? "—"}
                </p>
              )}
              {incident.closedAt && (
                <p>
                  <span className="text-muted-foreground">Cerrada: </span>
                  {formatDateTime(incident.closedAt)}
                </p>
              )}
              {incident.notes && (
                <RichText
                  value={incident.notes}
                  className="rounded-lg border border-border/70 bg-background/60 p-3 text-sm leading-6"
                />
              )}
              {linkedRequest && (
                <p className="font-mono text-xs text-muted-foreground">
                  Petición {linkedRequest.reference} ·{" "}
                  {PRIORITY_META[linkedRequest.priority].label}
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Historial de estados
            </p>
            <ol className="mt-3 space-y-3">
              {incident.history.map((entry, index) => {
                const meta = INCIDENT_STATUS_META[entry.status];
                return (
                  <li
                    key={`${entry.status}-${entry.at}-${index}`}
                    className="flex gap-3"
                  >
                    <span className="mt-1 size-2 shrink-0 rounded-full bg-signal" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={meta.badgeClassName}
                        >
                          {meta.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(entry.at)}
                        </span>
                        {entry.by && (
                          <span className="text-xs text-muted-foreground">
                            · {entry.by}
                          </span>
                        )}
                      </div>
                      {entry.note && (
                        <RichText
                          value={entry.note}
                          className="mt-0.5 text-muted-foreground"
                        />
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          {(canAssign || (incident.documents?.length ?? 0) > 0) && (
            <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Documentos adjuntos
                </p>
                {canAssign && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1.5"
                    onClick={handleNewDocument}
                  >
                    <Plus className="size-3.5" />
                    Adjuntar
                  </Button>
                )}
              </div>
              <ul className="mt-3 space-y-2">
                {(incident.documents?.length ?? 0) === 0 && (
                  <li className="text-sm text-muted-foreground">
                    Todavía no hay documentos adjuntos.
                  </li>
                )}
                {incident.documents?.map((doc) => (
                  <li
                    key={doc._id}
                    className="flex items-start gap-2 rounded-lg border border-border/60 bg-background/60 p-3 text-sm"
                  >
                    <FileText className="mt-0.5 shrink-0 size-4 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{doc.name}</p>
                      {/* El enlace del documento con su aviso puesto: si el
                          archivo ya no está, o si la dirección pública de la API
                          no es la que alcanza el navegador, lo dice aquí en vez
                          de ofrecer un enlace que no lleva a ninguna parte. */}
                      <DocumentLink
                        url={doc.url}
                        name={doc.name}
                        icon={<FileDown className="size-3.5" />}
                        className="mt-0.5"
                      />
                      {doc.note && (
                        <RichText
                          value={doc.note}
                          className="mt-0.5 text-xs leading-5 text-muted-foreground"
                        />
                      )}
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {doc.author && <>{doc.author} · </>}
                        Añadido {formatDateTime(doc.createdAt)}
                      </p>
                      {/* Corregir —nombre, nota o archivo— o retirar del
                          expediente: los dos cambios quedan firmados en el
                          rastro de abajo. */}
                      {canAssign && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1.5 px-2"
                            onClick={() =>
                              handleEditDocument(doc._id, doc.name, doc.note)
                            }
                          >
                            <Pencil className="size-3.5" />
                            Corregir
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1.5 px-2 text-destructive hover:text-destructive"
                            onClick={() => setDeletingDocumentId(doc._id)}
                          >
                            <Trash2 className="size-3.5" />
                            Quitar
                          </Button>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              {/* Auditoría del expediente: quién movió cada documento y cuándo.
                  Un adjunto retirado ya no está arriba, pero aquí se ve. */}
              {canAssign && (
                <Collapsible className="mt-3 border-t border-border/70 pt-3">
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <ChevronDown className="size-3.5" />
                      Rastro de cambios
                      {trail && ` (${trail.length})`}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <ol className="mt-2 space-y-2">
                      {trail && trail.length === 0 && (
                        <li className="text-xs text-muted-foreground">
                          Sin cambios: ningún documento se ha movido en este
                          expediente.
                        </li>
                      )}
                      {trail?.map((entry) => (
                        <li
                          key={entry._id}
                          className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-xs"
                        >
                          <p className="text-foreground">
                            {documentTrailLabel(entry)}
                          </p>
                          <p className="mt-0.5 text-muted-foreground">
                            {entry.by} · {formatDateTime(entry.at)}
                          </p>
                        </li>
                      ))}
                    </ol>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          )}

          {/* Las notas son el cuaderno de quien repara: las escribe también el
              técnico asignado, no solo el coordinador (los adjuntos no). */}
          {(canWork || liveNotes(incident.lifecycleNotes).length > 0) && (
            <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Notas a lo largo del ciclo de vida
                </p>
                {canWork && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1.5"
                    onClick={handleNewNote}
                  >
                    <Pen className="size-3.5" />
                    Nueva nota
                  </Button>
                )}
              </div>
              <ul className="mt-3 space-y-3">
                {liveNotes(incident.lifecycleNotes).length === 0 && (
                  <li className="text-sm text-muted-foreground">
                    Todavía no hay notas en el ciclo de vida.
                  </li>
                )}
                {liveNotes(incident.lifecycleNotes).map((entry, index) => {
                  // La firma y el plazo, no el rol ni la asignación, deciden
                  // quién puede tocar la nota. El backend lo comprueba igual.
                  const noteId = entry.id;
                  const writtenAt = entry.createdAt ?? entry.at;
                  const canEdit =
                    currentUserId !== null &&
                    entry.authorId === currentUserId &&
                    isNoteWithinEditWindow(writtenAt);
                  const restoration = noteRestoration(entry);
                  return (
                    <li
                      key={noteId ?? `${entry.author}-${entry.at}-${index}`}
                      className="flex gap-2 rounded-lg border border-border/60 bg-background/60 p-3 text-sm"
                    >
                      <Pen className="mt-0.5 shrink-0 size-4 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <RichText
                          value={entry.note}
                          className="text-foreground"
                        />
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {entry.author} · {formatDateTime(entry.at)}
                          {entry.editedAt
                            ? restoration && restoration.at === entry.editedAt
                              ? ` · restaurada por ${restoration.by} el ${formatDateTime(
                                  restoration.at,
                                )}`
                              : ` · corregida ${formatDateTime(entry.editedAt)}`
                            : ""}
                        </p>
                        {canEdit && noteId && (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1.5 px-2"
                              onClick={() => handleEditNote(noteId, entry.note)}
                            >
                              <Pencil className="size-3.5" />
                              Editar
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1.5 px-2 text-destructive hover:text-destructive"
                              onClick={() => setDeletingNoteId(noteId)}
                            >
                              <Trash2 className="size-3.5" />
                              Borrar
                            </Button>
                            <span className="text-xs text-muted-foreground">
                              Se puede corregir hasta las{" "}
                              {formatClockTime(noteEditDeadline(writtenAt))}
                            </span>
                          </div>
                        )}
                        {/* Lo que la nota decía antes de cada corrección, y
                            desde donde se vuelve a una de esas versiones. */}
                        <NoteHistory
                          entry={entry}
                          canRestore={canEdit}
                          restoringVersion={restoringVersionAt}
                          onRestore={
                            noteId
                              ? (versionIndex) =>
                                  void handleRestoreVersion(
                                    noteId,
                                    versionIndex,
                                  )
                              : undefined
                          }
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* Retirar una nota no la borra: esperan aquí, tal y como
                  estaban, a que alguien las devuelva al cuaderno. */}
              {restorableNotes.length > 0 && (
                <Collapsible className="mt-3 border-t border-border/60 pt-3">
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <ChevronDown className="size-3.5" />
                      Notas retiradas ({restorableNotes.length})
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      Una nota retirada no se pierde: vuelve al cuaderno tal y
                      como estaba, en su sitio y con su firma, cuando se
                      recupera.
                    </p>
                    <ul className="mt-2 space-y-2">
                      {restorableNotes.map((entry, index) => {
                        const noteId = entry.id;
                        return (
                          <li
                            key={
                              noteId ??
                              `retirada-${entry.author}-${entry.at}-${index}`
                            }
                            className="rounded-lg border border-dashed border-border/70 bg-muted/30 p-3 text-sm"
                          >
                            <RichText
                              value={entry.note}
                              className="text-muted-foreground"
                            />
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {entry.author} · {formatDateTime(entry.at)}
                              {entry.deletedAt !== undefined
                                ? ` · retirada por ${entry.deletedBy ?? "—"} el ${formatDateTime(entry.deletedAt)}`
                                : ""}
                            </p>
                            {/* Retirada, pero con su historial intacto. */}
                            <NoteHistory entry={entry} />
                            {noteId && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="mt-2 h-7 gap-1.5 px-2"
                                disabled={restoringNoteId === noteId}
                                onClick={() => void handleRestoreNote(noteId)}
                              >
                                <Undo2 className="size-3.5" />
                                Recuperar
                              </Button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-border/70 bg-background/80 px-4 py-4 sm:px-6">
          {blocked.length > 0 && (
            <BlockedSteps
              groups={blocked.map((group) => ({
                label: group.actions
                  .map((action) => INCIDENT_STEP_LABELS[action])
                  .join(", "),
                reason: group.reason,
              }))}
            />
          )}
          <div className="mt-2 flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={trailPending || preparingPdf}
              title={
                trailPending
                  ? "Cargando el rastro de auditoría…"
                  : `Descarga el parte de ${incident.reference} en Markdown, para leerlo o editarlo`
              }
              onClick={handleDownloadReport}
            >
              <FileDown className="size-4" />
              Descargar Markdown
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={trailPending || preparingPdf || preparingPackage}
              title={
                trailPending
                  ? "Cargando el rastro de auditoría…"
                  : `Descarga el parte de ${incident.reference} en PDF, listo para entregar`
              }
              onClick={() => void handleDownloadReportPdf()}
            >
              <FileDown className="size-4" />
              {preparingPdf ? "Preparando PDF…" : "Descargar PDF"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={trailPending || preparingPdf || preparingPackage}
              title={
                trailPending
                  ? "Cargando el rastro de auditoría…"
                  : `Descarga el parte de ${incident.reference} con sus fotos dentro, en un ZIP que se abre sin conexión`
              }
              onClick={() => void handleDownloadReportPackage()}
            >
              <FileDown className="size-4" />
              {preparingPackage ? "Preparando paquete…" : "Descargar ZIP"}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cerrar
            </Button>

            {canAdvanceIncident(incident.status, "selfAssign") && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={handleSelfAssign}
                  disabled={busy || !currentUserId}
                >
                  <UserPlus className="size-4" />
                  Autoasignarme
                </Button>
                {canAssign && (
                  <Button
                    type="button"
                    className="gap-2"
                    onClick={() => setAssignTarget("assign")}
                  >
                    <UserPlus className="size-4" />
                    Asignar a un técnico
                  </Button>
                )}
              </>
            )}

            {canAdvanceIncident(incident.status, "verifyWorkshop") &&
              canWork && (
                <>
                  {canAssign && (
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      onClick={() => setAssignTarget("assign")}
                    >
                      <UserPlus className="size-4" />
                      Reasignar
                    </Button>
                  )}
                  <Button
                    type="button"
                    className="gap-2"
                    onClick={() => setVerifyOpen(true)}
                  >
                    <Check className="size-4" />
                    Verificar incidencia
                  </Button>
                </>
              )}

            {isClosedIncident(incident.status) && canAssign && (
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={busy}
                onClick={() => void handleArchive()}
              >
                <Archive className="size-4" />
                Archivar
              </Button>
            )}

            {/* Retirar: para el aviso equivocado o el duplicado. No borra —eso
                sería irreversible—, deja la incidencia en la papelera unos
                días, con el mismo plazo que lo retirado del almacén. */}
            {canAssign && (
              <Button
                type="button"
                variant="outline"
                className="gap-2 text-destructive hover:text-destructive"
                disabled={busy}
                onClick={() => setWithdrawOpen(true)}
                title="Se guarda unos días en la papelera antes de borrarse de verdad"
              >
                <Trash2 className="size-4" />
                Retirar
              </Button>
            )}

            {canAdvanceIncident(incident.status, "closeResolved") &&
              canWork && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() => setRequestOpen(true)}
                  >
                    <PackagePlus className="size-4" />
                    Petición de repuestos
                  </Button>
                  {canAssign && (
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      onClick={() => setAssignTarget("workshop")}
                    >
                      <UserPlus className="size-4" />
                      Asignar orden
                    </Button>
                  )}
                  <Button
                    type="button"
                    className="gap-2"
                    onClick={() => setCloseOpen(true)}
                  >
                    <Wrench className="size-4" />
                    Finalizar trabajo
                  </Button>
                </>
              )}
          </div>
          {!canWork && !canAdvanceIncident(incident.status, "selfAssign") && (
            <p className="mt-2 text-right text-xs text-muted-foreground">
              Solo el técnico asignado o el coordinador pueden actuar sobre esta
              incidencia.
            </p>
          )}
        </div>

        {assignTarget && (
          <AssignDialog
            incident={incident}
            mode={assignTarget}
            onClose={() => setAssignTarget(null)}
          />
        )}
        {verifyOpen && (
          <VerifyDialog
            incident={incident}
            equipment={equipment}
            onClose={() => setVerifyOpen(false)}
          />
        )}
        {closeOpen && (
          <CloseDialog
            incident={incident}
            equipment={equipment}
            onClose={() => setCloseOpen(false)}
          />
        )}
        {requestOpen && (
          <IncidentRequestDialog
            incident={incident}
            currentUserName={currentUserName}
            onClose={() => setRequestOpen(false)}
          />
        )}
        {equipmentOpen && (
          <CorrectEquipmentDialog
            incident={incident}
            onClose={() => setEquipmentOpen(false)}
          />
        )}
        {createEquipmentOpen && (
          <EquipmentFormDialog
            item={null}
            initialValues={{
              model: incident.model,
              serialNumber: incident.serialNumber,
              location: incident.location,
            }}
            onSuccess={async (createdId) => {
              try {
                await updateEquipment({
                  incidentId: incident._id,
                  equipmentId: createdId,
                  model: incident.model,
                  serialNumber: incident.serialNumber,
                });
                toast.success(
                  `Equipo vinculado a la incidencia ${incident.reference}`,
                );
              } catch (err) {
                toast.error(getErrorMessage(err));
              }
            }}
            onClose={() => setCreateEquipmentOpen(false)}
          />
        )}

        {documentsOpen && (
          <Dialog open onOpenChange={(open) => !open && handleCloseDocument()}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingDocumentId
                    ? "Corregir documento"
                    : "Adjuntar documento"}
                </DialogTitle>
                <DialogDescription>
                  {editingDocumentId
                    ? `Cambias el nombre, la nota o el archivo de un documento de ${incident.reference}. Si reemplazas el archivo, el anterior se borra; el rastro de cambios guarda quién lo corrigió y cuándo.`
                    : `Elige el archivo y adjúntalo a ${incident.reference}: se sube al servidor y queda enlazado al expediente, con la nota que escribas.`}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="doc-name">Nombre del documento</Label>
                  <Input
                    id="doc-name"
                    value={documentName}
                    onChange={(event) => setDocumentName(event.target.value)}
                    placeholder="p. ej. Reporte técnico.pdf"
                    disabled={savingDoc}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="doc-file">
                    {editingDocument?.storageId
                      ? "Reemplazar el archivo"
                      : "Archivo"}
                  </Label>
                  {/* El archivo que ya tiene el documento se enseña antes de
                      elegir otro: reemplazarlo es una decisión, no un añadido.
                      Y con el mismo enlace avisado que en la ficha: si su
                      dirección no lleva a ninguna parte, se dice aquí. */}
                  {editingDocument?.storageId && !documentFile && (
                    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-sm">
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">
                        Archivo actual
                      </span>
                      <DocumentLink
                        url={editingDocument.url}
                        name={editingDocument.name}
                        className="shrink-0"
                      />
                    </div>
                  )}
                  <input
                    ref={documentFileInputRef}
                    id="doc-file"
                    type="file"
                    accept={FILE_ACCEPT}
                    className="hidden"
                    onChange={(event) => {
                      void handleDocumentFileChosen(event.target.files);
                      event.target.value = "";
                    }}
                  />
                  {documentFile ? (
                    <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-sm">
                      <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">
                        {documentFile.name}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {Math.max(1, Math.round(documentFile.size / 1024))} KB
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label="Descartar el archivo elegido"
                        disabled={savingDoc}
                        onClick={() => setDocumentFile(null)}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="justify-start gap-2"
                      disabled={savingDoc}
                      onClick={() => documentFileInputRef.current?.click()}
                    >
                      <Upload className="size-4" />
                      {editingDocument?.storageId
                        ? "Elegir el archivo nuevo"
                        : "Elegir archivo"}
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {editingDocument?.storageId
                      ? `Imágenes, PDF o documentos de oficina, máximo ${MAX_FILE_SIZE_LABEL}. Al guardar, el archivo anterior se borra del servidor y el cambio queda firmado en el rastro.`
                      : `Imágenes, PDF o documentos de oficina. Máximo ${MAX_FILE_SIZE_LABEL} por archivo; el archivo se sube y queda guardado con el expediente.`}
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="doc-note">Nota</Label>
                  <RichTextEditor
                    id="doc-note"
                    value={documentNote}
                    onChange={setDocumentNote}
                    placeholder="p. ej. Foto del daño antes de la reparación"
                    disabled={savingDoc}
                  />
                </div>
              </div>

              {(documentName.trim() || documentFile) && (
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCloseDocument}
                    disabled={savingDoc}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSaveDocument}
                    disabled={
                      savingDoc || (!documentName.trim() && !documentFile)
                    }
                  >
                    {savingDoc
                      ? documentFile
                        ? "Subiendo..."
                        : "Guardando..."
                      : editingDocumentId
                        ? "Guardar cambios"
                        : "Adjuntar"}
                  </Button>
                </DialogFooter>
              )}
            </DialogContent>
          </Dialog>
        )}

        {deletingDocument && (
          <AlertDialog
            open
            onOpenChange={(open) => {
              if (!open && !removingDoc) setDeletingDocumentId(null);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  ¿Quitar «{deletingDocument.name}» del expediente?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Dejará de estar en la ficha de {incident.reference}. El rastro
                  de cambios conserva quién lo quitó, cuándo y con qué nombre
                  estaba.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={removingDoc}>
                  Cancelar
                </AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-white hover:bg-destructive/90"
                  disabled={removingDoc}
                  onClick={(event) => {
                    event.preventDefault();
                    void handleRemoveDocument();
                  }}
                >
                  {removingDoc ? "Quitando..." : "Quitar documento"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {notesOpen && (
          <Dialog open onOpenChange={(open) => !open && handleCloseNote()}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingNoteId ? "Corregir nota" : "Añadir nota"}
                </DialogTitle>
                <DialogDescription>
                  {editingNoteId
                    ? `Corriges una nota de ${incident.reference}. La fecha del hilo y el lugar que ocupa en el cuaderno no cambian.`
                    : `Añade una nota a ${incident.reference}. Queda registrada con tu nombre y la fecha actual.`}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="note-input">Nota</Label>
                  <RichTextEditor
                    id="note-input"
                    value={note}
                    onChange={setNote}
                    placeholder="p. ej. Diagnóstico en curso, se comprueba el cable..."
                    disabled={savingNote}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseNote}
                  disabled={savingNote}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveNote}
                  disabled={savingNote || richDocIsEmpty(note)}
                >
                  {savingNote
                    ? "Guardando..."
                    : editingNoteId
                      ? "Guardar cambios"
                      : "Añadir nota"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {deletingNoteId && (
          <AlertDialog
            open
            onOpenChange={(open) => {
              if (!open && !removingNote) setDeletingNoteId(null);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Retirar la nota?</AlertDialogTitle>
                <AlertDialogDescription>
                  Sale del cuaderno de {incident.reference}, pero no se pierde:
                  podrás recuperarla desde la propia ficha si te has equivocado.
                  El resto de notas y el historial de estados no cambian.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={removingNote}>
                  Cancelar
                </AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-white hover:bg-destructive/90"
                  disabled={removingNote}
                  onClick={(event) => {
                    event.preventDefault();
                    void handleRemoveNote();
                  }}
                >
                  {removingNote ? "Retirando..." : "Retirar nota"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* La confirmación de la retirada: es lo que evita que un aviso bueno se
            vaya por pulsar donde no era, y lo que apunta por qué se retira. */}
        <AlertDialog
          open={withdrawOpen}
          onOpenChange={(open) => {
            if (!open) {
              setWithdrawOpen(false);
              setWithdrawReason("");
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                ¿Retirar {incident.reference}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Sale de la cola, y el código con el que la seguía quien notificó
                deja de contar el caso: es para el aviso equivocado o el
                duplicado de otra. No se borra ahora: queda en la papelera —en
                el módulo Archivo— el plazo que tenga ajustado el taller, y
                desde ahí se recupera tal y como está, con su expediente y sus
                notas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="grid gap-2">
              <Label htmlFor="incidencia-retirar-motivo">
                Por qué se retira (opcional)
              </Label>
              <Input
                id="incidencia-retirar-motivo"
                value={withdrawReason}
                onChange={(event) => setWithdrawReason(event.target.value)}
                placeholder="Duplicada, aviso equivocado…"
                maxLength={160}
                disabled={busy}
              />
              <p className="text-xs text-muted-foreground">
                Se apunta en la papelera, para saber de un vistazo por qué está
                ahí.
              </p>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                disabled={busy}
                className="gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={(event) => {
                  event.preventDefault();
                  void handleWithdraw();
                }}
              >
                <Trash2 className="size-4" />
                {busy ? "Retirando..." : "Retirar a la papelera"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}
