import { Button } from "@/components/ui/button";
import { Check, UserPlus, Wrench } from "lucide-react";
import type { IncidentWorkflowActionsProps } from "./actionButtonsTypes";

export function IncidentWorkflowActions({
  showVerify,
  showCloseResolved,
  canCoordinate,
  onOpenAssign,
  onOpenVerify,
  onOpenClose,
}: IncidentWorkflowActionsProps) {
  return (
    <>
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
