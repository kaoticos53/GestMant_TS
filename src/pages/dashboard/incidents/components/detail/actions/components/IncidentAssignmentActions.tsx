import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import type { IncidentAssignmentActionsProps } from "./actionButtonsTypes";

export function IncidentAssignmentActions({
  showSelfAssign,
  canCoordinate,
  canReassignWorkshop,
  busy,
  currentUserId,
  onSelfAssign,
  onOpenAssign,
}: IncidentAssignmentActionsProps) {
  return (
    <>
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
    </>
  );
}
