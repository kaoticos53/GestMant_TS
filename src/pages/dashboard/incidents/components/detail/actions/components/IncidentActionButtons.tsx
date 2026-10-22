import { Button } from "@/components/ui/button";
import type { Id } from "@/convex/_generated/dataModel";
import type { IncidentStatus } from "@/lib/workshop";
import {
  Archive,
  Check,
  PackagePlus,
  Trash2,
  Truck,
  UserPlus,
  Wrench,
} from "lucide-react";
import {
  canShowArchiveAction,
  canShowCloseResolvedAction,
  canShowPartRequestsAction,
  canShowReturnExternalAction,
  canShowSelfAssignAction,
  canShowSendExternalAction,
  canShowVerifyAction,
} from "../helpers";
import type { AssignTargetMode } from "../types";

interface IncidentActionButtonsProps {
  status: IncidentStatus;
  currentUserId: Id<"users"> | null;
  canWork: boolean;
  canCoordinate: boolean;
  canReassignWorkshop: boolean;
  inWorkshop: boolean;
  busy: boolean;
  onClose: () => void;
  onSelfAssign: () => void;
  onOpenAssign: (mode: AssignTargetMode) => void;
  onOpenVerify: () => void;
  onOpenRequest: () => void;
  onArchive: () => void;
  onOpenWithdraw: () => void;
  onOpenSendExternal: () => void;
  onOpenReceiveExternal: () => void;
  onOpenClose: () => void;
}

export function IncidentActionButtons({
  status,
  currentUserId,
  canWork,
  canCoordinate,
  canReassignWorkshop,
  inWorkshop,
  busy,
  onClose,
  onSelfAssign,
  onOpenAssign,
  onOpenVerify,
  onOpenRequest,
  onArchive,
  onOpenWithdraw,
  onOpenSendExternal,
  onOpenReceiveExternal,
  onOpenClose,
}: IncidentActionButtonsProps) {
  const showSelfAssign = canShowSelfAssignAction(status);
  const showVerify = canShowVerifyAction(status, canWork, inWorkshop);
  const showPartRequests = canShowPartRequestsAction(status, canWork);
  const showArchive = canShowArchiveAction(status, canCoordinate);
  const showSendExternal = canShowSendExternalAction(status, canWork);
  const showReturnExternal = canShowReturnExternalAction(status, canWork);
  const showCloseResolved = canShowCloseResolvedAction(status, canWork, inWorkshop);

  return (
    <>
      <Button type="button" variant="ghost" onClick={onClose}>
        Cerrar
      </Button>

      {showSelfAssign && (
        <>
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={onSelfAssign}
            disabled={busy || !currentUserId}
          >
            <UserPlus className="size-4" />
            Autoasignarme
          </Button>
          {canCoordinate && (
            <Button
              type="button"
              className="gap-2"
              onClick={() => onOpenAssign("assign")}
            >
              <UserPlus className="size-4" />
              Asignar a un técnico
            </Button>
          )}
        </>
      )}

      {showVerify && (
        <>
          {canCoordinate && (
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => onOpenAssign("assign")}
            >
              <UserPlus className="size-4" />
              Reasignar
            </Button>
          )}
          <Button
            type="button"
            className="gap-2"
            onClick={onOpenVerify}
          >
            <Check className="size-4" />
            Verificar incidencia
          </Button>
        </>
      )}

      {showPartRequests && (
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={onOpenRequest}
        >
          <PackagePlus className="size-4" />
          Petición de repuestos
        </Button>
      )}

      {showArchive && (
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          disabled={busy}
          onClick={onArchive}
        >
          <Archive className="size-4" />
          Archivar
        </Button>
      )}

      {canCoordinate && (
        <Button
          type="button"
          variant="outline"
          className="gap-2 text-destructive hover:text-destructive"
          disabled={busy}
          onClick={onOpenWithdraw}
          title="Se guarda unos días en la papelera antes de borrarse de verdad"
        >
          <Trash2 className="size-4" />
          Retirar
        </Button>
      )}

      {canReassignWorkshop && (
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={() => onOpenAssign("workshop")}
        >
          <UserPlus className="size-4" />
          Asignar orden
        </Button>
      )}

      {showSendExternal && (
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={onOpenSendExternal}
        >
          <Truck className="size-4" />
          Reparación externa
        </Button>
      )}

      {showReturnExternal && (
        <Button
          type="button"
          className="gap-2"
          onClick={onOpenReceiveExternal}
        >
          <Truck className="size-4" />
          Registrar retorno
        </Button>
      )}

      {showCloseResolved && (
        <Button
          type="button"
          className="gap-2"
          onClick={onOpenClose}
        >
          <Wrench className="size-4" />
          Finalizar trabajo
        </Button>
      )}
    </>
  );
}
