import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { BlockedSteps } from "@/components/BlockedSteps";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  FILE_ACCEPT,
  MAX_FILE_SIZE_LABEL,
  compressForUpload,
  exceedsFileLimit,
  uploadToStorage,
} from "@/lib/upload";
import {
  PURCHASE_ORDER_STATUS_META,
  PURCHASE_REASON_META,
  PURCHASE_REQUEST_STATUS_META,
  groupBySupplier,
  groupSummary,
  orderTotals,
  pendingQuantity,
  requestsMissingStock,
  type PurchaseOrderDoc,
  type PurchaseOrderLine,
  type PurchaseRequestDoc,
} from "@/lib/purchasing";
import {
  PURCHASE_ORDER_STEP_LABELS,
  blockedPurchaseOrderSteps,
  canAdvancePurchaseOrder,
  canAdvancePurchaseRequest,
  isPurchaseOrderClosed,
  isPurchaseRequestClosed,
  isPurchaseRequestUntreated,
} from "@/lib/purchaseFlow";
import { formatDate, formatDateTime, getErrorMessage } from "@/lib/workshop";
import { useMutation, useQuery } from "convex/react";
import {
  Check,
  ClipboardList,
  FileText,
  PackageCheck,
  ShoppingCart,
  Truck,
  Undo2,
  Upload,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type PartRequestDoc = Doc<"partRequests">;
type PartDoc = Doc<"spareParts">;
type ReceptionDoc = Doc<"receptions"> & { deliveryNoteUrl: string | null };

/** Las tres cosas que se miran en el módulo. */
type Section = "pending" | "orders" | "movements";

const SECTIONS: { id: Section; label: string; icon: typeof Truck }[] = [
  { id: "pending", label: "Sin tratar", icon: ShoppingCart },
  { id: "orders", label: "Órdenes de compra", icon: ClipboardList },
  { id: "movements", label: "Recepciones", icon: Truck },
];

interface PurchasingViewProps {
  canManage: boolean;
}

/**
 * El módulo de compras, de arriba abajo: lo que espera a que alguien monte la
 * orden (agrupado por proveedor, que es como se compra), las órdenes con lo que
 * ha llegado de cada una y los movimientos de recepción con su albarán.
 */
export function PurchasingView({ canManage }: PurchasingViewProps) {
  // El módulo carga las tres listas que enseña —lo que espera por proveedor, las
  // órdenes y las recepciones— más lo que necesita para nombrar lo que se pide:
  // el catálogo y las peticiones de repuesto de las que sale cada compra.
  const purchasing = useQuery(api.purchasing.listPurchaseRequests, {});
  const orders = useQuery(api.purchasing.listOrders, {}) ?? [];
  const receptions = useQuery(api.purchasing.listReceptions, {}) ?? [];
  const partRequests =
    useQuery(api.partRequests.list, { includeArchived: true }) ?? [];
  const parts = useQuery(api.spareParts.list) ?? [];
  const purchaseRequests = purchasing?.requests ?? [];

  const [section, setSection] = useState<Section>("pending");

  // Sin tratar: lo que espera a que alguien monte la orden (`lib/purchaseFlow`).
  const sinTratar = purchaseRequests.filter((row) =>
    isPurchaseRequestUntreated(row.status),
  );
  const pedidas = orders.filter((order) => order.status !== "cancelled").length;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-2">
        {SECTIONS.map((item) => {
          const Icon = item.icon;
          const activo = section === item.id;
          const cuenta =
            item.id === "pending"
              ? sinTratar.length
              : item.id === "orders"
                ? pedidas
                : receptions.length;
          return (
            <Button
              key={item.id}
              type="button"
              variant={activo ? "default" : "outline"}
              className="gap-2"
              onClick={() => setSection(item.id)}
            >
              <Icon className="size-4" />
              {item.label}
              {cuenta > 0 && (
                <span
                  className={
                    activo
                      ? "rounded-full bg-background/20 px-1.5 text-xs"
                      : "rounded-full bg-muted px-1.5 text-xs"
                  }
                >
                  {cuenta}
                </span>
              )}
            </Button>
          );
        })}
      </div>

      {section === "pending" && (
        <PendingSection
          purchaseRequests={purchaseRequests}
          partRequests={partRequests}
          parts={parts}
          canManage={canManage}
        />
      )}
      {section === "orders" && (
        <OrdersSection
          orders={orders}
          receptions={receptions}
          canManage={canManage}
        />
      )}
      {section === "movements" && <MovementsSection receptions={receptions} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sin tratar: lo que hay que comprar                                  */
/* ------------------------------------------------------------------ */

function PendingSection({
  purchaseRequests,
  partRequests,
  parts,
  canManage,
}: {
  purchaseRequests: PurchaseRequestDoc[];
  partRequests: PartRequestDoc[];
  parts: PartDoc[];
  canManage: boolean;
}) {
  const requestPurchase = useMutation(api.purchasing.requestPurchase);
  const [generando, setGenerando] = useState<string | null>(null);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [ordenAbierta, setOrdenAbierta] = useState(false);

  const groups = useMemo(
    () => groupBySupplier(purchaseRequests),
    [purchaseRequests],
  );
  const sinMaterial = useMemo(
    () => requestsMissingStock(partRequests, parts, purchaseRequests),
    [partRequests, parts, purchaseRequests],
  );
  const elegidas = purchaseRequests.filter(
    (row) => isPurchaseRequestUntreated(row.status) && seleccion.has(row._id),
  );
  const proveedores = new Set(elegidas.map((row) => row.supplier));

  const alternar = (id: string) =>
    setSeleccion((actual) => {
      const next = new Set(actual);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const generar = async (request: PartRequestDoc) => {
    setGenerando(request._id);
    try {
      const { references, repeated } = await requestPurchase({
        requestId: request._id,
      });
      toast.success(
        references.length === 1
          ? `${references[0]} apartada para comprar`
          : `${references.length} peticiones de compra apartadas (${references.join(", ")})`,
        {
          description:
            repeated > 0
              ? `${repeated} línea${repeated === 1 ? "" : "s"} ya estaba${repeated === 1 ? "" : "n"} en la cola de compras.`
              : "Están sin tratar, agrupadas por proveedor.",
        },
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setGenerando(null);
    }
  };

  return (
    <div className="grid gap-5">
      {sinMaterial.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PackageCheck className="size-4 text-signal" />
              Sin material en el almacén
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Peticiones que el almacén no puede cubrir —repuestos nuevos o sin
              existencias—. Apartarlas es el primer paso para comprarlas.
            </p>
          </CardHeader>
          <CardContent className="grid gap-2">
            {sinMaterial.map(({ request, missing }) => (
              <div
                key={request._id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2"
              >
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
                {canManage && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled={generando === request._id}
                    onClick={() => void generar(request)}
                  >
                    <ShoppingCart className="size-4" />
                    Generar petición de compra
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center shadow-sm">
          <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-signal/10 text-signal">
            <ShoppingCart className="size-5" />
          </span>
          <p className="mt-4 text-base font-semibold tracking-tight">
            No hay nada pendiente de comprar
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
            Lo que el almacén no cubre aparece aquí, agrupado por proveedor, en
            cuanto el responsable aparta la línea de su petición.
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {elegidas.length === 0
              ? "Marca lo que va en la orden: se agrupa por proveedor."
              : proveedores.size > 1
                ? "Has mezclado proveedores: una orden es de uno solo."
                : `${elegidas.length} artículo${elegidas.length === 1 ? "" : "s"} para ${[...proveedores][0]}`}
          </p>
          <Button
            type="button"
            className="gap-2"
            disabled={
              !canManage || elegidas.length === 0 || proveedores.size > 1
            }
            onClick={() => setOrdenAbierta(true)}
          >
            <ClipboardList className="size-4" />
            Crear orden de compra
          </Button>
        </div>
      )}

      {groups.map((group) => (
        <Card key={group.supplier}>
          <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-2">
            <div>
              <CardTitle className="text-base">{group.supplier}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {groupSummary(group)}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                setSeleccion((actual) => {
                  const next = new Set(actual);
                  const todos = group.items.every((item) => next.has(item._id));
                  for (const item of group.items) {
                    if (todos) next.delete(item._id);
                    else next.add(item._id);
                  }
                  return next;
                })
              }
            >
              {group.items.every((item) => seleccion.has(item._id))
                ? "Quitar el grupo"
                : "Elegir el grupo"}
            </Button>
          </CardHeader>
          <CardContent className="grid gap-2">
            {group.items.map((row) => (
              <PurchaseRequestRow
                key={row._id}
                row={row}
                canManage={canManage}
                selected={seleccion.has(row._id)}
                onToggle={() => alternar(row._id)}
              />
            ))}
          </CardContent>
        </Card>
      ))}

      {ordenAbierta && (
        <CreateOrderDialog
          open={ordenAbierta}
          onOpenChange={setOrdenAbierta}
          items={elegidas}
          onCreated={() => setSeleccion(new Set())}
        />
      )}
    </div>
  );
}

/** Una petición de compra sin tratar: qué es, de dónde viene y qué se puede hacer. */
function PurchaseRequestRow({
  row,
  canManage,
  selected,
  onToggle,
}: {
  row: PurchaseRequestDoc;
  canManage: boolean;
  selected: boolean;
  onToggle: () => void;
}) {
  const setSupplier = useMutation(api.purchasing.setSupplier);
  const setNote = useMutation(api.purchasing.setNote);
  const cancelar = useMutation(api.purchasing.cancelPurchaseRequest);
  const [dialogo, setDialogo] = useState<"supplier" | "note" | "cancel" | null>(
    null,
  );
  const [texto, setTexto] = useState("");
  const [guardando, setGuardando] = useState(false);

  const abrir = (cual: "supplier" | "note" | "cancel") => {
    setTexto(
      cual === "supplier"
        ? row.supplier
        : cual === "note"
          ? (row.notes ?? "")
          : "",
    );
    setDialogo(cual);
  };

  const enviar = async () => {
    if (!dialogo) return;
    setGuardando(true);
    try {
      if (dialogo === "supplier") {
        await setSupplier({ id: row._id, supplier: texto });
        toast.success(`${row.reference}: proveedor ${texto.trim()}`);
      } else if (dialogo === "note") {
        await setNote({ id: row._id, notes: texto });
        toast.success(
          texto.trim()
            ? `${row.reference}: nota guardada`
            : `${row.reference}: nota borrada`,
        );
      } else {
        await cancelar({ id: row._id, note: texto });
        toast.success(`${row.reference} retirada de la compra`);
      }
      setDialogo(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setGuardando(false);
    }
  };

  const meta = PURCHASE_REQUEST_STATUS_META[row.status];

  return (
    <div className="flex flex-wrap items-start gap-3 rounded-lg border border-border bg-card px-3 py-2">
      {canManage && isPurchaseRequestUntreated(row.status) && (
        <Checkbox
          checked={selected}
          onCheckedChange={onToggle}
          aria-label={`Incluir ${row.reference} en la orden`}
          className="mt-1"
        />
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
      {/* Lo que ofrece la ficha sale de la máquina de la compra
          (`lib/purchaseFlow`), no del estado a pelo: antes se ofrecía «Proveedor»
          y «Retirar» también en lo ya recibido o retirado, donde el servidor las
          rechaza —se podía pulsar y comerse un error—. */}
      {canManage && (
        <div className="flex flex-wrap gap-1">
          {!isPurchaseRequestClosed(row.status) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => abrir("note")}
            >
              Nota
            </Button>
          )}
          {isPurchaseRequestUntreated(row.status) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => abrir("supplier")}
            >
              Proveedor
            </Button>
          )}
          {canAdvancePurchaseRequest(row.status, "cancel") && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => abrir("cancel")}
            >
              Retirar
            </Button>
          )}
        </div>
      )}

      <Dialog
        open={dialogo !== null}
        onOpenChange={(open) => !open && setDialogo(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogo === "supplier"
                ? `Proveedor de ${row.reference}`
                : dialogo === "note"
                  ? `Nota de ${row.reference}`
                  : `Retirar ${row.reference}`}
            </DialogTitle>
            <DialogDescription>
              {dialogo === "supplier"
                ? "Con este nombre se agrupa la compra: es la clave de la orden."
                : dialogo === "note"
                  ? "Queda en la ficha de la compra y viaja al artículo de la orden."
                  : "Se retira de la compra. Lo que esté ya en una orden se quita desde la orden."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={`campo-${row._id}`}>
              {dialogo === "supplier"
                ? "Proveedor"
                : dialogo === "note"
                  ? "Nota"
                  : "Motivo"}
            </Label>
            {dialogo === "supplier" ? (
              <Input
                id={`campo-${row._id}`}
                value={texto}
                onChange={(event) => setTexto(event.target.value)}
                autoFocus
              />
            ) : (
              <Textarea
                id={`campo-${row._id}`}
                value={texto}
                onChange={(event) => setTexto(event.target.value)}
                rows={3}
                autoFocus
              />
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogo(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={guardando || (dialogo !== "note" && !texto.trim())}
              onClick={() => void enviar()}
            >
              {dialogo === "cancel" ? "Retirar" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Monta la orden con lo elegido: notas de la orden y nota de cada artículo. */
function CreateOrderDialog({
  open,
  onOpenChange,
  items,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: PurchaseRequestDoc[];
  onCreated: () => void;
}) {
  const crear = useMutation(api.purchasing.createOrder);
  const [notes, setNotes] = useState("");
  const [lineNotes, setLineNotes] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const supplier = items[0]?.supplier ?? "";

  const enviar = async () => {
    setGuardando(true);
    try {
      const { reference } = await crear({
        purchaseRequestIds: items.map((row) => row._id),
        ...(notes.trim() ? { notes } : {}),
        ...(Object.values(lineNotes).some((value) => value.trim())
          ? { lineNotes }
          : {}),
      });
      toast.success(`Orden ${reference} creada`, {
        description: `${items.length} artículo${items.length === 1 ? "" : "s"} para ${supplier}.`,
      });
      onCreated();
      setNotes("");
      setLineNotes({});
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Orden de compra · {supplier}</DialogTitle>
          <DialogDescription>
            Se manda con la fecha de hoy y su número; cada artículo dice de qué
            petición sale. Las notas son para ti y para el proveedor.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="orden-notas">Notas de la orden</Label>
            <Textarea
              id="orden-notas"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              placeholder="Plazo de entrega, forma de pago, quién la autoriza..."
            />
          </div>
          <div className="grid gap-2">
            <Label>Artículos</Label>
            {items.map((row) => (
              <div
                key={row._id}
                className="grid gap-1 rounded-lg border border-border px-3 py-2"
              >
                <p className="text-sm font-medium">
                  {row.code} · {row.name} — {row.quantity} {row.unit}
                </p>
                <p className="text-xs text-muted-foreground">
                  Desde {row.requestReference} · {formatDate(row.requestDate)}
                </p>
                <Input
                  value={lineNotes[row._id] ?? ""}
                  onChange={(event) =>
                    setLineNotes((actual) => ({
                      ...actual,
                      [row._id]: event.target.value,
                    }))
                  }
                  placeholder="Nota de este artículo"
                />
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={guardando}
            onClick={() => void enviar()}
          >
            Crear la orden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Órdenes de compra                                                   */
/* ------------------------------------------------------------------ */

function OrdersSection({
  orders,
  receptions,
  canManage,
}: {
  orders: PurchaseOrderDoc[];
  receptions: ReceptionDoc[];
  canManage: boolean;
}) {
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
            ? `${returned} petición${returned === 1 ? "" : "es"} de compra vuelven a la cola.`
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
        // Lo que ya no se puede hacer con esta orden, con su motivo: recepcionar
        // y anular salen de la máquina (`lib/purchaseFlow`), y una orden cerrada
        // los explica en vez de esconderlos sin decir por qué.
        const blocked = canManage
          ? blockedPurchaseOrderSteps(order.status)
          : [];
        return (
          <Card key={order._id}>
            <CardContent className="grid gap-3 pt-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    {order.reference}
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
              {blocked.length > 0 && (
                <BlockedSteps
                  groups={blocked.map((group) => ({
                    label: group.actions
                      .map((action) => PURCHASE_ORDER_STEP_LABELS[action])
                      .join(", "),
                    reason: group.reason,
                  }))}
                />
              )}
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

/** La orden entera: sus artículos, sus notas y lo que ha entrado. */
function OrderSheet({
  order,
  receptions,
  canManage,
  onClose,
  onReceive,
}: {
  order: PurchaseOrderDoc;
  receptions: ReceptionDoc[];
  canManage: boolean;
  onClose: () => void;
  onReceive: () => void;
}) {
  const setLineNote = useMutation(api.purchasing.setLineNote);
  const [editando, setEditando] = useState<string | null>(null);
  const [nota, setNota] = useState("");
  const meta = PURCHASE_ORDER_STATUS_META[order.status];
  const total = orderTotals(order);

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

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {order.reference}
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

          {canManage && canAdvancePurchaseOrder(order.status, "receive") && (
            <Button type="button" className="gap-2" onClick={onReceive}>
              <Truck className="size-4" />
              Recepcionar material
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** La entrada de material: lo que ha llegado y el albarán que lo respalda. */
function ReceiveDialog({
  open,
  onOpenChange,
  order,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: PurchaseOrderDoc;
}) {
  const recibir = useMutation(api.purchasing.receive);
  const generateUploadUrl = useMutation(api.purchasing.generateUploadUrl);
  const [cantidades, setCantidades] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      order.lines
        .filter((line) => pendingQuantity(line) > 0)
        .map((line) => [line.purchaseRequestId, String(pendingQuantity(line))]),
    ),
  );
  const [nota, setNota] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    if (!archivo) {
      toast.error("Adjunta el albarán de entrega: sin él no se da la entrada.");
      return;
    }
    setEnviando(true);
    try {
      const items = Object.entries(cantidades)
        .map(([purchaseRequestId, valor]) => ({
          purchaseRequestId: purchaseRequestId as Id<"purchaseRequests">,
          quantity: Number(valor),
        }))
        .filter((item) => Number.isFinite(item.quantity) && item.quantity > 0);
      if (items.length === 0) {
        toast.error("Escribe cuánto ha llegado.");
        return;
      }
      const file = await compressForUpload(archivo);
      const storageId = await uploadToStorage(await generateUploadUrl(), file);
      const resultado = await recibir({
        orderId: order._id,
        items,
        deliveryNote: {
          storageId,
          name: archivo.name,
          kind: archivo.type.startsWith("image/") ? "image" : "document",
        },
        ...(nota.trim() ? { note: nota } : {}),
      });
      toast.success(
        resultado.status === "completed"
          ? `Orden ${order.reference} completada`
          : `Orden ${order.reference} parcial`,
        {
          description:
            resultado.materialReceived.length > 0
              ? `Material recibido: ${resultado.materialReceived.join(", ")} ya se puede entregar.`
              : "El material ha entrado en el almacén.",
        },
      );
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Recepcionar {order.reference}</DialogTitle>
          <DialogDescription>
            Lo que ha llegado ahora. El albarán de entrega es obligatorio: es el
            papel que respalda la entrada.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {order.lines
            .filter((line) => pendingQuantity(line) > 0)
            .map((line) => (
              <div key={line.purchaseRequestId} className="grid gap-1">
                <Label htmlFor={`cantidad-${line.purchaseRequestId}`}>
                  {line.code} · {line.name} — faltan {pendingQuantity(line)}{" "}
                  {line.unit}
                </Label>
                <Input
                  id={`cantidad-${line.purchaseRequestId}`}
                  type="number"
                  min={0}
                  max={pendingQuantity(line)}
                  value={cantidades[line.purchaseRequestId] ?? ""}
                  onChange={(event) =>
                    setCantidades((actual) => ({
                      ...actual,
                      [line.purchaseRequestId]: event.target.value,
                    }))
                  }
                />
              </div>
            ))}

          <div className="grid gap-2">
            <Label htmlFor="albaran">Albarán de entrega</Label>
            <Input
              id="albaran"
              type="file"
              accept={FILE_ACCEPT}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                if (file && exceedsFileLimit(file)) {
                  toast.error(
                    `El albarán no puede pasar de ${MAX_FILE_SIZE_LABEL}.`,
                  );
                  return;
                }
                setArchivo(file);
              }}
            />
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Upload className="size-3" />
              Foto o PDF del albarán del proveedor.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="nota-recepcion">Nota</Label>
            <Textarea
              id="nota-recepcion"
              value={nota}
              onChange={(event) => setNota(event.target.value)}
              rows={2}
              placeholder="Falta una caja, el embalaje venía abierto..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="gap-2"
            disabled={enviando || !archivo}
            onClick={() => void enviar()}
          >
            <Truck className="size-4" />
            Dar entrada
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Movimientos de recepción                                            */
/* ------------------------------------------------------------------ */

function MovementsSection({ receptions }: { receptions: ReceptionDoc[] }) {
  if (receptions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center shadow-sm">
        <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-signal/10 text-signal">
          <Truck className="size-5" />
        </span>
        <p className="mt-4 text-base font-semibold tracking-tight">
          No ha entrado material todavía
        </p>
        <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
          Cada entrada de un proveedor deja aquí su movimiento con el albarán
          adjunto, y es lo que mete el stock en el almacén.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {receptions.map((row) => (
        <Card key={row._id}>
          <CardContent className="grid gap-2 pt-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">
                {row.orderReference} · {row.supplier}
              </p>
              <span className="text-xs text-muted-foreground">
                {formatDateTime(row.receivedAt)} · {row.receivedBy}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {row.lines
                .map((line) => `${line.code} · ${line.name} × ${line.quantity}`)
                .join(" · ")}
            </p>
            {row.note && (
              <p className="text-xs text-muted-foreground">{row.note}</p>
            )}
            {row.deliveryNoteUrl ? (
              <a
                href={row.deliveryNoteUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-fit items-center gap-1 text-xs text-signal underline"
              >
                <FileText className="size-3" />
                {row.deliveryNote.name}
              </a>
            ) : (
              <span className="text-xs text-muted-foreground">
                {row.deliveryNote.name} (ya no está disponible)
              </span>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
