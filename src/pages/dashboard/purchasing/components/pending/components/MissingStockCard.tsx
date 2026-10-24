import { Can } from "@/components/AbilityProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import type { PartRequestDoc } from "@/pages/dashboard/purchasing/types";
import { PackageCheck, ShoppingCart } from "lucide-react";

export interface MissingStockItem {
  request: PartRequestDoc;
  missing: Array<{
    code: string;
    quantity: number;
  }>;
}

export interface MissingStockCardProps {
  missingStockRequests: readonly MissingStockItem[];
  markedIds: ReadonlySet<string>;
  areAllMarked: boolean;
  isReserving: boolean;
  generatingId: string | null;
  onToggleMarked: (id: string) => void;
  onToggleAll: () => void;
  onReserveMarked: () => void;
  onGenerateSingle: (request: PartRequestDoc) => void;
}

/**
 * Tarjeta para visualizar y apartar peticiones de repuesto que el almacén
 * no puede cubrir por falta de existencias.
 *
 * Apartar es un paso sobre la **petición de repuesto**, así que es `<Can>` quien
 * decide si se enseña: sin el paso `reserve`, la tarjeta queda como aviso.
 */
export function MissingStockCard({
  missingStockRequests,
  markedIds,
  areAllMarked,
  isReserving,
  generatingId,
  onToggleMarked,
  onToggleAll,
  onReserveMarked,
  onGenerateSingle,
}: MissingStockCardProps) {
  if (missingStockRequests.length === 0) return null;

  const markedCount = missingStockRequests.filter(({ request }) =>
    markedIds.has(request._id),
  ).length;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <PackageCheck className="size-4 text-signal" />
            Sin material en el almacén
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Peticiones que el almacén no puede cubrir —repuestos nuevos o sin
            existencias—. Apartarlas es el primer paso para comprarlas.
          </p>
        </div>
        <Can I="reserve" a="Request">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onToggleAll}
            >
              {areAllMarked ? "Quitar todas" : "Marcar todas"}
            </Button>
            <Button
              type="button"
              size="sm"
              className="gap-2"
              disabled={isReserving || markedCount === 0}
              onClick={onReserveMarked}
            >
              <ShoppingCart className="size-4" />
              {markedCount === 0
                ? "Apartar las marcadas"
                : `Apartar ${markedCount} ${
                    markedCount === 1 ? "petición" : "peticiones"
                  }`}
            </Button>
          </div>
        </Can>
      </CardHeader>

      <CardContent className="grid gap-2">
        {missingStockRequests.map(({ request, missing }) => (
          <div
            key={request._id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2"
          >
            <div className="flex min-w-0 items-start gap-3">
              <Can I="reserve" a="Request">
                <Checkbox
                  checked={markedIds.has(request._id)}
                  onCheckedChange={() => onToggleMarked(request._id)}
                  aria-label={`Incluir ${request.reference} en la compra`}
                  className="mt-1"
                />
              </Can>
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {request.reference}
                  <span className="ml-2 font-normal text-muted-foreground">
                    {request.requesterName}
                  </span>
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {missing
                    .map((line) => `${line.code} × ${line.quantity}`)
                    .join(" · ")}
                </p>
              </div>
            </div>
            <Can I="reserve" a="Request">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={generatingId === request._id}
                onClick={() => onGenerateSingle(request)}
              >
                <ShoppingCart className="size-4" />
                Generar petición de compra
              </Button>
            </Can>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
