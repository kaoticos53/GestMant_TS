import { useMemo } from "react";
import { JourneySummary } from "@/components/JourneySummary";
import { RichText } from "@/components/RichText";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { canEditRequest, isRequestSettled } from "@/lib/requestFlow";
import {
  NEXT_REQUEST_STEP_LABELS,
  blockedJourneySteps,
  nextRequestAction,
  requestJourney,
} from "@/lib/requestJourney";
import {
  PRIORITY_META,
  STATUS_META,
  formatDateTime,
  type Priority,
} from "@/lib/workshop";
import { User } from "lucide-react";
import type { PartDoc, RequestDoc } from "../types";
import { useRequestLifecycle } from "../hooks/useRequestLifecycle";
import { useRequestLinesStock } from "../hooks/useRequestLinesStock";
import { DecisionNotes } from "./DecisionNotes";
import { DeliveryTrail } from "./DeliveryTrail";
import { RequestActionsFooter } from "./detail/RequestActionsFooter";
import { RequestAttachmentsCard } from "./detail/RequestAttachmentsCard";
import { RequestHeader } from "./detail/RequestHeader";
import { RequestInfoCard } from "./detail/RequestInfoCard";
import { RequestLinesCard } from "./detail/RequestLinesCard";

export interface RequestDetailSheetProps {
  request: RequestDoc;
  parts: PartDoc[];
  canManage: boolean;
  onClose: () => void;
  onAssociate?: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  onIssue?: () => void;
  onHold?: () => void;
  onReturn?: () => void;
  onCancel?: () => void;
  onResume?: () => void;
  resuming?: boolean;
  showStock?: boolean;
}

export function RequestDetailSheet({
  request,
  parts,
  canManage: canManageRequest,
  onClose,
  onAssociate,
  onApprove,
  onReject,
  onIssue,
  onHold,
  onReturn,
  onCancel,
  onResume,
  resuming = false,
  showStock = true,
}: RequestDetailSheetProps) {
  const archivedAt = request.archivedAt;
  const withdrawnAt = request.deletedAt;
  const withdrawn = withdrawnAt !== undefined;
  const canManage = canManageRequest && archivedAt === undefined && !withdrawn;

  const status = STATUS_META[request.status] ?? STATUS_META.pending;
  const priority = PRIORITY_META[request.priority as Priority];

  // Hook de ciclo de vida (archivado y retirada a papelera)
  const {
    archiving,
    withdrawing,
    withdrawOpen,
    setWithdrawOpen,
    withdrawReason,
    setWithdrawReason,
    handleArchive,
    handleWithdraw,
  } = useRequestLifecycle();

  // Hook de líneas de repuesto y control de stock memoizado
  const {
    delivery,
    material,
    lastDeliveredAt,
    noReference,
    enrichedLines,
  } = useRequestLinesStock(request.lines, request.status, parts);

  // Recorrido de la petición y pasos sugeridos
  const stages = useMemo(
    () =>
      requestJourney(request.status, {
        heldFrom: request.heldFrom,
        archived: archivedAt !== undefined,
      }),
    [request.status, request.heldFrom, archivedAt],
  );

  const nextAction = nextRequestAction(request.status, { canManage });
  const nextLabel = nextAction
    ? nextAction === "approve" && noReference
      ? "Asociar un repuesto y aprobarla"
      : (NEXT_REQUEST_STEP_LABELS[nextAction] ?? nextAction)
    : null;

  const nextHint = withdrawn
    ? "Retirada a la papelera: se consulta en solo lectura hasta recuperarla o borrarla."
    : archivedAt !== undefined
      ? "En el archivo: la petición se consulta en solo lectura."
      : !canManage
        ? "La tramita quien gestiona los repuestos; desde aquí puedes seguirla."
        : request.status === "pendingSupplierQuote"
          ? "Presupuesto pedido al proveedor: cuando llegue el material, entra y se aprueba."
          : request.status === "issued"
            ? "Material entregado: la petición se archiva cuando toque."
            : request.status === "returned"
              ? "El material se devolvió: si vuelve a hacer falta, se pide de nuevo."
              : request.status === "rejected" || request.status === "cancelled"
                ? "Ya está cerrada: no se vuelve a tramitar."
                : "Sin pasos disponibles ahora mismo.";

  const blocked =
    canManage && !isRequestSettled(request.status)
      ? blockedJourneySteps(request.status, { heldFrom: request.heldFrom })
      : [];

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl lg:max-w-2xl">
        <RequestHeader
          reference={request.reference}
          requesterName={request.requesterName}
          priority={priority}
          status={status}
          material={material}
          noReference={noReference}
          hasEquipmentId={Boolean(request.equipmentId)}
        />

        <div className="grid gap-4 px-4 pb-4 sm:px-6">
          <JourneySummary
            label="Recorrido de la petición"
            stages={stages}
            nowLabel={
              withdrawn
                ? `${status.label} · retirada`
                : archivedAt !== undefined
                  ? `${status.label} · en el archivo`
                  : status.label
            }
            nextLabel={nextLabel}
            nextHint={nextHint}
            blocked={blocked}
          />

          {withdrawnAt !== undefined && (
            <p className="rounded-lg border border-dashed border-destructive/40 bg-destructive/5 p-3 text-xs leading-5 text-muted-foreground">
              Retirada el {formatDateTime(withdrawnAt)}
              {request.deletedBy ? ` por ${request.deletedBy}` : ""}
              {request.deletedReason ? ` · ${request.deletedReason}` : ""}.
              Mientras esté en la papelera se consulta en solo lectura; se
              recupera o se borra desde el módulo Archivo.
            </p>
          )}

          {archivedAt !== undefined && !withdrawn && (
            <p className="rounded-lg border border-dashed border-border bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">
              En el archivo desde el {formatDateTime(archivedAt)}: la petición
              se consulta en solo lectura y no se trabaja desde la cola. Para
              volver a tramitarla, recupérala desde el módulo Archivo.
            </p>
          )}

          <RequestInfoCard
            requesterName={request.requesterName}
            requesterTeam={request.requesterTeam}
            equipment={request.equipment}
            createdAt={request.createdAt}
            decidedAt={request.decidedAt}
            decidedBy={request.decidedBy}
            issuedAt={request.issuedAt}
            delivery={delivery}
            lastDeliveredAt={lastDeliveredAt}
          />

          {request.description && (
            <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Qué pide
              </p>
              <RichText value={request.description} className="mt-1.5" />
            </div>
          )}

          <RequestAttachmentsCard attachments={request.attachments} />

          <RequestLinesCard
            enrichedLines={enrichedLines}
            noReference={noReference}
            canManage={canManage}
            canEdit={canEditRequest(request.status)}
            showStock={showStock}
            onAssociate={onAssociate}
          />

          <DeliveryTrail requestId={request._id} />

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

        <RequestActionsFooter
          canManage={canManage}
          status={request.status}
          reference={request.reference}
          noReference={noReference}
          onClose={onClose}
          onReject={onReject}
          onApprove={onApprove}
          onAssociate={onAssociate}
          onIssue={onIssue}
          onHold={onHold}
          onResume={onResume}
          resuming={resuming}
          onReturn={onReturn}
          onCancel={onCancel}
          archiving={archiving}
          onArchive={() => handleArchive(request, onClose)}
          withdrawing={withdrawing}
          withdrawOpen={withdrawOpen}
          setWithdrawOpen={setWithdrawOpen}
          withdrawReason={withdrawReason}
          setWithdrawReason={setWithdrawReason}
          onWithdraw={() => handleWithdraw(request, onClose)}
        />
      </SheetContent>
    </Sheet>
  );
}
