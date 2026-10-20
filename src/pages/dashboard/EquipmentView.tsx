import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ListArea } from "@/components/ListArea";
import { TablePagination } from "@/components/TablePagination";
import { SortableTableHead, TableSortBar } from "@/components/TableSort";
import { api } from "@/convex/_generated/api";
import { manualsForEquipment, type ManualRights } from "@/lib/manuals";
import { sortRows } from "@/lib/tableSort";
import { useRowsThatFit } from "@/hooks/use-rows-that-fit";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { useTableSort } from "@/hooks/use-table-sort";
import { cn } from "@/lib/utils";
import { equipmentLabel, getErrorMessage, nextReview } from "@/lib/workshop";
import { useMutation, useQuery } from "convex/react";
import { BookOpen, Copy, Cpu, Eye, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ManualDeleteDialog } from "./ManualDeleteDialog";
import { ManualDetailSheet } from "./ManualDetailSheet";
import { ManualFormDialog } from "./ManualFormDialog";
import type { ManualDoc } from "./ManualsView";

import { EquipmentDetailSheet } from "./equipment/components/EquipmentDetailSheet";
import { EquipmentFormDialog } from "./equipment/dialogs/EquipmentFormDialog";
import type { EquipmentDoc, EquipmentFormDialogProps } from "./equipment/types";

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
  const catalogModels = useQuery(api.equipmentModels.list) ?? [];
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
    /** Los mismos campos que admite el formulario: no se declaran dos veces. */
    initialValues?: EquipmentFormDialogProps["initialValues"];
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

  const compatibleCount = (item: EquipmentDoc) => {
    const resolvedModelId =
      item.modelId ??
      catalogModels.find(
        (m) => m.model.trim().toLowerCase() === item.model.trim().toLowerCase(),
      )?._id;
    return parts.filter(
      (part) =>
        Boolean(resolvedModelId && part.compatibleModels?.includes(resolvedModelId)),
    ).length;
  };

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
                                  className="size-8 text-muted-foreground hover:text-foreground"
                                  onClick={() =>
                                    setFormTarget({
                                      item: null,
                                      initialValues: {
                                        model: item.model,
                                        brand: item.brand,
                                        name: item.name,
                                        supplier: item.supplier,
                                        maintenanceIntervalDays:
                                          item.maintenanceIntervalDays,
                                        description: item.description,
                                        modelId: item.modelId,
                                      },
                                    })
                                  }
                                  title={`Añadir otra unidad de ${item.model} (usar modelo como plantilla)`}
                                  aria-label={`Añadir otra unidad de ${item.model}`}
                                >
                                  <Copy className="size-4" />
                                </Button>
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
          key={formTarget.item?._id ?? formTarget.initialValues?.model ?? "new"}
          item={formTarget.item}
          initialValues={formTarget.initialValues}
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
