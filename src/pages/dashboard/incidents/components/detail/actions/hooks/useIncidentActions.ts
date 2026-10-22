import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { archiveWithUndoToast, unarchiveSuccessToast } from "@/lib/archiveToasts";
import { getErrorMessage } from "@/lib/workshop";
import { useIncidentExport } from "../../../../hooks/useIncidentExport";
import type { AssignTargetMode, IncidentActionsBarProps } from "../types";

export function useIncidentActions({
  incident,
  linkedEquipment,
  linkedRequests,
  trail,
  currentUserName,
  onClose,
}: IncidentActionsBarProps) {
  const selfAssign = useMutation(api.incidents.selfAssign);
  const archiveIncident = useMutation(api.incidents.archive);
  const unarchiveIncident = useMutation(api.incidents.unarchive);
  const withdrawIncident = useMutation(api.incidents.withdraw);

  const [busy, setBusy] = useState(false);
  const [assignTarget, setAssignTarget] = useState<AssignTargetMode>(null);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState("");
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [sendExternalOpen, setSendExternalOpen] = useState(false);
  const [receiveExternalOpen, setReceiveExternalOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);

  const exportState = useIncidentExport({
    incident,
    linkedEquipment,
    linkedRequests,
    trail,
    currentUserName,
  });

  const handleSelfAssign = async () => {
    setBusy(true);
    try {
      await selfAssign({
        incidentId: incident._id,
        expectedUpdatedAt: incident.updatedAt,
      });
      toast.success(`${incident.reference} autoasignada`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const handleArchive = async () => {
    setBusy(true);
    try {
      await archiveIncident({ incidentId: incident._id });
      archiveWithUndoToast({
        reference: incident.reference,
        noun: "incidencia",
        onUndo: async () => {
          try {
            await unarchiveIncident({ incidentId: incident._id });
            unarchiveSuccessToast({ reference: incident.reference });
          } catch (err) {
            toast.error(getErrorMessage(err));
          }
        },
      });
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const handleWithdraw = async () => {
    setBusy(true);
    try {
      const reason = withdrawReason.trim();
      await withdrawIncident({
        incidentId: incident._id,
        ...(reason ? { reason } : {}),
      });
      toast.success(
        `${incident.reference} retirada: queda en la papelera por si hay que volver a por ella`,
      );
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
      setWithdrawOpen(false);
      setWithdrawReason("");
    }
  };

  return {
    busy,
    exportState,
    assignTarget,
    setAssignTarget,
    withdrawOpen,
    setWithdrawOpen,
    withdrawReason,
    setWithdrawReason,
    verifyOpen,
    setVerifyOpen,
    closeOpen,
    setCloseOpen,
    sendExternalOpen,
    setSendExternalOpen,
    receiveExternalOpen,
    setReceiveExternalOpen,
    requestOpen,
    setRequestOpen,
    handleSelfAssign,
    handleArchive,
    handleWithdraw,
  };
}
