import { useState } from "react";
import { useMutation } from "convex/react";
import { ClipboardList, Truck, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import {
  PURCHASE_ORDER_STATUS_META,
  orderTotals,
  type PurchaseOrderDoc,
} from "@/lib/purchasing";
import { canAdvancePurchaseOrder } from "@/lib/purchaseFlow";
import { formatDate, getErrorMessage } from "@/lib/workshop";
import { OrderSheet } from "../dialogs/OrderSheet";
import { ReceiveDialog } from "../dialogs/ReceiveDialog";
import type { ReceptionDoc } from "../types";

export interface OrdersSectionProps {
  orders: PurchaseOrderDoc[];
  receptions: ReceptionDoc[];
  canManage: boolean;
}

export function OrdersSection({
  orders,
  receptions,
  canManage,
}: OrdersSectionProps) {
  const [abierta, setAbierta] = useState<PurchaseOrderDoc | null>(null);
  const [recibiendo, setRecibiendo] = useState<PurchaseOrderDoc | null>(null);
  const [anulando, setAnulando] = useState<PurchaseOrderDoc | null>(null);
  const cancelar = useMutation(api.purchasing.cancelOrder);
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);

  // La orden abierta se refresca con la última versión que llega del backend.
  const actual = abierta
    ? (orders.find((order) => order._id === abierta._id) ?? abierta)
    : null;

  if (orders.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center shadow-sm">
        <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-signal/10 text-signal">
          <ClipboardList className="size-5" />
        </span>
        <p className="mt-4 text-base font-semibold tracking-tight">
          Todavía no hay órdenes de compra
        </p>
        <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
          Se montan a mano desde «Sin tratar»: eliges lo que va al mismo
          proveedor y la orden sale con su número y su fecha.
        </p>
      </div>
    );
  }

  const anular = async () => {
    if (!anulando) return;
    setGuardando(true);
    try {
      const { returned } = await cancelar({
        orderId: anulando._id,
        note: motivo,
      });
      toast.success(`Orden ${anulando.reference} anulada`, {
        description:
          returned > 0
            ? `${returned} ${returned === 1 ? "petición de compra vuelve" : "peticiones de compra vuelven"} a la cola.`
            : "No había nada por devolver: lo recibido se queda.",
      });
      setAnulando(null);
      setMotivo("");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="grid gap-3">
      {orders.map((order) => {
        const meta = PURCHASE_ORDER_STATUS_META[order.status];
        const total = orderTotals(order);
        return (
          <Card key={order._id}>
            <CardContent className="grid gap-3 pt-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                    {order.reference}
                    {order.solicitudeCode && (
                      <Badge variant="secondary" className="font-mono text-xs">
                        Solicitud: {order.solicitudeCode}
                      </Badge>
                    )}
                    <Badge variant="outline" className={meta.badgeClassName}>
                      {meta.label}
                    </Badge>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {order.supplier} · {formatDate(order.orderedAt)} ·{" "}
                    {order.lines.length} artículo
                    {order.lines.length === 1 ? "" : "s"} · {total.received}/
                    {total.quantity} ud recibidas
                  </p>
                  {order.requestRefs.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Desde{" "}
                      {order.requestRefs
                        .map(
                          (ref) =>
                            `${ref.reference} (${formatDate(ref.requestedAt)})`,
                        )
                        .join(" · ")}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAbierta(order)}
                  >
                    Ver la orden
                  </Button>
                  {/* Con la máquina delante: «Recepcionar» es el paso
                      `receive` y «Anular», el `cancel`; ninguno se ofrece en una
                      orden ya completada o anulada. */}
                  {canManage &&
                    canAdvancePurchaseOrder(order.status, "receive") && (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          className="gap-2"
                          onClick={() => setRecibiendo(order)}
                        >
                          <Truck className="size-4" />
                          Recepcionar
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="gap-2 text-destructive"
                          onClick={() => {
                            setMotivo("");
                            setAnulando(order);
                          }}
                        >
                          <Undo2 className="size-4" />
                          Anular
                        </Button>
                      </>
                    )}
                </div>
              </div>
              {/* Los motivos viven en la ficha de la orden, junto a su etapa;
                  la tarjeta solo dice lo que ha llegado. */}
              <Progress value={Math.round(total.ratio * 100)} />
            </CardContent>
          </Card>
        );
      })}

      {actual && (
        <OrderSheet
          order={actual}
          receptions={receptions.filter((row) => row.orderId === actual._id)}
          canManage={canManage}
          onClose={() => setAbierta(null)}
          onReceive={() => {
            setRecibiendo(actual);
            setAbierta(null);
          }}
          onCancel={() => {
            setMotivo("");
            setAnulando(actual);
            setAbierta(null);
          }}
        />
      )}

      {recibiendo && (
        <ReceiveDialog
          open={recibiendo !== null}
          onOpenChange={(open) => !open && setRecibiendo(null)}
          order={recibiendo}
        />
      )}

      <Dialog
        open={anulando !== null}
        onOpenChange={(open) => !open && setAnulando(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anular {anulando?.reference}</DialogTitle>
            <DialogDescription>
              Lo que no haya llegado vuelve a la cola de compras para poder
              montarlo otra vez. El material ya recibido no se devuelve solo.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="motivo-anular">Motivo</Label>
            <Textarea
              id="motivo-anular"
              value={motivo}
              onChange={(event) => setMotivo(event.target.value)}
              rows={3}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAnulando(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={guardando || !motivo.trim()}
              onClick={() => void anular()}
            >
              Anular la orden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
