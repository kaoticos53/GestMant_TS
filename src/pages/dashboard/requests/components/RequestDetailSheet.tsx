import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import {
  Archive,
  Ban,
  Check,
  CirclePause,
  FileText,
  PackageCheck,
  Paperclip,
  Plus,
  RotateCcw,
  Trash2,
  Undo2,
  User,
  Wrench,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AttachmentGroup } from "@/components/AttachmentGroup";
import { AttachmentImage } from "@/components/AttachmentImage";
import { BlockedSteps } from "@/components/BlockedSteps";
import { RichText } from "@/components/RichText";
import { api } from "@/convex/_generated/api";
import {
  REQUEST_STEP_LABELS,
  blockedRequestSteps,
  canEditRequest,
  canRequestStep,
  isRequestInMotion,
} from "@/lib/requestFlow";
import { cn } from "@/lib/utils";
import {
  PRIORITY_META,
  STATUS_META,
  formatDateTime,
  getErrorMessage,
  type Priority,
} from "@/lib/workshop";

import type { PartDoc, RequestDoc } from "../types";
import { DecisionNotes } from "./DecisionNotes";

export function RequestDetailSheet({
  request,
  parts,
  canManage,
  onClose,
  onAssociate,
  onApprove,
  onReject,
  onIssue,
  onHold,
  onReturn,
  onCancel,
  onResume,
  resuming,
}: {
  request: RequestDoc;
  parts: PartDoc[];
  canManage: boolean;
  onClose: () => void;
  onAssociate: () => void;
  onApprove: () => void;
  onReject: () => void;
  onIssue: () => void;
  onHold: () => void;
  onReturn: () => void;
  onCancel: () => void;
  onResume: () => void;
  resuming: boolean;
}) {
  const archiveRequest = useMutation(api.partRequests.archive);
  const withdrawRequest = useMutation(api.partRequests.withdraw);
  const [archiving, setArchiving] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState("");
  const status = STATUS_META[request.status] ?? STATUS_META.pending;
  const priority = PRIORITY_META[request.priority as Priority];
  const partById = new Map(parts.map((part) => [part._id, part]));
  const noReference = request.lines.length === 0;
  const images = request.attachments.filter((a) => a.kind === "image");
  // Lo que la máquina deja hacer desde aquí, y lo que no: los pasos que no se
  // pueden dar se enseñan con su motivo en vez de desaparecer (`lib/requestFlow`).
  const blocked = canManage ? blockedRequestSteps(request.status) : [];
  const documents = request.attachments.filter((a) => a.kind === "document");

  /** Al archivo: sale de la cola del día a día y queda consultable allí. */
  const handleArchive = async () => {
    setArchiving(true);
    try {
      await archiveRequest({ requestId: request._id });
      toast.success(`${request.reference} enviada al archivo`);
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setArchiving(false);
    }
  };

  /**
   * Retirar: para la petición pedida por error o el duplicado de otra. No borra
   * —eso sería irreversible—, deja la petición en la papelera unos días, con el
   * mismo plazo que lo retirado del almacén.
   */
  const handleWithdraw = async () => {
    setWithdrawing(true);
    try {
      const reason = withdrawReason.trim();
      await withdrawRequest({
        requestId: request._id,
        ...(reason ? { reason } : {}),
      });
      toast.success(
        `${request.reference} retirada: queda en la papelera por si hay que volver a por ella`,
      );
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setWithdrawing(false);
      setWithdrawOpen(false);
      setWithdrawReason("");
    }
  };

  const details: { label: string; value: string }[] = [
    { label: "Solicitante", value: request.requesterName },
    { label: "Área o equipo de trabajo", value: request.requesterTeam ?? "—" },
    { label: "Equipo afectado", value: request.equipment ?? "—" },
    { label: "Creada", value: formatDateTime(request.createdAt) },
    {
      label: "Decisión",
      value: request.decidedAt
        ? `${request.decidedBy ?? "Responsable"} · ${formatDateTime(request.decidedAt)}`
        : "Pendiente",
    },
    {
      label: "Entrega",
      value: request.issuedAt ? formatDateTime(request.issuedAt) : "—",
    },
  ];

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl lg:max-w-2xl">
        <SheetHeader>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold text-muted-foreground">
              {request.reference}
            </span>
            <Badge variant="outline" className={priority.badgeClassName}>
              {priority.label}
            </Badge>
            <Badge variant="outline" className={status.badgeClassName}>
              <span
                className={cn("size-1.5 rounded-full", status.dotClassName)}
              />
              {status.label}
            </Badge>
            {noReference && (
              <Badge
                variant="outline"
                className="border-amber-500/25 bg-amber-500/10 text-amber-700"
              >
                <Wrench className="size-3" />
                Sin repuesto
              </Badge>
            )}
            {request.equipmentId && (
              <Badge
                variant="outline"
                className="border-signal/25 bg-signal/10 text-signal"
              >
                Modelo en inventario
              </Badge>
            )}
          </div>
          <SheetTitle className="text-xl tracking-tight">
            {request.requesterName}
          </SheetTitle>
          <SheetDescription>{status.description}</SheetDescription>
        </SheetHeader>

        <div className="grid gap-4 px-4 pb-4 sm:px-6">
          <dl className="grid grid-cols-2 gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-sm">
            {details.map((detail) => (
              <div key={detail.label}>
                <dt className="text-xs text-muted-foreground">
                  {detail.label}
                </dt>
                <dd className="mt-0.5 text-sm font-medium">{detail.value}</dd>
              </div>
            ))}
          </dl>

          {request.description && (
            <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Qué pide
              </p>
              <RichText value={request.description} className="mt-1.5" />
            </div>
          )}

          {request.attachments.length > 0 && (
            <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Paperclip className="size-3.5" />
                Adjuntos
              </p>
              {images.length > 0 && (
                // Las fotos del expediente, como grupo: si su dirección pública
                // no llega, el porqué se lee una vez, aquí encima, y cada hueco
                // se queda con su icono en lugar de repetir el mismo párrafo
                // cinco veces.
                <AttachmentGroup>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {images.map((image) => (
                      <AttachmentImage
                        key={image.storageId}
                        url={image.url}
                        name={image.name}
                        layout="cell"
                        link
                        frameClassName="aspect-square overflow-hidden rounded-lg border border-border/70"
                        imageClassName="size-full object-cover transition-transform group-hover:scale-105"
                      />
                    ))}
                  </div>
                </AttachmentGroup>
              )}
              {documents.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {documents.map((document) => (
                    <li key={document.storageId}>
                      {document.url ? (
                        <a
                          href={document.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/50 px-3 py-2 text-sm transition-colors hover:border-signal/40"
                        >
                          <FileText className="size-4 shrink-0 text-muted-foreground" />
                          <span className="truncate">{document.name}</span>
                        </a>
                      ) : (
                        <span className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                          <FileText className="size-4 shrink-0" />
                          <span className="truncate">{document.name}</span>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Repuestos solicitados
              </p>
              {canManage && canEditRequest(request.status) && !noReference && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={onAssociate}
                >
                  <Plus className="size-3.5" />
                  Asociar otro
                </Button>
              )}
            </div>

            {noReference ? (
              <div className="mt-3 rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 p-4 text-center">
                <p className="text-sm font-medium text-amber-800">
                  Todavía sin repuesto asociado
                </p>
                <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-amber-800/80">
                  Busca el proveedor y el part number a partir de la
                  descripción, y asocia el repuesto del catálogo o crea uno
                  nuevo.
                </p>
                {canManage && canEditRequest(request.status) && (
                  <Button
                    type="button"
                    size="sm"
                    className="mt-3 gap-1.5"
                    onClick={onAssociate}
                  >
                    <Wrench className="size-3.5" />
                    Asociar repuesto
                  </Button>
                )}
              </div>
            ) : (
              <ul className="mt-3 divide-y divide-border/70">
                {request.lines.map((line) => {
                  const part = partById.get(line.sparePartId);
                  const hasShortage = !part || part.stock < line.quantity;
                  return (
                    <li
                      key={line.sparePartId}
                      className="flex items-center justify-between gap-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {line.name}
                        </p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {line.code}
                          {part?.partNumber ? ` · ${part.partNumber}` : ""}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold tabular-nums">
                          ×{line.quantity}
                        </p>
                        <p
                          className={cn(
                            "text-xs tabular-nums",
                            hasShortage
                              ? "text-destructive"
                              : "text-muted-foreground",
                          )}
                        >
                          {part
                            ? `stock ${part.stock} ${part.unit}`
                            : "no está en catálogo"}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {request.notes && (
            <div className="rounded-xl border border-border/70 bg-muted/50 p-4">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <User className="size-3.5" />
                Nota del solicitante
              </p>
              <RichText value={request.notes} className="mt-1.5" />
            </div>
          )}

          <DecisionNotes request={request} />
        </div>

        <SheetFooter className="border-t border-border/70 bg-background/80 px-4 py-4 sm:px-6">
          {blocked.length > 0 && (
            <BlockedSteps
              groups={blocked.map((group) => ({
                label: group.actions
                  .map((action) => REQUEST_STEP_LABELS[action])
                  .join(", "),
                reason: group.reason,
              }))}
            />
          )}
          <div className="flex w-full flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cerrar
            </Button>
            {canManage && canRequestStep(request.status, "reject") && (
              <Button type="button" variant="outline" onClick={onReject}>
                Rechazar
              </Button>
            )}
            {canManage &&
              canRequestStep(request.status, "approve") &&
              (noReference ? (
                <Button type="button" className="gap-2" onClick={onAssociate}>
                  <Wrench className="size-4" />
                  Asociar repuesto
                </Button>
              ) : (
                <Button type="button" className="gap-2" onClick={onApprove}>
                  <Check className="size-4" />
                  Aprobar
                </Button>
              ))}
            {canManage && canRequestStep(request.status, "issue") && (
              <Button type="button" className="gap-2" onClick={onIssue}>
                <PackageCheck className="size-4" />
                Marcar entregada
              </Button>
            )}
            {/* Espera y cancelación: la petición ya está decidida o a medias,
                así que se deciden desde la ficha, con su motivo. Desde dónde se
                puede cada una lo dice la máquina (`lib/requestFlow`). */}
            {canManage && canRequestStep(request.status, "hold") && (
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={onHold}
              >
                <CirclePause className="size-4" />
                En espera
              </Button>
            )}
            {canManage && canRequestStep(request.status, "resume") && (
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={resuming}
                onClick={onResume}
              >
                <RotateCcw className="size-4" />
                {resuming ? "Reanudando..." : "Reanudar"}
              </Button>
            )}
            {/* Lo entregado se devuelve: es el paso que falta para poder
                cancelarla, así que el motivo de arriba manda aquí. */}
            {canManage && canRequestStep(request.status, "returnMaterial") && (
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={onReturn}
              >
                <Undo2 className="size-4" />
                Devolver material
              </Button>
            )}
            {canManage && canRequestStep(request.status, "cancel") && (
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={onCancel}
              >
                <Ban className="size-4" />
                Cancelar petición
              </Button>
            )}
            {canManage && !isRequestInMotion(request.status) && (
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={archiving}
                onClick={() => void handleArchive()}
              >
                <Archive className="size-4" />
                Archivar
              </Button>
            )}

            {/* Retirar: para la petición pedida por error o el duplicado de
                otra. No borra —eso sería irreversible—, deja la petición en la
                papelera unos días, con el mismo plazo que lo retirado del
                almacén. */}
            {canManage && (
              <Button
                type="button"
                variant="outline"
                className="gap-2 text-destructive hover:text-destructive"
                disabled={withdrawing}
                onClick={() => setWithdrawOpen(true)}
                title="Se guarda unos días en la papelera antes de borrarse de verdad"
              >
                <Trash2 className="size-4" />
                Retirar
              </Button>
            )}
          </div>
        </SheetFooter>

        {/* La confirmación de la retirada: es lo que evita que una petición
            buena se vaya por pulsar donde no era, y lo que apunta por qué se
            retira. */}
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
              <AlertDialogTitle>¿Retirar {request.reference}?</AlertDialogTitle>
              <AlertDialogDescription>
                Sale de la cola y del archivo: es para la petición pedida por
                error o el duplicado de otra. No se borra ahora: queda en la
                papelera —en el módulo Archivo— el plazo que tenga ajustado el
                taller, y desde ahí se recupera tal y como está, con sus
                repuestos asociados y sus decisiones. No toca el stock ni las
                compras que ya estén pedidas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="grid gap-2">
              <Label htmlFor="peticion-retirar-motivo">
                Por qué se retira (opcional)
              </Label>
              <Input
                id="peticion-retirar-motivo"
                value={withdrawReason}
                onChange={(event) => setWithdrawReason(event.target.value)}
                placeholder="Duplicada, pedida por error…"
                maxLength={160}
                disabled={withdrawing}
              />
              <p className="text-xs text-muted-foreground">
                Se apunta en la papelera, para saber de un vistazo por qué está
                ahí.
              </p>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={withdrawing}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={withdrawing}
                className="gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={(event) => {
                  event.preventDefault();
                  void handleWithdraw();
                }}
              >
                <Trash2 className="size-4" />
                {withdrawing ? "Retirando..." : "Retirar a la papelera"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Asociar repuesto (catálogo existente o investigación nueva)         */
/* ------------------------------------------------------------------ */

