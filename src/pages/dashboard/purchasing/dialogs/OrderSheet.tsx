import { useState } from "react";
import { useMutation } from "convex/react";
import { Check, FileText, Truck, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { JourneySummary } from "@/components/JourneySummary";
import { api } from "@/convex/_generated/api";
import {
  NEXT_ORDER_STEP_LABELS,
  blockedJourneySteps,
  nextPurchaseOrderAction,
  orderJourney,
} from "@/lib/orderJourney";
import {
  PURCHASE_ORDER_STATUS_META,
  orderTotals,
  pendingQuantity,
  type PurchaseOrderDoc,
  type PurchaseOrderLine,
} from "@/lib/purchasing";
import { canAdvancePurchaseOrder, isPurchaseOrderClosed } from "@/lib/purchaseFlow";
import { formatDate, formatDateTime, getErrorMessage } from "@/lib/workshop";
import type { ReceptionDoc } from "../types";

export interface OrderSheetProps {
  order: PurchaseOrderDoc;
  receptions: ReceptionDoc[];
  canManage: boolean;
  onClose: () => void;
  onReceive: () => void;
  onCancel: () => void;
}

/** La orden entera: sus artículos, sus notas y lo que ha entrado. */
export function OrderSheet({
  order,
  receptions,
  canManage,
  onClose,
  onReceive,
  onCancel,
}: OrderSheetProps) {
  const setLineNote = useMutation(api.purchasing.setLineNote);
  const setSolicitudeCode = useMutation(api.purchasing.setSolicitudeCode);
  const [editandoSolicitud, setEditandoSolicitud] = useState(false);
  const [codigoSolicitud, setCodigoSolicitud] = useState(
    order.solicitudeCode ?? "",
  );
  const [guardandoSolicitud, setGuardandoSolicitud] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [nota, setNota] = useState("");
  const meta = PURCHASE_ORDER_STATUS_META[order.status];
  const total = orderTotals(order);

  // El recorrido, arriba: en qué tramo está la orden y qué toca, con las mismas
  // reglas que sus botones (`lib/orderJourney`).
  const stages = orderJourney(order.status, { received: total.received > 0 });
  const nextAction = nextPurchaseOrderAction(order.status, { canManage });
  const nextLabel = nextAction
    ? (NEXT_ORDER_STEP_LABELS[nextAction] ?? nextAction)
    : null;
  const nextHint = !canManage
    ? "La llevan quienes gestionan las compras."
    : order.status === "completed"
      ? "La orden está completada: entró todo lo que se pidió."
      : order.status === "cancelled"
        ? "La orden está anulada: sus peticiones volvieron a la cola."
        : "Sin pasos disponibles ahora mismo.";

  // Los dos pasos de la orden solo se bloquean cuando ya está cerrada, así que
  // su motivo se lee bajo el tramo que cuenta cómo terminó.
  const blocked = canManage ? blockedJourneySteps(order.status) : [];

  const guardarNota = async (line: PurchaseOrderLine) => {
    try {
      await setLineNote({
        orderId: order._id,
        purchaseRequestId: line.purchaseRequestId,
        note: nota,
      });
      toast.success(`${line.code}: nota guardada en la orden`);
      setEditando(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const guardarSolicitud = async () => {
    setGuardandoSolicitud(true);
    try {
      await setSolicitudeCode({
        orderId: order._id,
        solicitudeCode: codigoSolicitud.trim() || undefined,
      });
      toast.success("Código de solicitud actualizado");
      setEditandoSolicitud(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setGuardandoSolicitud(false);
    }
  };

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex flex-wrap items-center gap-2">
            {order.reference}
            {order.solicitudeCode && (
              <Badge variant="secondary" className="font-mono text-xs">
                Solicitud: {order.solicitudeCode}
              </Badge>
            )}
            <Badge variant="outline" className={meta.badgeClassName}>
              {meta.label}
            </Badge>
          </SheetTitle>
          <SheetDescription>
            {order.supplier} · pedida el {formatDateTime(order.orderedAt)} por{" "}
            {order.orderedBy} · {total.received}/{total.quantity} ud recibidas
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-4 px-4 pb-6">
          <JourneySummary
            label="Recorrido de la orden de compra"
            stages={stages}
            nowLabel={`${meta.label} · ${total.received}/${total.quantity} ud`}
            nextLabel={nextLabel}
            nextHint={nextHint}
            blocked={blocked}
          />
          {/* Código de solicitud de compra externa */}
          <div className="rounded-lg border border-border bg-card p-3 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Solicitud de compra
                </p>
                {!editandoSolicitud && (
                  <p className="mt-0.5 text-sm font-semibold">
                    {order.solicitudeCode ? (
                      <span className="font-mono text-foreground">
                        {order.solicitudeCode}
                      </span>
                    ) : (
                      <span className="font-normal italic text-muted-foreground">
                        Sin código asignado
                      </span>
                    )}
                  </p>
                )}
              </div>
              {canManage && !editandoSolicitud && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    setCodigoSolicitud(order.solicitudeCode ?? "");
                    setEditandoSolicitud(true);
                  }}
                >
                  {order.solicitudeCode ? "Modificar" : "Asignar"}
                </Button>
              )}
            </div>
            {editandoSolicitud && (
              <div className="mt-2 flex items-center gap-2">
                <Input
                  value={codigoSolicitud}
                  onChange={(e) => setCodigoSolicitud(e.target.value)}
                  placeholder="Ej. 10034573"
                  className="h-8 text-sm"
                  autoFocus
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-8 px-2.5"
                  disabled={guardandoSolicitud}
                  onClick={() => void guardarSolicitud()}
                >
                  <Check className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => setEditandoSolicitud(false)}
                >
                  Cancelar
                </Button>
              </div>
            )}
          </div>

          {order.notes && (
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
              {order.notes}
            </div>
          )}

          <div className="grid gap-2">
            <p className="text-sm font-medium">Artículos</p>
            {order.lines.map((line) => (
              <div
                key={line.purchaseRequestId}
                className="grid gap-1 rounded-lg border border-border px-3 py-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    {line.code} · {line.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {line.receivedQuantity}/{line.quantity} {line.unit}
                    {pendingQuantity(line) > 0 &&
                      ` · faltan ${pendingQuantity(line)}`}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Desde {line.requestReference} · {formatDate(line.requestDate)}
                </p>
                {editando === line.purchaseRequestId ? (
                  <div className="flex gap-2">
                    <Input
                      value={nota}
                      onChange={(event) => setNota(event.target.value)}
                      placeholder="Nota de este artículo"
                      autoFocus
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void guardarNota(line)}
                    >
                      <Check className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    {line.note ?? "Sin nota"}
                    {canManage && !isPurchaseOrderClosed(order.status) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => {
                          setNota(line.note ?? "");
                          setEditando(line.purchaseRequestId);
                        }}
                      >
                        Editar
                      </Button>
                    )}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="grid gap-2">
            <p className="text-sm font-medium">Recepciones</p>
            {receptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Todavía no ha entrado nada de esta orden.
              </p>
            ) : (
              receptions.map((row) => (
                <div
                  key={row._id}
                  className="grid gap-1 rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <span>
                    {formatDateTime(row.receivedAt)} · {row.receivedBy}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {row.lines
                      .map((line) => `${line.code} × ${line.quantity}`)
                      .join(" · ")}
                  </span>
                  {row.deliveryNoteUrl ? (
                    <a
                      href={row.deliveryNoteUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-signal underline"
                    >
                      <FileText className="size-3" />
                      {row.deliveryNote.name}
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {row.deliveryNote.name} (ya no está disponible)
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <SheetFooter className="sticky bottom-0 z-20 border-t border-border/70 bg-background/95 px-4 py-3 backdrop-blur-sm sm:px-6">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
          {canManage && canAdvancePurchaseOrder(order.status, "cancel") && (
            <Button
              type="button"
              variant="outline"
              className="gap-2 text-destructive"
              onClick={onCancel}
            >
              <Undo2 className="size-4" />
              Anular la orden
            </Button>
          )}
          {canManage && canAdvancePurchaseOrder(order.status, "receive") && (
            <Button type="button" className="gap-2" onClick={onReceive}>
              <Truck className="size-4" />
              Recepcionar material
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
