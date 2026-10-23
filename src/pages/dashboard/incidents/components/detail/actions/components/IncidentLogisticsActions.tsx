import { Button } from "@/components/ui/button";
import { PackagePlus, Truck } from "lucide-react";
import type { IncidentLogisticsActionsProps } from "./actionButtonsTypes";

export function IncidentLogisticsActions({
  showPartRequests,
  showSendExternal,
  showReturnExternal,
  onOpenRequest,
  onOpenSendExternal,
  onOpenReceiveExternal,
}: IncidentLogisticsActionsProps) {
  return (
    <>
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
    </>
  );
}
