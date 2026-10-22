import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { csvFilename, downloadCsv, toCsv } from "@/lib/export";
import { getErrorMessage } from "@/lib/workshop";
import { buildRequestsCsvData } from "../helpers";
import { useRequestFilters } from "./useRequestFilters";
import type { DecisionMode, RequestDoc, RequestFilterId } from "../types";

export function useRequestsState({
  equipmentFilter = "all",
  initialDetailId = null,
  initialFilter = "all",
}: {
  equipmentFilter?: string;
  initialDetailId?: Id<"partRequests"> | null;
  initialFilter?: RequestFilterId;
}) {
  const requests = useQuery(api.partRequests.list, {}) ?? [];
  const parts = useQuery(api.spareParts.list) ?? [];
  const equipment = useQuery(api.equipment.list, {}) ?? [];
  const resume = useMutation(api.partRequests.resume);
  const archiveRequest = useMutation(api.partRequests.archive);

  const [decision, setDecision] = useState<{
    request: RequestDoc;
    mode: DecisionMode;
  } | null>(null);
  const [resumingId, setResumingId] = useState<string | null>(null);
  const [associateTarget, setAssociateTarget] = useState<RequestDoc | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const filterState = useRequestFilters({
    requests,
    equipment,
    equipmentFilter,
    initialFilter,
    initialDetailId,
  });

  const { detailId, filtered } = filterState;

  // Lo que se pide abrir y no está en la cola: una petición archivada, a la que
  // enlaza la ficha de su incidencia. Se pide solo esa, en vez de cargar el
  // archivo entero con sus adjuntos, y se abre en solo lectura.
  const focused = useQuery(
    api.partRequests.detail,
    detailId !== null && !requests.some((request) => request._id === detailId)
      ? { requestId: detailId }
      : "skip",
  );
  const openRequest = filterState.detailRequest ?? focused ?? null;

  const handleResume = async (request: RequestDoc) => {
    setResumingId(request._id);
    try {
      await resume({ requestId: request._id });
      toast.success(`${request.reference} reanudada`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setResumingId(null);
    }
  };

  const handleArchive = async (request: RequestDoc) => {
    setArchivingId(request._id);
    try {
      await archiveRequest({ requestId: request._id });
      toast.success(
        `${request.reference} al archivo · puedes recuperarla desde Archivo`,
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setArchivingId(null);
    }
  };

  const handleExport = () => {
    const { header, rows } = buildRequestsCsvData(filtered);
    downloadCsv(csvFilename("peticiones"), toCsv(header, rows));
    toast.success(`Peticiones exportadas: ${rows.length}`);
  };

  const openDecision = (request: RequestDoc, mode: DecisionMode) => {
    setDecision({ request, mode });
  };

  return {
    requests,
    parts,
    equipment,
    decision,
    setDecision,
    openDecision,
    resumingId,
    associateTarget,
    setAssociateTarget,
    newOpen,
    setNewOpen,
    archivingId,
    openRequest,
    handleResume,
    handleArchive,
    handleExport,
    ...filterState,
  };
}
