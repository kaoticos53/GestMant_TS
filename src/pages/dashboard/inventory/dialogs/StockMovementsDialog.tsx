import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { STOCK_MOVEMENT_META, type StockMovementKind } from "@/lib/movements";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/workshop";
import { useQuery } from "convex/react";
import { History } from "lucide-react";
import { useState } from "react";

interface StockMovementsDialogProps {
  open: boolean;
  sparePartId?: Id<"spareParts">;
  partLabel?: string;
  onClose: () => void;
}

export function StockMovementsDialog({
  open,
  sparePartId,
  partLabel,
  onClose,
}: StockMovementsDialogProps) {
  const [search, setSearch] = useState("");
  const byPart = useQuery(
    api.stockMovements.listByPart,
    open && sparePartId ? { sparePartId } : "skip",
  );
  const recent = useQuery(
    api.stockMovements.listRecent,
    open && !sparePartId ? {} : "skip",
  );

  const rows = sparePartId ? byPart : recent;
  const q = search.trim().toLowerCase();
  const filtered = (rows ?? []).filter((row) => {
    if (!q) return true;
    return (
      row.partCode.toLowerCase().includes(q) ||
      row.partName.toLowerCase().includes(q) ||
      (row.reference ?? "").toLowerCase().includes(q) ||
      row.actorName.toLowerCase().includes(q)
    );
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="size-4 text-primary" />
            Movimientos de stock
          </DialogTitle>
          <DialogDescription>
            {partLabel
              ? `Historial de entradas y salidas de ${partLabel}.`
              : "Últimos movimientos de entrada, ajuste y consumo del almacén."}
          </DialogDescription>
        </DialogHeader>

        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por código, repuesto, referencia (PET-/OC-) o técnico..."
        />

        {rows === undefined ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Cargando movimientos...
          </p>
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No hay movimientos registrados con ese filtro.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="bg-muted/50">
                <tr className="border-b">
                  <th className="px-3 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium">Repuesto</th>
                  <th className="px-3 py-2 font-medium">Tipo</th>
                  <th className="px-3 py-2 font-medium text-right">Variación</th>
                  <th className="px-3 py-2 font-medium text-right">Saldo</th>
                  <th className="px-3 py-2 font-medium">Referencia / Motivo</th>
                  <th className="px-3 py-2 font-medium">Usuario</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const meta =
                    STOCK_MOVEMENT_META[row.kind as StockMovementKind];
                  const deltaLabel =
                    row.delta > 0 ? `+${row.delta}` : String(row.delta);
                  return (
                    <tr key={row._id} className="border-b last:border-b-0">
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                        {formatDateTime(row.createdAt)}
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-mono font-medium">
                          {row.partCode}
                        </span>
                        <span className="ml-1.5 text-muted-foreground">
                          {row.partName}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="text-[11px]">
                          {meta.label}
                        </Badge>
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-right font-mono font-semibold tabular-nums",
                          row.delta > 0
                            ? "text-emerald-600"
                            : "text-destructive",
                        )}
                      >
                        {deltaLabel}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {row.previousStock} → {row.nextStock}
                      </td>
                      <td className="px-3 py-2">
                        {row.reference && (
                          <Badge
                            variant="secondary"
                            className="mr-1.5 font-mono text-[10px]"
                          >
                            {row.reference}
                          </Badge>
                        )}
                        <span className="text-muted-foreground">
                          {row.reason ?? ""}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {row.actorName}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
