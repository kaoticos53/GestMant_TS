import type { Priority, RequestStatus } from "@/lib/workshop";
import type { RequestDoc } from "../../types";

export interface RequestCardHeaderProps {
  reference: string;
  priority: Priority;
  status: RequestStatus;
  noReference: boolean;
  createdAt: number;
}

export interface RequestCardBodyProps {
  requesterName: string;
  requesterTeam?: string | null;
  equipment?: string | null;
  description?: string | null;
  notes?: string | null;
  status: RequestStatus;
  decisionText: string;
  compact: boolean;
}

export interface RequestCardLinesProps {
  lines: RequestDoc["lines"];
  noReference: boolean;
  canEdit: boolean;
  compact: boolean;
}

export interface RequestCardAttachmentsProps {
  attachments: RequestDoc["attachments"];
  images: number;
  documents: number;
  compact: boolean;
}

export interface RequestCardFooterProps {
  request: RequestDoc;
  compact: boolean;
  archiving: boolean;
  onOpen: () => void;
  onAssociate: () => void;
  onApprove: () => void;
  onReject: () => void;
  onIssue: () => void;
  onArchive: () => void;
}

export interface RequestActionFlags {
  canReject: boolean;
  canApprove: boolean;
  canAssociate: boolean;
  canIssue: boolean;
  canArchive: boolean;
}
