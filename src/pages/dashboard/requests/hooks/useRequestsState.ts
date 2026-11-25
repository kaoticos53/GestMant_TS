import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { archiveWithUndoToast, unarchiveSuccessToast } from "@/lib/archiveToasts";
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
  const rawRequests = useQuery(api.partRequests.list, {});
  const requests = rawRequests ?? [];
  const loading = rawRequests === undefined;
  const parts = useQuery(api.spareParts.list) ?? [];
  const equipment = useQuery(api.equipment.list, {}) ?? [];
  const resume = useMutation(api.partRequests.resume);
  const archiveRequest = useMutation(api.partRequests.archive);
  const unarchiveRequest = useMutation(api.partRequests.unarchive);

  const [decision, setDecision] = useState<{
    request: RequestDoc;
    mode: DecisionMode;
  } | null>(null);
  const [resumingId, setResumingId] = useState<string | null>(null);
  const [associateTarget, setAssociateTarget] = useState<RequestDoc | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<Id<"partRequests">>>(
    () => new Set(),
  );
  const [bulkArchiving, setBulkArchiving] = useState(false);

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

  const toggleSelect = (id: Id<"partRequests">) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleArchive = async (request: RequestDoc) => {
    setArchivingId(request._id);
    try {
      await archiveRequest({ requestId: request._id });
      setSelectedIds((prev) => {
        if (!prev.has(request._id)) return prev;
        const next = new Set(prev);
        next.delete(request._id);
        return next;
      });
      archiveWithUndoToast({
        reference: request.reference,
        noun: "petición",
        onUndo: async () => {
          try {
            await unarchiveRequest({ requestId: request._id });
            unarchiveSuccessToast({ reference: request.reference });
          } catch (err) {
            toast.error(getErrorMessage(err));
          }
        },
      });
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setArchivingId(null);
    }
  };

  const handleBulkArchive = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkArchiving(true);
    try {
      const results = await Promise.allSettled(
        ids.map((requestId) => archiveRequest({ requestId })),
      );
      let ok = 0;
      const failedIds = new Set<Id<"partRequests">>();
      results.forEach((res, idx) => {
        if (res.status === "fulfilled") {
          ok += 1;
        } else {
          failedIds.add(ids[idx]);
        }
      });
      setSelectedIds(failedIds);
      if (ok > 0) {
        toast.success(
          ok === 1
            ? "1 petición archivada"
            : `${ok} peticiones archivadas`,
        );
      }
      if (failedIds.size > 0) {
        toast.error(
          `${failedIds.size} petición(es) no se pudieron archivar`,
        );
      }
    } finally {
      setBulkArchiving(false);
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
    loading,
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
    selectedIds,
    bulkArchiving,
    toggleSelect,
    clearSelection,
    openRequest,
    handleResume,
    handleArchive,
    handleBulkArchive,
    handleExport,
    ...filterState,
  };
}
