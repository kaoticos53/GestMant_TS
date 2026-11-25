import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { SharedMailSection } from "@/pages/dashboard/shared/SharedMailSection";
import { RevertApprovalDialog } from "../dialogs/RevertApprovalDialog";
import { LinkedPurchasesCard } from "./LinkedPurchasesCard";
import {
  canEditRequest,
  isRequestSettled,
  requestNeedsAttachmentUrls,
} from "@/lib/requestFlow";
import {
  blockedJourneySteps,
  nextRequestAction,
  requestJourney,
} from "@/lib/requestJourney";
import { PRIORITY_META, STATUS_META, type Priority } from "@/lib/workshop";
import type { PartDoc, RequestDoc } from "../types";
import { useRequestLifecycle } from "../hooks/useRequestLifecycle";
import { useRequestLinesStock } from "../hooks/useRequestLinesStock";
import { DecisionNotes } from "./DecisionNotes";
import { DeliveryTrail } from "./DeliveryTrail";
import {
  RequestActionsFooter,
  RequestAttachmentsCard,
  RequestHeader,
  RequestInfoCard,
  RequestJourneyCard,
  RequestLinesCard,
  RequestNotesSection,
  RequestStatusBanners,
  getRequestNextHint,
  getRequestNextLabel,
  getRequestNowLabel,
  resolveCanManageRequest,
} from "./detail";

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
  canPurchase?: boolean;
  onOpenPurchasing?: (
    section: "pending" | "orders",
    orderId?: Id<"purchaseOrders"> | null,
  ) => void;
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
  canPurchase = false,
  onOpenPurchasing,
}: RequestDetailSheetProps) {
  const needsAttachmentUrls = requestNeedsAttachmentUrls(request);
  const detailed = useQuery(
    api.partRequests.detail,
    needsAttachmentUrls ? { requestId: request._id } : "skip",
  );
  const resolvedRequest =
    needsAttachmentUrls && detailed ? detailed : request;

  const archivedAt = resolvedRequest.archivedAt;
  const withdrawnAt = request.deletedAt;
  const isWithdrawn = withdrawnAt !== undefined;
  const isArchived = archivedAt !== undefined;
  const canManage = resolveCanManageRequest(
    canManageRequest,
    archivedAt,
    withdrawnAt,
  );
  // La ficha archivada o retirada se consulta en solo lectura: los botones no se
  // apagan por el rol de quien mira, sino porque la petición ya no se trabaja.
  const readOnly = isArchived || isWithdrawn;

  const status = STATUS_META[request.status] ?? STATUS_META.pending;
  const priority = PRIORITY_META[request.priority as Priority];

  const [revertOpen, setRevertOpen] = useState(false);

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
  const { delivery, material, lastDeliveredAt, noReference, enrichedLines } =
    useRequestLinesStock(request.lines, request.status, parts);

  // Recorrido de la petición y pasos sugeridos
  const stages = useMemo(
    () =>
      requestJourney(request.status, {
        heldFrom: request.heldFrom,
        archived: isArchived,
      }),
    [request.status, request.heldFrom, isArchived],
  );

  const nextAction = nextRequestAction(request.status, { canManage });
  const nextLabel = getRequestNextLabel(nextAction, noReference);
  const nextHint = getRequestNextHint(
    request.status,
    canManage,
    isWithdrawn,
    isArchived,
  );
  const nowLabel = getRequestNowLabel(status.label, isWithdrawn, isArchived);

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
          <RequestJourneyCard
            stages={stages}
            nowLabel={nowLabel}
            nextLabel={nextLabel}
            nextHint={nextHint}
            blocked={blocked}
          />

          <RequestStatusBanners
            withdrawnAt={withdrawnAt}
            deletedBy={request.deletedBy}
            deletedReason={request.deletedReason}
            archivedAt={archivedAt}
          />

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

          <RequestNotesSection
            description={request.description}
            notes={request.notes}
          />

          <RequestAttachmentsCard attachments={resolvedRequest.attachments} />

          <RequestLinesCard
            enrichedLines={enrichedLines}
            noReference={noReference}
            canManage={canManage}
            canEdit={canEditRequest(request.status)}
            showStock={showStock}
            onAssociate={onAssociate}
          />

          <LinkedPurchasesCard
            request={resolvedRequest}
            hasShortage={enrichedLines.some((line) => line.hasShortage)}
            canPurchase={canPurchase}
            onOpenPurchasing={onOpenPurchasing}
          />

          <DeliveryTrail requestId={request._id} />

          <DecisionNotes request={request} />
        </div>

        <RequestActionsFooter
          request={request}
          readOnly={readOnly}
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
          onRevertApproval={() => setRevertOpen(true)}
          archiving={archiving}
          onArchive={() => handleArchive(request, onClose)}
          withdrawing={withdrawing}
          withdrawOpen={withdrawOpen}
          setWithdrawOpen={setWithdrawOpen}
          withdrawReason={withdrawReason}
          setWithdrawReason={setWithdrawReason}
          onWithdraw={() => handleWithdraw(request, onClose)}
        />
        <SharedMailSection
          destinationType="request"
          destinationId={request._id}
        />
        <RevertApprovalDialog
          open={revertOpen}
          onOpenChange={setRevertOpen}
          request={resolvedRequest}
        />
      </SheetContent>
    </Sheet>
  );
}
