import { ShoppingCart, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WorkshopDataActionsProps } from "../types";

export function WorkshopDataActions({
  seeding,
  seedingPurchasing,
  resetting,
  onSeed,
  onSeedPurchasing,
  onRequestReset,
}: WorkshopDataActionsProps) {
  const isBusy = seeding || seedingPurchasing || resetting;

  return (
    <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
      <Button
        type="button"
        variant="outline"
        className="gap-2"
        disabled={seeding || resetting}
        onClick={onSeed}
      >
        <Sparkles className="size-4" />
        {seeding ? "Cargando..." : "Cargar datos de ejemplo"}
      </Button>
      <Button
        type="button"
        variant="outline"
        className="gap-2"
        disabled={isBusy}
        onClick={onSeedPurchasing}
      >
        <ShoppingCart className="size-4" />
        {seedingPurchasing ? "Cargando compras..." : "Compras de ejemplo"}
      </Button>
      <Button
        type="button"
        variant="destructive"
        className="gap-2"
        disabled={isBusy}
        onClick={onRequestReset}
      >
        <Trash2 className="size-4" />
        Vaciar el taller
      </Button>
    </div>
  );
}
