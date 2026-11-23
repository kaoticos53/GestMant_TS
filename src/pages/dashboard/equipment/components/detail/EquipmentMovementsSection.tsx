import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  EQUIPMENT_MOVEMENT_META,
  type EquipmentMovementKind,
} from "@/lib/movements";
import { formatDateTime } from "@/lib/workshop";
import { useQuery } from "convex/react";
import { MapPin } from "lucide-react";

export function EquipmentMovementsSection({
  equipmentId,
}: {
  equipmentId: Id<"equipment">;
}) {
  const movements = useQuery(api.equipmentMovements.listByEquipment, {
    equipmentId,
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <MapPin className="size-4 text-primary" />
          Desplazamientos y ciclo de vida
        </CardTitle>
      </CardHeader>
      <CardContent>
        {movements === undefined ? (
          <p className="text-xs text-muted-foreground">
            Cargando historial de desplazamientos...
          </p>
        ) : movements.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Sin desplazamientos registrados todavía.
          </p>
        ) : (
          <div className="space-y-2">
            {movements.map((mov) => {
              const meta =
                EQUIPMENT_MOVEMENT_META[mov.kind as EquipmentMovementKind];
              return (
                <div
                  key={mov._id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/20 px-3 py-2 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="text-[11px]">
                        {meta.label}
                      </Badge>
                      {mov.kind === "location_change" && (
                        <span className="font-medium">
                          {mov.fromLocation || "Sin ubicación"} →{" "}
                          {mov.toLocation || "Sin ubicación"}
                        </span>
                      )}
                      {mov.kind === "created" && mov.toLocation && (
                        <span className="text-muted-foreground">
                          Ubicación inicial: {mov.toLocation}
                        </span>
                      )}
                      {(mov.kind === "loan_out" ||
                        mov.kind === "loan_return") && (
                        <span className="font-medium">
                          {mov.borrowerName ? `${mov.borrowerName}` : ""}
                          {mov.toLocation ? ` · ${mov.toLocation}` : ""}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Por {mov.actorName}
                    </p>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {formatDateTime(mov.createdAt)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
