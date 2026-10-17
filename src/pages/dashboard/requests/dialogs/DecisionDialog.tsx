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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/RichTextEditor";
import { api } from "@/convex/_generated/api";
import { isPurchaseRequestAwaitingDelivery } from "@/lib/purchaseFlow";
import { lineRemaining } from "@/lib/requestFlow";
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
  const issueLines = useMutation(api.partRequests.issueLines);
  const onHold = useMutation(api.partRequests.onHold);
  const returnMaterial = useMutation(api.partRequests.returnMaterial);
  const cancel = useMutation(api.partRequests.cancel);
  const [note, setNote] = useState("");
  // Lo que se entrega en esta tanda, por línea. Arranca con todo lo que queda:
  // la entrega completa, que es lo que hacía el botón de antes, se hace pulsando
  // sin tocar nada; entregar de una en una es bajar el resto a cero.
  const [entrega, setEntrega] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      request.lines.map((line) => [
        line.sparePartId,
        lineRemaining(line, request.status),
      ]),
    ),
  );
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
  const isIssue = mode === "issue";
  /** Unidades que se entregan en esta tanda, todas las líneas juntas. */
  const entregandoAhora = request.lines.reduce(
    (sum, line) => sum + (entrega[line.sparePartId] ?? 0),
    0,
  );
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
    // Lo que se entrega, línea a línea: solo las líneas con algo que sacar. Una
    // tanda en cero no es una entrega, así que no llega al servidor.
    const tanda = request.lines
      .map((line) => ({
        sparePartId: line.sparePartId,
        quantity: entrega[line.sparePartId] ?? 0,
      }))
      .filter((line) => line.quantity > 0);
    if (isIssue && tanda.length === 0) {
      setError(
        "Indica al menos una unidad para entregar: lo que se quede en cero sigue en el almacén.",
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // El editor deja un documento vacío cuando no se escribe nada: eso no es
      // un motivo, así que la decisión se firma sin él.
      const reason = richDocIsEmpty(note) ? {} : { note };
      const payload = { requestId: request._id, ...reason };
      if (mode === "approve") await approve(payload);
      else if (mode === "reject") await reject(payload);
      else if (mode === "issue") await issueLines({ ...payload, lines: tanda });
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

        {isIssue && (
          <div className="rounded-lg border border-border/70 bg-muted/40 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Qué se entrega en esta tanda
            </p>
            <ul className="mt-2 space-y-2">
              {request.lines.map((line) => {
                const remaining = lineRemaining(line, request.status);
                const quantity = entrega[line.sparePartId] ?? 0;
                return (
                  <li
                    key={line.sparePartId}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="min-w-0 text-sm">
                      <span className="font-mono text-xs">{line.code}</span>{" "}
                      <span className="text-muted-foreground">{line.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {remaining === 0
                          ? "ya está entregado"
                          : `quedan ${remaining} por entregar`}
                      </span>
                    </span>
                    <Input
                      type="number"
                      min={0}
                      max={remaining}
                      inputMode="numeric"
                      aria-label={`Unidades de ${line.name} que se entregan`}
                      className="w-20 shrink-0 text-right tabular-nums"
                      value={quantity}
                      disabled={busy || remaining === 0}
                      onChange={(event) => {
                        const value = Math.floor(Number(event.target.value));
                        const clamped = Number.isFinite(value)
                          ? Math.max(0, Math.min(remaining, value))
                          : 0;
                        setEntrega((current) => ({
                          ...current,
                          [line.sparePartId]: clamped,
                        }));
                      }}
                    />
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Lo que quede a cero sigue en el almacén: la petición no se da por
              entregada hasta que se haya sacado todo.
            </p>
          </div>
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
            disabled={busy || blocked || (isIssue && entregandoAhora === 0)}
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
