import { Can } from "@/components/AbilityProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { asPurchaseRequest } from "@/lib/abilities";
import {
  canAdvancePurchaseRequest,
  isPurchaseRequestClosed,
  isPurchaseRequestUntreated,
} from "@/lib/purchaseFlow";
import {
  PURCHASE_REASON_META,
  PURCHASE_REQUEST_STATUS_META,
  type PurchaseRequestDoc,
} from "@/lib/purchasing";
import { formatDate } from "@/lib/workshop";
import type { PurchaseActionTarget, PurchaseActionType } from "../types";

export interface PurchaseRequestRowProps {
  row: PurchaseRequestDoc;
  selected: boolean;
  onToggle: () => void;
  onAction: (target: PurchaseActionTarget) => void;
}

/**
 * Fila puramente visual de una petición de compra pendiente.
 * No monta ningún diálogo en el DOM: delega las acciones a través de `onAction`.
 *
 * Cada botón pregunta a `<Can>` con la fila delante: la máquina dice desde qué
 * estado cabe el paso y el motor, quién puede darlo.
 */
export function PurchaseRequestRow({
  row,
  selected,
  onToggle,
  onAction,
}: PurchaseRequestRowProps) {
  const comoPeticion = asPurchaseRequest(row);
  const meta = PURCHASE_REQUEST_STATUS_META[row.status];

  const handleOpenAction = (action: PurchaseActionType) => {
    onAction({ request: row, action });
  };

  return (
    <div className="flex flex-wrap items-start gap-3 rounded-lg border border-border bg-card px-3 py-2">
      {isPurchaseRequestUntreated(row.status) && (
        <Can I="create" a="PurchaseOrder">
          <Checkbox
            checked={selected}
            onCheckedChange={onToggle}
            aria-label={`Incluir ${row.reference} en la orden`}
            className="mt-1"
          />
        </Can>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">
            {row.code} · {row.name}
          </span>
          <Badge variant="outline" className={meta.badgeClassName}>
            {meta.label}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {row.quantity} {row.unit} · {PURCHASE_REASON_META[row.reason]} · desde{" "}
          {row.requestReference} ({row.requesterName},{" "}
          {formatDate(row.requestDate)})
        </p>
        <p className="text-xs text-muted-foreground">
          {row.reference} · apartada por {row.requestedBy} el{" "}
          {formatDate(row.requestedAt)}
          {row.notes ? ` · ${row.notes}` : ""}
        </p>
      </div>

      <div className="flex flex-wrap gap-1">
        {!isPurchaseRequestClosed(row.status) && (
          <Can I="update" this={comoPeticion}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleOpenAction("note")}
            >
              Nota
            </Button>
          </Can>
        )}
        {isPurchaseRequestUntreated(row.status) && (
          <Can I="update" this={comoPeticion}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleOpenAction("supplier")}
            >
              Proveedor
            </Button>
          </Can>
        )}
        {canAdvancePurchaseRequest(row.status, "cancel") && (
          <Can I="cancel" this={comoPeticion}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => handleOpenAction("cancel")}
            >
              Retirar
            </Button>
          </Can>
        )}
      </div>
    </div>
  );
}
