import { Can } from "@/components/AbilityProvider";
import { Button } from "@/components/ui/button";
import { asIncident } from "@/lib/abilities";
import { Check, UserPlus, Wrench } from "lucide-react";
import type { IncidentWorkflowActionsProps } from "./actionButtonsTypes";

export function IncidentWorkflowActions({
  incident,
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
          {/* La pregunta se hace a la ficha, no al rol: verificar es de quien
              coordina, y el motor lo sabe por la capacidad y por el estado. */}
          <Can I="verify" this={asIncident(incident)}>
            <Button type="button" className="gap-2" onClick={onOpenVerify}>
              <Check className="size-4" />
              Verificar incidencia
            </Button>
          </Can>
        </>
      )}

      {showCloseResolved && (
        <Can I="close" this={asIncident(incident)}>
          <Button type="button" className="gap-2" onClick={onOpenClose}>
            <Wrench className="size-4" />
            Finalizar trabajo
          </Button>
        </Can>
      )}
    </>
  );
}
