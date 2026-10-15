import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { CircleAlert, ShoppingCart } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/RichTextEditor";
import { api } from "@/convex/_generated/api";
import { isPurchaseRequestAwaitingDelivery } from "@/lib/purchaseFlow";
import { richDocIsEmpty } from "@/lib/richDoc";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/workshop";

import {
  DECISION_ICON,
  DECISION_META,
  type DecisionMode,
  type PartDoc,
  type RequestDoc,
} from "../types";

export function DecisionDialog({
  request,
  mode,
  parts,
  canPurchase,
  onClose,
}: {
  request: RequestDoc;
  mode: DecisionMode;
  parts: PartDoc[];
  canPurchase: boolean;
  onClose: () => void;
}) {
  const approve = useMutation(api.partRequests.approve);
  const requestPurchase = useMutation(api.purchasing.requestPurchase);
  const reject = useMutation(api.partRequests.reject);
  const markIssued = useMutation(api.partRequests.markIssued);
  const onHold = useMutation(api.partRequests.onHold);
  const returnMaterial = useMutation(api.partRequests.returnMaterial);
  const cancel = useMutation(api.partRequests.cancel);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const meta = DECISION_META[mode];
  const DecisionIcon = DECISION_ICON[mode];

  const partById = new Map(parts.map((part) => [part._id, part]));
  const shortages = request.lines.filter((line) => {
    const part = partById.get(line.sparePartId);
    return !part || part.stock < line.quantity;
  });

  const isApprove = mode === "approve";
  const missingReference = isApprove && request.lines.length === 0;
  const blocked = isApprove && (missingReference || shortages.length > 0);
  // De lo que falta, qué ya está en la cola de compras: así no se compra dos
  // veces lo mismo y se ve que la petición va por buen camino. Solo se pregunta
  // si se puede mirar (el backend no contesta a quien no tiene la capacidad).
  const comprasQuery = useQuery(
    api.purchasing.byRequest,
    canPurchase ? { requestId: request._id } : ("skip" as const),
  );
  const compras = comprasQuery?.requests ?? [];
  // «¿Sigue en camino?» lo dice la máquina de la compra (`lib/purchaseFlow`):
  // cuenta igual una ya en una orden y una sin tratar, y no cuenta lo retirado
  // ni lo que ya entró en el almacén.
  const compradas = compras.filter(isPurchaseRequestAwaitingDelivery).length;

  const handlePurchase = async () => {
    setBusy(true);
    setError(null);
    try {
      const { references, repeated } = await requestPurchase({
        requestId: request._id,
      });
      toast.success(
        references.length === 1
          ? `${references[0]} apartada para comprar`
          : `${references.length} peticiones de compra apartadas`,
        {
          description:
            repeated > 0
              ? `${repeated} línea${repeated === 1 ? "" : "s"} ya estaba${repeated === 1 ? "" : "n"} en la cola de compras.`
              : "Están sin tratar, en el módulo de compras.",
        },
      );
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async () => {
    setBusy(true);
    setError(null);
    try {
      // El editor deja un documento vacío cuando no se escribe nada: eso no es
      // un motivo, así que la decisión se firma sin él.
      const reason = richDocIsEmpty(note) ? {} : { note };
      const payload = { requestId: request._id, ...reason };
      if (mode === "approve") await approve(payload);
      else if (mode === "reject") await reject(payload);
      else if (mode === "issue") await markIssued(payload);
      else if (mode === "hold") await onHold(payload);
      else if (mode === "return") await returnMaterial(payload);
      else await cancel(payload);
      toast.success(meta.success(request));
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{meta.title}</DialogTitle>
          <DialogDescription>
            {request.reference} · {request.requesterName}
            {request.requesterTeam ? ` · ${request.requesterTeam}` : ""}
          </DialogDescription>
        </DialogHeader>

        {missingReference ? (
          <p className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2.5 text-sm leading-6 text-amber-800">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            Esta petición no tiene ningún repuesto asociado. Asocia el repuesto
            (del catálogo o creando uno nuevo) antes de aprobar.
          </p>
        ) : isApprove ? (
          <div className="rounded-lg border border-border/70 bg-muted/40 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Stock al aprobar
            </p>
            <ul className="mt-2 space-y-1.5">
              {request.lines.map((line) => {
                const part = partById.get(line.sparePartId);
                const remaining = (part?.stock ?? 0) - line.quantity;
                const hasShortage = !part || remaining < 0;
                return (
                  <li
                    key={line.sparePartId}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="truncate">
                      <span className="font-mono text-xs">{line.code}</span>{" "}
                      <span className="text-muted-foreground">{line.name}</span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 tabular-nums",
                        hasShortage
                          ? "font-semibold text-destructive"
                          : "text-muted-foreground",
                      )}
                    >
                      {part?.stock ?? 0} − {line.quantity} ={" "}
                      <span className="font-semibold text-foreground">
                        {Math.max(remaining, 0)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
            {shortages.length > 0 && (
              <div className="mt-3 grid gap-2 rounded-md bg-destructive/10 px-2.5 py-2 text-xs leading-5 text-destructive">
                <p className="flex items-start gap-2">
                  <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
                  {compradas > 0
                    ? `Stock insuficiente en ${shortages.length} líneas, pero ${compradas === 1 ? "ya hay una petición de compra viva" : `ya hay ${compradas} peticiones de compra vivas`} para ellas: entra en el almacén cuando llegue el material.`
                    : `Stock insuficiente en ${shortages.length} líneas. Rechaza la petición o repón el catálogo antes de aprobar.`}
                </p>
                {canPurchase && compradas < shortages.length && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-fit gap-2"
                    disabled={busy}
                    onClick={() => void handlePurchase()}
                  >
                    <ShoppingCart className="size-4" />
                    Comprar lo que falta
                  </Button>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">
            {meta.description}
          </p>
        )}

        <div className="grid gap-2">
          <Label htmlFor="decision-note">{meta.label}</Label>
          {/* El motivo se escribe con el editor, como las notas del cuaderno:
              negritas, listas y fotos si hacen falta (el presupuesto del
              proveedor, la foto del material apartado). */}
          <RichTextEditor
            id="decision-note"
            value={note}
            onChange={setNote}
            placeholder={meta.placeholder}
            disabled={busy}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={busy || blocked}
            className="gap-2"
          >
            <DecisionIcon className="size-4" />
            {meta.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
