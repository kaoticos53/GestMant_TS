import { canEditRequest } from "@/lib/requestFlow";
import { cn } from "@/lib/utils";
import type { Priority } from "@/lib/workshop";

import { attachmentCounts, decisionLine } from "../helpers";
import type { RequestDoc } from "../types";
import {
  RequestCardAttachments,
  RequestCardBody,
  RequestCardFooter,
  RequestCardHeader,
  RequestCardLines,
} from "./card";

export interface RequestCardProps {
  request: RequestDoc;
  /** Tarjeta reducida: para recorrer colas largas de un vistazo. */
  compact?: boolean;
  canManage: boolean;
  /** Esta petición se está mandando al archivo ahora mismo. */
  archiving?: boolean;
  onOpen: () => void;
  onAssociate: () => void;
  onApprove: () => void;
  onReject: () => void;
  onIssue: () => void;
  onArchive: () => void;
}

export function RequestCard({
  request,
  compact = false,
  canManage,
  archiving = false,
  onOpen,
  onAssociate,
  onApprove,
  onReject,
  onIssue,
  onArchive,
}: RequestCardProps) {
  const noReference = request.lines.length === 0;
  const { images, documents } = attachmentCounts(request);

  return (
    <article
      data-row
      className={cn(
        "rounded-xl border border-border/70 bg-card shadow-sm transition-colors hover:border-signal/40",
        compact ? "px-3 py-2" : "p-4 sm:p-5",
      )}
    >
      <RequestCardHeader
        reference={request.reference}
        priority={request.priority as Priority}
        status={request.status}
        noReference={noReference}
        createdAt={request.createdAt}
      />

      <RequestCardBody
        requesterName={request.requesterName}
        requesterTeam={request.requesterTeam}
        equipment={request.equipment}
        description={request.description}
        notes={request.notes}
        status={request.status}
        decisionText={decisionLine(request)}
        compact={compact}
      />

      <RequestCardLines
        lines={request.lines}
        noReference={noReference}
        canEdit={canEditRequest(request.status)}
        compact={compact}
      />

      <RequestCardAttachments
        attachments={request.attachments}
        images={images}
        documents={documents}
        compact={compact}
      />

      <RequestCardFooter
        request={request}
        compact={compact}
        canManage={canManage}
        archiving={archiving}
        onOpen={onOpen}
        onAssociate={onAssociate}
        onApprove={onApprove}
        onReject={onReject}
        onIssue={onIssue}
        onArchive={onArchive}
      />
    </article>
  );
}
