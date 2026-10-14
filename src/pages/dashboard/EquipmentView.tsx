import { Badge } from "@/components/ui/badge";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RichText } from "@/components/RichText";
import { RichTextEditor } from "@/components/RichTextEditor";
import { ListArea } from "@/components/ListArea";
import { TablePagination } from "@/components/TablePagination";
import { SortableTableHead, TableSortBar } from "@/components/TableSort";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  equipmentRecord,
  equipmentRecordPdfFilename,
} from "@/lib/equipmentRecord";
import { downloadPdf, loadPdfImage } from "@/lib/pdfBrowser";
import { reportToPdf } from "@/lib/reportPdf";
import {
  MANUAL_KIND_META,
  canDeleteManual,
  canEditManual,
  manualFileName,
  manualsForEquipment,
  type ManualRights,
} from "@/lib/manuals";
import { richDocToStore } from "@/lib/richDoc";
import { sortRows } from "@/lib/tableSort";
import { useRowsThatFit } from "@/hooks/use-rows-that-fit";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { useTableSort } from "@/hooks/use-table-sort";
import { cn } from "@/lib/utils";
import {
  MAINTENANCE_META,
  PRIORITY_META,
  STATUS_META,
  STOCK_META,
  equipmentLabel,
  formatDate,
  formatRelativeTime,
  getErrorMessage,
  nextReview,
  requestMatchesEquipment,
  stockState,
  type MaintenanceKind,
} from "@/lib/workshop";
import { useMutation, useQuery } from "convex/react";
import { ManualDeleteDialog } from "./ManualDeleteDialog";
import { ManualDetailSheet } from "./ManualDetailSheet";
import { ManualFormDialog } from "./ManualFormDialog";
import type { ManualDoc } from "./ManualsView";
import {
  BookOpen,
  Boxes,
  ClipboardList,
  Cpu,
  Download,
  Eye,
  FileDown,
  Pencil,
  Plus,
  Search,
  Trash2,
  Wrench,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

type EquipmentDoc = Doc<"equipment">;
type RecordDoc = Doc<"maintenanceRecords">;

export function EquipmentView({
  canManage = false,
  canWriteManuals = false,
  canManageManuals = false,
  currentUserId = null,
  onViewRequests = () => {},
  initialSearch = "",
}: {
  /** Solo responsable de repuestos/admin escriben en el inventario (fail-closed). */
  canManage?: boolean;
  /** Puede escribir notas del taller desde la ficha del equipo. */
  canWriteManuals?: boolean;
  /** Puede subir archivos y gestionar los manuales (responsable/admin). */
  canManageManuals?: boolean;
  /** Quién mira: es lo que permite corregir su propia nota del taller. */
  currentUserId?: string | null;
  /** Lleva a la cola de peticiones filtrada por este equipo. */
  onViewRequests?: (equipmentId: string) => void;
  /** Texto con el que se abre la vista (viene de la búsqueda global). */
  initialSearch?: string;
}) {
  // La ficha del equipo carga lo suyo: el inventario, el catálogo (para los
  // repuestos compatibles), las peticiones —con las archivadas, porque la ficha
  // las sigue citando—, el historial de mantenimiento y los manuales del equipo
  // y de su modelo. Se pide al abrir la ficha, no al entrar al panel.
  const equipment = useQuery(api.equipment.list, {}) ?? [];
  const parts = useQuery(api.spareParts.list) ?? [];
  const requests =
    useQuery(api.partRequests.list, { includeArchived: true }) ?? [];
  const maintenance = useQuery(api.maintenance.list) ?? [];
  const manuals = useQuery(api.manuals.list) ?? [];
  const removeEquipment = useMutation(api.equipment.remove);

  /** Intervenciones registradas para un equipo del inventario. */
  const recordsFor = (item: EquipmentDoc) =>
    maintenance.filter((record) => record.equipmentId === item._id);

  const [search, setSearch] = useState(initialSearch);
  // `openedAt` congela el instante al abrir el detalle (la comparación de
  // garantía no se recalcula en cada render: el render queda puro).
  const [detail, setDetail] = useState<{
    item: EquipmentDoc;
    openedAt: number;
  } | null>(null);
  const [formTarget, setFormTarget] = useState<{
    item: EquipmentDoc | null;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EquipmentDoc | null>(null);
  // El formulario de un manual abierto desde aquí: el que se corrige o el que
  // nace asignado a un equipo (`equipmentId`).
  const [manualForm, setManualForm] = useState<{
    manual: ManualDoc | null;
    equipmentId: string | null;
  } | null>(null);
  // La ficha de un manual, abierta encima de la del equipo sin salir de ella.
  const [manualDetail, setManualDetail] = useState<ManualDoc | null>(null);
  const [manualDelete, setManualDelete] = useState<ManualDoc | null>(null);

  /** Añadir un manual: la nota la escribe cualquiera que consulte; el archivo,
   * quien gestiona el módulo (lo decide el formulario). */
  const canAddManual = canWriteManuals || canManageManuals;

  /** Qué puede hacer quien mira con los manuales que ve: corregir y retirar. */
  const rights: ManualRights = {
    manage: canManageManuals,
    userId: currentUserId,
  };

  const query = search.trim().toLowerCase();
  const filtered = equipment.filter((item) => {
    if (!query) return true;
    return [
      item.code ?? "",
      item.brand ?? "",
      item.name,
      item.model,
      item.location ?? "",
      item.serialNumber ?? "",
      item.supplier ?? "",
    ].some((value) => value.toLowerCase().includes(query));
  });

  const compatibleCount = (item: EquipmentDoc) =>
    parts.filter((part) => part.compatibleWith?.includes(item._id)).length;

  const reviewOf = (item: EquipmentDoc) =>
    nextReview(
      recordsFor(item),
      item.maintenanceIntervalDays,
      item.purchaseDate,
    );

  /** Los manuales que le tocan a un equipo: los suyos y los de su modelo. */
  const manualsOf = (item: EquipmentDoc) => manualsForEquipment(manuals, item);

  /**
   * Las columnas que se pueden ordenar: la etiqueta que enseña la cabecera y de
   * dónde sale lo que ordena esa columna. Van después de los ayudantes que usan
   * —`manualsOf`, `compatibleCount`—: al ordenar se les llama en el mismo pase
   * del render, así que tienen que estar ya declarados.
   */
  const columns = {
    equipment: {
      label: "Equipo",
      value: (item: EquipmentDoc) => equipmentLabel(item),
    },
    brand: { label: "Marca", value: (item: EquipmentDoc) => item.brand ?? "" },
    serial: {
      label: "Nº de serie",
      value: (item: EquipmentDoc) => item.serialNumber ?? "",
    },
    location: {
      label: "Ubicación",
      value: (item: EquipmentDoc) => item.location ?? "",
    },
    manuals: {
      label: "Manuales",
      value: (item: EquipmentDoc) => {
        const docs = manualsOf(item);
        return docs.assigned.length + docs.byModel.length;
      },
    },
    parts: {
      label: "Repuestos compatibles",
      value: (item: EquipmentDoc) => compatibleCount(item),
    },
  } as const;

  // El orden que elige quien mira, y que se recuerda para su próxima visita: sin
  // nada elegido, la tabla se queda como llega del servidor (por modelo).
  const [sort, setSort] = useTableSort({
    table: "equipment",
    columns,
    userId: currentUserId,
  });
  const rows = sortRows(
    filtered,
    (item, column) => columns[column].value(item),
    sort,
  );

  // El área de la tabla, para contar las filas que caben en su alto, y la lista
  // partida en páginas con esas filas: sin paginar, el pie con el recuento queda
  // a dos pantallas de la primera fila. La búsqueda forma parte de la firma, así
  // que buscar vuelve a la primera página.
  const { areaRef, rowsFit } = useRowsThatFit();
  const paging = useTablePagination({
    total: rows.length,
    rowsFit,
    resetKey: search,
  });
  const visible = rows.slice(paging.from - 1, paging.to);

  const handleDelete = async (item: EquipmentDoc) => {
    try {
      await removeEquipment({ id: item._id });
      toast.success(`${equipmentLabel(item)} borrado del inventario`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-border/70 bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border/70 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por marca, modelo o nº de serie..."
              className="pl-9"
              aria-label="Buscar equipo"
            />
          </div>
          {canManage && (
            <Button
              type="button"
              className="gap-2"
              onClick={() => setFormTarget({ item: null })}
            >
              <Plus className="size-4" />
              Nuevo equipo
            </Button>
          )}
        </div>

        {equipment.length === 0 ? (
          <div className="p-10 text-center">
            <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-signal/10 text-signal">
              <Cpu className="size-5" />
            </span>
            <p className="mt-4 text-base font-semibold tracking-tight">
              El inventario de equipos está vacío
            </p>
            <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
              Da de alta los equipos del taller para que los técnicos puedan
              elegirlos en sus peticiones y filtrar los repuestos por equipo.
            </p>
            {canManage && (
              <Button
                type="button"
                className="mt-5 gap-2"
                onClick={() => setFormTarget({ item: null })}
              >
                <Plus className="size-4" />
                Nuevo equipo
              </Button>
            )}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-base font-semibold tracking-tight">
              Sin resultados
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
              Ningún equipo coincide con «{search}».
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              onClick={() => setSearch("")}
            >
              Limpiar búsqueda
            </Button>
          </div>
        ) : (
          <>
            <TableSortBar
              columns={columns}
              sort={sort}
              onSortChange={setSort}
            />
            <ListArea ref={areaRef} resetKey={paging.page}>
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <SortableTableHead
                      column="equipment"
                      label="Equipo"
                      sort={sort}
                      onSortChange={setSort}
                    />
                    <SortableTableHead
                      column="brand"
                      label="Marca"
                      sort={sort}
                      onSortChange={setSort}
                      className="hidden md:table-cell"
                    />
                    <SortableTableHead
                      column="serial"
                      label="Nº de serie"
                      sort={sort}
                      onSortChange={setSort}
                      className="hidden xl:table-cell"
                    />
                    <SortableTableHead
                      column="location"
                      label="Ubicación"
                      sort={sort}
                      onSortChange={setSort}
                      className="hidden lg:table-cell"
                    />
                    <SortableTableHead
                      column="manuals"
                      label="Manuales"
                      sort={sort}
                      onSortChange={setSort}
                      align="right"
                      className="text-right"
                    />
                    <SortableTableHead
                      column="parts"
                      label="Repuestos compatibles"
                      sort={sort}
                      onSortChange={setSort}
                      align="right"
                      className="text-right"
                    />
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((item) => {
                    const review = reviewOf(item);
                    const docs = manualsOf(item);
                    const manualCount =
                      docs.assigned.length + docs.byModel.length;
                    return (
                      <TableRow key={item._id} className="hover:bg-muted/40">
                        <TableCell className="max-w-[18rem]">
                          <span className="block font-mono text-xs text-muted-foreground">
                            {item.code}
                          </span>
                          <span className="block truncate font-medium">
                            {equipmentLabel(item)}
                          </span>
                          {review.state === "overdue" && (
                            <span className="block text-xs font-medium text-amber-700">
                              Revisión preventiva vencida
                            </span>
                          )}
                          {item.location && (
                            <span className="block text-xs text-muted-foreground lg:hidden">
                              {item.location}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {item.brand ?? "—"}
                        </TableCell>
                        <TableCell className="hidden xl:table-cell font-mono text-xs text-muted-foreground">
                          {item.serialNumber ?? "—"}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell font-mono text-xs text-muted-foreground">
                          {item.location ?? "—"}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1",
                              manualCount === 0 && "text-muted-foreground",
                            )}
                            title={
                              manualCount === 0
                                ? "Sin manuales: ni asignados ni de este modelo"
                                : `${docs.assigned.length} asignados y ${docs.byModel.length} del modelo`
                            }
                          >
                            <BookOpen className="size-3.5" />
                            {manualCount}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {compatibleCount(item)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={() =>
                                setDetail({ item, openedAt: Date.now() })
                              }
                              aria-label={`Ver detalle de ${item.model}`}
                            >
                              <Eye className="size-4" />
                            </Button>
                            {canManage && (
                              <>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-8"
                                  onClick={() => setFormTarget({ item })}
                                  aria-label={`Editar ${item.model}`}
                                >
                                  <Pencil className="size-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 text-muted-foreground hover:text-destructive"
                                  onClick={() => setDeleteTarget(item)}
                                  aria-label={`Borrar ${item.model}`}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ListArea>
          </>
        )}

        {filtered.length > 0 && (
          <TablePagination
            paging={paging}
            singular="equipo"
            plural="equipos"
            detail={
              filtered.length < equipment.length
                ? `${equipment.length} en el inventario`
                : undefined
            }
          />
        )}
      </div>

      {detail && (
        <EquipmentDetailSheet
          item={detail.item}
          openedAt={detail.openedAt}
          parts={parts}
          requests={requests}
          maintenance={recordsFor(detail.item)}
          manuals={manualsOf(detail.item)}
          canManage={canManage}
          canAddManual={canAddManual}
          rights={rights}
          onAddManual={(item) =>
            setManualForm({ manual: null, equipmentId: item._id })
          }
          onViewManual={setManualDetail}
          onEditManual={(manual) =>
            setManualForm({ manual, equipmentId: null })
          }
          onDeleteManual={setManualDelete}
          onClose={() => setDetail(null)}
          onViewRequests={(equipmentId) => {
            setDetail(null);
            onViewRequests(equipmentId);
          }}
        >
          {/* Los diálogos de manual se abren desde esta ficha, así que viven
              dentro de su contenido: Radix solo da por «dentro» lo que está en
              el árbol de React de la ficha, y desde fuera un clic en ellos
              cerraría la ficha del equipo. */}
          {manualDetail && (
            <ManualDetailSheet
              manual={manualDetail}
              equipment={equipment}
              onClose={() => setManualDetail(null)}
            />
          )}

          {manualForm && (
            <ManualFormDialog
              key={manualForm.manual?._id ?? `manual-${manualForm.equipmentId}`}
              manual={manualForm.manual}
              equipment={equipment}
              canManage={canManageManuals}
              fixedEquipmentId={manualForm.equipmentId}
              onClose={() => setManualForm(null)}
            />
          )}

          {manualDelete && (
            <ManualDeleteDialog
              manual={manualDelete}
              onClose={() => setManualDelete(null)}
              onDeleted={() => setManualDetail(null)}
            />
          )}
        </EquipmentDetailSheet>
      )}

      {formTarget && (
        <EquipmentFormDialog
          key={formTarget.item?._id ?? "new"}
          item={formTarget.item}
          onClose={() => setFormTarget(null)}
        />
      )}

      {deleteTarget && (
        <AlertDialog
          open
          onOpenChange={(open) => !open && setDeleteTarget(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                ¿Borrar {equipmentLabel(deleteTarget)}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Se borrará del inventario. Las peticiones que lo mencionen
                conservan su texto, pero dejarán de estar vinculadas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-white hover:bg-destructive/90"
                onClick={() => handleDelete(deleteTarget)}
              >
                Borrar equipo
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Alta / edición de equipo                                            */
/* ------------------------------------------------------------------ */

/** Timestamp → valor de <input type="date"> (AAAA-MM-DD en hora local). */
function dateToInput(timestamp?: number): string {
  if (timestamp === undefined) return "";
  const d = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Valor de <input type="date"> → timestamp (medianoche local). */
function inputToDate(value: string): number | undefined {
  return value ? new Date(`${value}T00:00:00`).getTime() : undefined;
}

function EquipmentFormDialog({
  item,
  onClose,
}: {
  item: EquipmentDoc | null;
  onClose: () => void;
}) {
  const create = useMutation(api.equipment.create);
  const update = useMutation(api.equipment.update);

  const isEdit = item !== null;
  const [code, setCode] = useState(item?.code ?? "");
  const [brand, setBrand] = useState(item?.brand ?? "");
  const [name, setName] = useState(item?.name ?? "");
  const [model, setModel] = useState(item?.model ?? "");
  const [location, setLocation] = useState(item?.location ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [serialNumber, setSerialNumber] = useState(item?.serialNumber ?? "");
  const [supplier, setSupplier] = useState(item?.supplier ?? "");
  const [purchaseDate, setPurchaseDate] = useState(
    dateToInput(item?.purchaseDate),
  );
  const [warrantyEndDate, setWarrantyEndDate] = useState(
    dateToInput(item?.warrantyEndDate),
  );
  const [decommissionDate, setDecommissionDate] = useState(
    dateToInput(item?.decommissionDate),
  );
  const [intervalDays, setIntervalDays] = useState(
    item?.maintenanceIntervalDays !== undefined
      ? String(item.maintenanceIntervalDays)
      : "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!code.trim()) {
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
        code: code.trim(),
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
        await create(payload);
        toast.success(`${payload.model} añadido al inventario`);
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
            <Label htmlFor="eq-code">Código *</Label>
            <Input
              id="eq-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="EQ-007"
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
            <Label htmlFor="eq-model">Modelo *</Label>
            <Input
              id="eq-model"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder="HDC-3500"
              className="font-mono"
              disabled={busy}
            />
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

/* ------------------------------------------------------------------ */
/* Detalle del equipo: referencias compatibles y sus peticiones        */
/* ------------------------------------------------------------------ */

/**
 * Un manual en la ficha del equipo: su forma (archivo o nota), su tipo y el
 * enlace para abrirlo. La nota del taller se despliega ahí mismo, sin salir de
 * la ficha.
 */
function ManualRow({
  manual,
  assigned,
  rights,
  onView,
  onEdit,
  onDelete,
}: {
  manual: ManualDoc;
  assigned: boolean;
  /** Qué puede hacer quien mira: la ficha se abre siempre, lo demás no. */
  rights: ManualRights;
  onView: (manual: ManualDoc) => void;
  onEdit: (manual: ManualDoc) => void;
  onDelete: (manual: ManualDoc) => void;
}) {
  const meta = MANUAL_KIND_META[manual.kind];
  return (
    <li className="py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className={meta.badgeClassName}>
              {meta.label}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {manual.type} · {assigned ? "de este equipo" : "del modelo"}
            </span>
          </div>
          <p className="mt-1 text-sm font-medium">{manual.title}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={`Abrir la ficha de ${manual.title}`}
            title="Ver la ficha del manual"
            onClick={() => onView(manual)}
          >
            <Eye className="size-4" />
          </Button>
          {manual.kind === "file" && manual.url && (
            <Button asChild variant="ghost" size="icon" className="size-8">
              <a
                href={manual.url}
                target="_blank"
                rel="noreferrer"
                aria-label={`Abrir ${manual.title}`}
                title={`Abrir o descargar ${manualFileName(manual) ?? "el archivo"}`}
              >
                <Download className="size-4" />
              </a>
            </Button>
          )}
          {canEditManual(manual, rights) && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={`Editar ${manual.title}`}
              title="Corregir el manual"
              onClick={() => onEdit(manual)}
            >
              <Pencil className="size-4" />
            </Button>
          )}
          {canDeleteManual(manual, rights) && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-destructive"
              aria-label={`Borrar ${manual.title}`}
              title="Retirar el manual"
              onClick={() => onDelete(manual)}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </div>
      {manual.notes && (
        <details className="mt-1.5">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
            Ver la nota del taller
          </summary>
          <RichText value={manual.notes} className="mt-1 text-xs leading-5" />
        </details>
      )}
    </li>
  );
}

/**
 * La ficha de un equipo, con lo que se abre desde ella dentro: las
 * intervenciones y, por `children`, los diálogos de manual. Van dentro del
 * contenido a propósito —Radix solo considera «dentro de la ficha» lo que está
 * en su árbol de React—: si se pintaran fuera, cualquier clic en ellos cerraría
 * la ficha del equipo.
 */
function EquipmentDetailSheet({
  item,
  openedAt,
  parts,
  requests,
  maintenance = [],
  manuals = { assigned: [], byModel: [] },
  canManage = false,
  canAddManual = false,
  rights = { manage: false, userId: null },
  onAddManual = () => {},
  onViewManual = () => {},
  onEditManual = () => {},
  onDeleteManual = () => {},
  onClose,
  onViewRequests,
  children,
}: {
  item: EquipmentDoc;
  /** Instante en el que se abrió el detalle (para el estado de garantía). */
  openedAt: number;
  parts: Doc<"spareParts">[];
  requests: Doc<"partRequests">[];
  /** Historial propio de este equipo (opcional por tolerancia en caliente). */
  maintenance?: RecordDoc[];
  /** Manuales asignados al equipo y los de su marca y modelo (opcional). */
  manuals?: { assigned: ManualDoc[]; byModel: ManualDoc[] };
  /** Solo responsable/admin registran intervenciones (fail-closed). */
  canManage?: boolean;
  /** Puede añadir manuales al equipo desde aquí (consulta o gestión). */
  canAddManual?: boolean;
  /** Qué puede hacer quien mira con cada manual: corregirlo y retirarlo. */
  rights?: ManualRights;
  /** Abre el formulario del manual, con el equipo ya asignado. */
  onAddManual?: (item: EquipmentDoc) => void;
  /** Abre la ficha del manual sin salir de la del equipo. */
  onViewManual?: (manual: ManualDoc) => void;
  /** Corrige el manual en el mismo formulario que el módulo. */
  onEditManual?: (manual: ManualDoc) => void;
  /** Retira el manual, con su confirmación. */
  onDeleteManual?: (manual: ManualDoc) => void;
  onClose: () => void;
  onViewRequests: (equipmentId: string) => void;
  /** Los diálogos que se abren desde la ficha (manuales), dentro de su árbol. */
  children?: ReactNode;
}) {
  const removeRecord = useMutation(api.maintenance.remove);
  const [formTarget, setFormTarget] = useState<{
    record: RecordDoc | null;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RecordDoc | null>(null);
  const [exporting, setExporting] = useState(false);

  /**
   * Las peticiones de este equipo, con el mismo criterio que la ficha: el equipo
   * elegido del inventario y, si la petición no lo lleva, su modelo escrito a
   * mano. Se calcula aquí arriba porque el documento cita las mismas que se ven
   * en pantalla.
   */
  const related = requests.filter((request) =>
    requestMatchesEquipment(request, item),
  );

  /**
   * La ficha como documento: identificación, manuales, intervenciones y
   * peticiones. El PDF se compone aquí mismo, en el navegador, con lo que la
   * ficha tiene delante —no vuelve a consultar nada—, así que el papel dice lo
   * mismo que la pantalla.
   */
  const handleExport = async () => {
    setExporting(true);
    try {
      const bytes = await reportToPdf(
        equipmentRecord(item, {
          manuals,
          // Las peticiones se pasan tal cual: son las mismas que enseña la ficha
          // (referencia, estado, prioridad, solicitante, líneas y texto).
          requests: related,
          interventions: maintenance.map((record) => ({
            kind: record.kind,
            title: record.title,
            description: record.description,
            performedAt: record.performedAt,
            technician: record.technician,
            requestReference: record.requestId
              ? requests.find((request) => request._id === record.requestId)
                  ?.reference
              : undefined,
          })),
        }),
        {
          footer: `Ficha del equipo «${equipmentLabel(item)}» · Pulso Taller`,
          loadImage: loadPdfImage,
        },
      );
      downloadPdf(equipmentRecordPdfFilename(equipmentLabel(item)), bytes);
      toast.success("Ficha del equipo descargada en PDF");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  const compatible = parts.filter((part) =>
    part.compatibleWith?.includes(item._id),
  );
  const shownRequests = related.slice(0, 6);
  const review = nextReview(
    maintenance,
    item.maintenanceIntervalDays,
    item.purchaseDate,
  );
  const reviewBadge =
    review.state === "overdue" ? (
      <Badge
        variant="outline"
        className="border-amber-500/25 bg-amber-500/10 text-amber-700"
      >
        Revisión vencida
      </Badge>
    ) : review.state === "ok" ? (
      <Badge
        variant="outline"
        className="border-emerald-600/25 bg-emerald-600/10 text-emerald-700"
      >
        Revisión al día
      </Badge>
    ) : null;
  const warrantyBadge =
    item.warrantyEndDate === undefined ? null : item.warrantyEndDate >=
      openedAt ? (
      <Badge
        variant="outline"
        className="border-emerald-600/25 bg-emerald-600/10 text-emerald-700"
      >
        En garantía
      </Badge>
    ) : (
      <Badge
        variant="outline"
        className="border-amber-500/25 bg-amber-500/10 text-amber-700"
      >
        Garantía caducada
      </Badge>
    );

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold text-muted-foreground">
              {item.code}
            </span>
            {item.brand && (
              <Badge
                variant="outline"
                className="border-border bg-muted text-muted-foreground"
              >
                {item.brand}
              </Badge>
            )}
            {item.decommissionDate ? (
              <Badge
                variant="outline"
                className="border-border bg-muted text-muted-foreground"
              >
                De baja
              </Badge>
            ) : (
              warrantyBadge
            )}
            {reviewBadge}
            <Badge
              variant="outline"
              className="border-signal/25 bg-signal/10 text-signal"
            >
              {compatible.length}{" "}
              {compatible.length === 1 ? "repuesto" : "repuestos"}
            </Badge>
          </div>
          <SheetTitle className="text-xl tracking-tight">
            {equipmentLabel(item)}
          </SheetTitle>
          <SheetDescription>
            {item.location ? `Ubicación ${item.location}` : "Sin ubicación"} ·{" "}
            {related.length} peticiones
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-4 px-4 pb-4 sm:px-6">
          {item.description && (
            <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Descripción
              </p>
              {/* La nota se pinta bloque a bloque: quien la lee ve el mismo
                  formato que quien la escribió. */}
              <RichText value={item.description} className="mt-1.5" />
            </div>
          )}

          <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Ficha del equipo
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={exporting}
                title="Descargar la ficha con sus manuales, sus intervenciones y sus peticiones"
                onClick={() => void handleExport()}
              >
                <FileDown className="size-4" />
                {exporting ? "Preparando..." : "Exportar ficha en PDF"}
              </Button>
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Nº de serie</dt>
                <dd className="font-mono">{item.serialNumber ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Proveedor</dt>
                <dd>{item.supplier ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Fecha de alta</dt>
                <dd>
                  {item.purchaseDate ? formatDate(item.purchaseDate) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  Fin de garantía
                </dt>
                <dd>
                  {item.warrantyEndDate
                    ? formatDate(item.warrantyEndDate)
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Fecha de baja</dt>
                <dd>
                  {item.decommissionDate
                    ? formatDate(item.decommissionDate)
                    : "—"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Wrench className="size-3.5" />
                Historial de mantenimiento
              </p>
              {canManage && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => setFormTarget({ record: null })}
                >
                  <Plus className="size-3.5" />
                  Registrar intervención
                </Button>
              )}
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {item.maintenanceIntervalDays ? (
                <>
                  {reviewBadge}
                  <span>
                    Plan: cada {item.maintenanceIntervalDays} días
                    {review.dueAt
                      ? ` · próxima revisión ${formatDate(review.dueAt)}`
                      : " · sin primera revisión registrada"}
                  </span>
                </>
              ) : (
                <span>Sin plan de mantenimiento preventivo.</span>
              )}
            </div>

            {maintenance.length === 0 ? (
              <p className="mt-3 rounded-lg border border-dashed border-border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
                Todavía no hay intervenciones registradas en este equipo.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-border/70">
                {maintenance.map((record) => {
                  const meta = MAINTENANCE_META[record.kind];
                  const linked = record.requestId
                    ? requests.find((req) => req._id === record.requestId)
                    : undefined;
                  return (
                    <li
                      key={record._id}
                      className="flex items-start justify-between gap-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className={meta.badgeClassName}
                          >
                            {meta.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(record.performedAt)}
                          </span>
                          {record.technician && (
                            <span className="text-xs text-muted-foreground">
                              · {record.technician}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm font-medium">
                          {record.title}
                        </p>
                        {record.description && (
                          <RichText
                            value={record.description}
                            className="mt-0.5 text-xs leading-5 text-muted-foreground"
                          />
                        )}
                        {linked && (
                          <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                            Petición {linked.reference}
                          </p>
                        )}
                      </div>
                      {canManage && (
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label="Editar intervención"
                            onClick={() => setFormTarget({ record })}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-destructive"
                            aria-label="Borrar intervención"
                            onClick={() => setDeleteTarget(record)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <BookOpen className="size-3.5" />
                Manuales
              </p>
              {canAddManual && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => onAddManual(item)}
                >
                  <Plus className="size-4" />
                  Añadir manual
                </Button>
              )}
            </div>
            {manuals.assigned.length === 0 && manuals.byModel.length === 0 ? (
              <p className="mt-3 rounded-lg border border-dashed border-border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
                Este equipo no tiene manuales. Añádelos desde aquí —el que subas
                queda asignado a este equipo—; para uno del modelo, sin equipo
                concreto, está el módulo de manuales.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-border/70">
                {manuals.assigned.map((manual) => (
                  <ManualRow
                    key={manual._id}
                    manual={manual}
                    assigned
                    rights={rights}
                    onView={onViewManual}
                    onEdit={onEditManual}
                    onDelete={onDeleteManual}
                  />
                ))}
                {manuals.byModel.map((manual) => (
                  <ManualRow
                    key={manual._id}
                    manual={manual}
                    assigned={false}
                    rights={rights}
                    onView={onViewManual}
                    onEdit={onEditManual}
                    onDelete={onDeleteManual}
                  />
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Boxes className="size-3.5" />
              Repuestos compatibles
            </p>
            {compatible.length === 0 ? (
              <p className="mt-3 rounded-lg border border-dashed border-border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
                Ningún repuesto está marcado como compatible con este equipo
                todavía.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-border/70">
                {compatible.map((part) => {
                  const meta =
                    STOCK_META[stockState(part.stock, part.minStock)];
                  return (
                    <li
                      key={part._id}
                      className="flex items-center justify-between gap-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {part.name}
                        </p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {part.code}
                          {part.partNumber ? ` · ${part.partNumber}` : ""}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold tabular-nums">
                          {part.stock}
                          <span className="ml-1 text-xs font-normal text-muted-foreground">
                            {part.unit}
                          </span>
                        </p>
                        <Badge
                          variant="outline"
                          className={cn("mt-1", meta.badgeClassName)}
                        >
                          {meta.label}
                        </Badge>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <ClipboardList className="size-3.5" />
              Peticiones de este equipo
            </p>
            {related.length === 0 ? (
              <p className="mt-3 rounded-lg border border-dashed border-border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
                Todavía no hay peticiones vinculadas a este equipo.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-border/70">
                {shownRequests.map((request) => {
                  const status =
                    STATUS_META[request.status] ?? STATUS_META.pending;
                  const priority = PRIORITY_META[request.priority];
                  return (
                    <li key={request._id}>
                      <button
                        type="button"
                        onClick={() => onViewRequests(item._id)}
                        className="flex w-full items-center justify-between gap-3 py-2.5 text-left transition-colors hover:text-signal"
                        title="Ver estas peticiones en la cola"
                      >
                        <span className="min-w-0">
                          <span className="font-mono text-xs text-muted-foreground">
                            {request.reference}
                          </span>
                          <span className="block truncate text-sm">
                            {request.requesterName}
                            {request.requesterTeam
                              ? ` · ${request.requesterTeam}`
                              : ""}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className={priority.badgeClassName}
                          >
                            {priority.label}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={status.badgeClassName}
                          >
                            {status.label}
                          </Badge>
                          <span className="hidden text-xs text-muted-foreground sm:block">
                            {formatRelativeTime(request.createdAt)}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {related.length > shownRequests.length && (
              <p className="mt-2 text-xs text-muted-foreground">
                y {related.length - shownRequests.length} peticiones más…
              </p>
            )}
          </div>
        </div>

        {formTarget && (
          <MaintenanceDialog
            key={formTarget.record?._id ?? "new"}
            item={item}
            record={formTarget.record}
            requests={requests}
            onClose={() => setFormTarget(null)}
          />
        )}

        {deleteTarget && (
          <AlertDialog
            open
            onOpenChange={(open) => !open && setDeleteTarget(null)}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Borrar esta intervención?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se borrará del historial de {equipmentLabel(item)}. Esta
                  acción no se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-white hover:bg-destructive/90"
                  onClick={async () => {
                    try {
                      await removeRecord({ id: deleteTarget._id });
                      toast.success("Intervención borrada del historial");
                    } catch (error) {
                      toast.error(getErrorMessage(error));
                    } finally {
                      setDeleteTarget(null);
                    }
                  }}
                >
                  Borrar intervención
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        <SheetFooter className="border-t border-border/70 bg-background/80 px-4 py-4 sm:px-6">
          <div className="flex w-full flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cerrar
            </Button>
            {related.length > 0 && (
              <Button
                type="button"
                className="gap-2"
                onClick={() => onViewRequests(item._id)}
              >
                <ClipboardList className="size-4" />
                Ver sus peticiones
              </Button>
            )}
          </div>
        </SheetFooter>
        {children}
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Alta / edición de intervención (avería o mantenimiento preventivo)  */
/* ------------------------------------------------------------------ */

/** Fecha de hoy para el alta nueva (se evalúa al cargar el módulo, no en
 *  cada render, para mantener el render puro). */
const TODAY_INPUT = dateToInput(Date.now());

function MaintenanceDialog({
  item,
  record,
  requests,
  onClose,
}: {
  item: EquipmentDoc;
  /** Intervención a editar (null = alta nueva). */
  record: RecordDoc | null;
  requests: Doc<"partRequests">[];
  onClose: () => void;
}) {
  const create = useMutation(api.maintenance.create);
  const update = useMutation(api.maintenance.update);

  const isEdit = record !== null;
  const [kind, setKind] = useState<MaintenanceKind>(record?.kind ?? "repair");
  const [title, setTitle] = useState(record?.title ?? "");
  const [date, setDate] = useState(
    record ? dateToInput(record.performedAt) : TODAY_INPUT,
  );
  const [technician, setTechnician] = useState(record?.technician ?? "");
  const [description, setDescription] = useState(record?.description ?? "");
  const [requestId, setRequestId] = useState<Id<"partRequests"> | "">(
    record?.requestId ?? "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    const performedAt = inputToDate(date);
    if (!title.trim()) {
      setError("El resumen de la intervención es obligatorio.");
      return;
    }
    if (performedAt === undefined) {
      setError("Indica la fecha de la intervención.");
      return;
    }

    setBusy(true);
    try {
      const payload = {
        equipmentId: item._id,
        kind,
        title: title.trim(),
        // Como en la ficha del equipo: lo que se guarda es el documento del
        // editor y una nota vacía se queda en `undefined`.
        description: richDocToStore(description),
        performedAt,
        technician: technician.trim(),
        requestId: requestId === "" ? undefined : requestId,
      };
      if (isEdit && record) {
        await update({ id: record._id, ...payload });
        toast.success("Intervención actualizada");
      } else {
        await create(payload);
        toast.success(`${title.trim()} añadida al historial`);
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
          <DialogTitle>
            {isEdit ? "Editar intervención" : "Registrar intervención"}
          </DialogTitle>
          <DialogDescription>
            {equipmentLabel(item)} · queda registrada en su historial de
            mantenimiento.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="mt-kind">Tipo</Label>
            <Select
              value={kind}
              onValueChange={(value) => setKind(value as MaintenanceKind)}
            >
              <SelectTrigger id="mt-kind" disabled={busy}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="repair">
                  {MAINTENANCE_META.repair.label}
                </SelectItem>
                <SelectItem value="preventive">
                  {MAINTENANCE_META.preventive.label}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mt-date">Fecha</Label>
            <Input
              id="mt-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              disabled={busy}
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="mt-title">Resumen *</Label>
            <Input
              id="mt-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="p. ej. Sustitución de la fuente de alimentación"
              disabled={busy}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mt-technician">Realizada por</Label>
            <Input
              id="mt-technician"
              value={technician}
              onChange={(event) => setTechnician(event.target.value)}
              placeholder="Nombre del técnico"
              disabled={busy}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mt-request">Petición vinculada</Label>
            <Select
              value={requestId || "none"}
              onValueChange={(value) =>
                setRequestId(
                  value === "none" ? "" : (value as Id<"partRequests">),
                )
              }
            >
              <SelectTrigger id="mt-request" disabled={busy}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin petición vinculada</SelectItem>
                {requests.map((request) => (
                  <SelectItem key={request._id} value={request._id}>
                    {request.reference} · {request.requesterName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="mt-description">Descripción</Label>
            <RichTextEditor
              id="mt-description"
              value={description}
              onChange={setDescription}
              placeholder="Síntoma, causa, repuestos sustituidos, observaciones..."
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
            {busy ? "Guardando..." : isEdit ? "Guardar cambios" : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
