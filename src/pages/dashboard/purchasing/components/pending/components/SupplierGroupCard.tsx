import type { Id } from "@/convex/_generated/dataModel";
import { Can } from "@/components/AbilityProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SharedMailSection } from "@/pages/dashboard/shared/SharedMailSection";
import {
  groupSummary,
  type PurchaseRequestDoc,
  type SupplierGroup,
} from "@/lib/purchasing";
import type { PurchaseActionTarget } from "../types";
import { PurchaseRequestRow } from "./PurchaseRequestRow";

export interface SupplierGroupCardProps {
  group: SupplierGroup;
  selectedIds: ReadonlySet<string>;
  isGroupFullySelected: boolean;
  onToggleItem: (id: string) => void;
  onToggleGroup: () => void;
  onAction: (target: PurchaseActionTarget) => void;
  onOpenRequest?: (id: Id<"partRequests">) => void;
}

/**
 * Tarjeta de agrupación de peticiones de compra por proveedor.
 * Permite marcar el grupo entero o filas individuales.
 */
export function SupplierGroupCard({
  group,
  selectedIds,
  isGroupFullySelected,
  onToggleItem,
  onToggleGroup,
  onAction,
  onOpenRequest,
}: SupplierGroupCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-2">
        <div>
          <CardTitle className="text-base">{group.supplier}</CardTitle>
          <p className="text-sm text-muted-foreground">{groupSummary(group)}</p>
        </div>
        <Can I="create" a="PurchaseOrder">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onToggleGroup}
          >
            {isGroupFullySelected ? "Quitar el grupo" : "Elegir el grupo"}
          </Button>
        </Can>
      </CardHeader>
      <CardContent className="grid gap-2">
        {group.items.map((row: PurchaseRequestDoc) => (
          <div key={row._id} className="grid gap-2">
            <PurchaseRequestRow
              row={row}
              selected={selectedIds.has(row._id)}
              onToggle={() => onToggleItem(row._id)}
              onAction={onAction}
              onOpenRequest={onOpenRequest}
            />
            <SharedMailSection
              destinationType="purchaseRequest"
              destinationId={row._id}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
