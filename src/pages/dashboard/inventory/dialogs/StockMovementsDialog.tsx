import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
          aria-label="Buscar movimientos de stock"
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
          <div className="max-h-[55vh] overflow-auto rounded-lg border border-border/70">
            <Table className="text-xs">
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Repuesto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Variación</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead>Referencia / Motivo</TableHead>
                  <TableHead>Usuario</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => {
                  const meta =
                    STOCK_MOVEMENT_META[row.kind as StockMovementKind];
                  const deltaLabel =
                    row.delta > 0 ? `+${row.delta}` : String(row.delta);
                  return (
                    <TableRow key={row._id} className="hover:bg-muted/40">
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDateTime(row.createdAt)}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono font-medium">
                          {row.partCode}
                        </span>
                        <span className="ml-1.5 text-muted-foreground">
                          {row.partName}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[11px]">
                          {meta.label}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-mono font-semibold tabular-nums",
                          row.delta > 0
                            ? "text-emerald-600"
                            : "text-destructive",
                        )}
                      >
                        {deltaLabel}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {row.previousStock} → {row.nextStock}
                      </TableCell>
                      <TableCell>
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
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {row.actorName}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
