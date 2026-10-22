import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { IncidentDoc } from "../../../types";

export type RequestDoc = Doc<"partRequests">;
export type RequestLine = RequestDoc["lines"][number];

export interface IncidentPartRequestsCardProps {
  incident: IncidentDoc;
  linkedRequests: RequestDoc[];
  canOpenRequests?: boolean;
  onOpenRequest?: (id: Id<"partRequests">) => void;
}

export interface IncidentPartRequestItemProps {
  request: RequestDoc;
  canOpenRequests?: boolean;
  onOpenRequest?: (id: Id<"partRequests">) => void;
}

export interface IncidentPartRequestLineProps {
  line: RequestLine;
  requestStatus: RequestDoc["status"];
  material: import("@/lib/requestFlow").RequestMaterialState;
}
