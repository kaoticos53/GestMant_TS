import { useState } from "react";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { RichText } from "@/components/RichText";
import { api } from "@/convex/_generated/api";
import {
  equipmentRecord,
  equipmentRecordPdfFilename,
} from "@/lib/equipmentRecord";
import { downloadPdf, loadPdfImage } from "@/lib/pdfBrowser";
import { reportToPdf } from "@/lib/reportPdf";
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
} from "@/lib/workshop";
import { useMutation } from "convex/react";
import {
  BookOpen,
  Boxes,
  ClipboardList,
  FileDown,
  Pencil,
  Plus,
  Trash2,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { ManualRow } from "./ManualRow";
import { MaintenanceDialog } from "../dialogs/MaintenanceDialog";
import type { EquipmentDetailSheetProps, RecordDoc } from "../types";

export function EquipmentDetailSheet({
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
}: EquipmentDetailSheetProps) {
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
