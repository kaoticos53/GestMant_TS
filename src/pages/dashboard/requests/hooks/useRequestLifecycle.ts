import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { archiveWithUndoToast, unarchiveSuccessToast } from "@/lib/archiveToasts";
import { getErrorMessage } from "@/lib/workshop";
import { toast } from "sonner";
import type { RequestDoc } from "../types";

export function useRequestLifecycle() {
  const archiveRequest = useMutation(api.partRequests.archive);
  const unarchiveRequest = useMutation(api.partRequests.unarchive);
  const withdrawRequest = useMutation(api.partRequests.withdraw);

  const [archiving, setArchiving] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState("");

  /**
   * Al archivo: sale de la cola del día a día y queda consultable allí.
   */
  const handleArchive = async (request: RequestDoc, onClose: () => void) => {
    setArchiving(true);
    try {
      await archiveRequest({ requestId: request._id });
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
  const handleWithdraw = async (request: RequestDoc, onClose: () => void) => {
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

  return {
    archiving,
    withdrawing,
    withdrawOpen,
    setWithdrawOpen,
    withdrawReason,
    setWithdrawReason,
    handleArchive,
    handleWithdraw,
  };
}
