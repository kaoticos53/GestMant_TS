import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { IncidentDetailSheet } from "../../incidents/components/IncidentDetailSheet";
import { RequestDetailSheet } from "../../requests/components/RequestDetailSheet";
import type {
  IncidentDoc,
  RequestDoc,
  OpenArchivedDoc,
  TrashRow,
} from "../types";

export interface ArchiveDetailHostProps {
  openEntry: OpenArchivedDoc | null;
  onCloseEntry: () => void;
  trashOpen: TrashRow | null;
  onCloseTrash: () => void;
  allIncidents: IncidentDoc[];
  allRequests: RequestDoc[];
  parts: Doc<"spareParts">[];
  equipment: Doc<"equipment">[];
  canViewCatalog?: boolean;
  currentUserId?: Id<"users"> | null;
  currentUserName?: string;
  onOpenRequest?: (id: Id<"partRequests">) => void;
}

export function ArchiveDetailHost({
  openEntry,
  onCloseEntry,
  trashOpen,
  onCloseTrash,
  allIncidents,
  allRequests,
  parts,
  equipment,
  canViewCatalog = false,
  currentUserId = null,
  currentUserName = "",
  onOpenRequest,
}: ArchiveDetailHostProps) {
  // Documentos abiertos desde el archivo regular
  const openIncidentDoc =
    openEntry?.kind === "incident"
      ? (allIncidents.find((row) => row._id === openEntry.id) ?? null)
      : null;
  const openRequestDoc =
    openEntry?.kind === "request"
      ? (allRequests.find((row) => row._id === openEntry.id) ?? null)
      : null;

  // Consultas bajo demanda para fichas abiertas desde la papelera
  const openWithdrawnIncident = useQuery(
    api.incidents.withdrawn,
    trashOpen?.kind === "incident" ? { incidentId: trashOpen.item.id } : "skip",
  );
  const openWithdrawnRequest = useQuery(
    api.partRequests.withdrawn,
    trashOpen?.kind === "request" ? { requestId: trashOpen.item.id } : "skip",
  );

  return (
    <>
      {/* Fichas regulares archivadas en solo lectura */}
      {openRequestDoc && (
        <RequestDetailSheet
          key={openRequestDoc._id}
          request={openRequestDoc}
          parts={parts}
          canManage={false}
          showStock={canViewCatalog}
          onClose={onCloseEntry}
        />
      )}
      {openIncidentDoc && (
        <IncidentDetailSheet
          key={openIncidentDoc._id}
          incident={openIncidentDoc}
          equipment={equipment}
          requests={allRequests}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          canAssign={false}
          canOpenRequests={onOpenRequest !== undefined}
          onOpenRequest={onOpenRequest}
          onClose={onCloseEntry}
        />
      )}

      {/* Fichas retiradas en papelera en solo lectura */}
      {openWithdrawnRequest && (
        <RequestDetailSheet
          key={openWithdrawnRequest._id}
          request={openWithdrawnRequest}
          parts={parts}
          canManage={false}
          showStock={canViewCatalog}
          onClose={onCloseTrash}
        />
      )}
      {openWithdrawnIncident && (
        <IncidentDetailSheet
          key={openWithdrawnIncident._id}
          incident={openWithdrawnIncident}
          equipment={equipment}
          requests={allRequests}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          canAssign={false}
          canOpenRequests={onOpenRequest !== undefined}
          onOpenRequest={onOpenRequest}
          onClose={onCloseTrash}
        />
      )}
    </>
  );
}
