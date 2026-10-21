import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { ClipboardList, PackageCheck, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import {
  PURCHASE_REASON_META,
  PURCHASE_REQUEST_STATUS_META,
  groupBySupplier,
  groupSummary,
  requestsMissingStock,
  type PurchaseRequestDoc,
} from "@/lib/purchasing";
import {
  canAdvancePurchaseRequest,
  isPurchaseRequestClosed,
  isPurchaseRequestUntreated,
} from "@/lib/purchaseFlow";
import { formatDate, getErrorMessage } from "@/lib/workshop";
import { CreateOrderDialog } from "../dialogs/CreateOrderDialog";
import type { PartDoc, PartRequestDoc } from "../types";

export interface PendingSectionProps {
  purchaseRequests: PurchaseRequestDoc[];
  partRequests: PartRequestDoc[];
  parts: PartDoc[];
  canManage: boolean;
}

export function PendingSection({
  purchaseRequests,
  partRequests,
  parts,
  canManage,
}: PendingSectionProps) {
  const requestPurchase = useMutation(api.purchasing.requestPurchase);
  const requestPurchases = useMutation(api.purchasing.requestPurchases);
  const [generando, setGenerando] = useState<string | null>(null);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [ordenAbierta, setOrdenAbierta] = useState(false);
  // Lo marcado en «Sin material»: apartar de una en una era el cuello de botella
  // de la compra del día —nueve clics para nueve líneas—.
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [apartando, setApartando] = useState(false);

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

  const marcadasSinMaterial = sinMaterial.filter(({ request }) =>
    marcadas.has(request._id),
  );
  const todasMarcadas =
    sinMaterial.length > 0 && marcadasSinMaterial.length === sinMaterial.length;

  const alternarSinMaterial = (id: string) =>
    setMarcadas((actual) => {
      const next = new Set(actual);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /**
   * Aparta de una vez todo lo marcado. Lo que la máquina no deja —una petición
   * que ya se resolvió mientras se miraba la pantalla, o cuya compra ya estaba
   * en marcha— vuelve con su motivo y se dice, en vez de perderse.
   */
  const apartarMarcadas = async () => {
    const ids = marcadasSinMaterial.map(({ request }) => request._id);
    if (ids.length === 0) return;
    setApartando(true);
    try {
      const { references, requests, repeated, skipped } =
        await requestPurchases({ requestIds: ids });
      const fuera = skipped
        .map((row) => `${row.reference}: ${row.reason}`)
        .join(" · ");
      if (references.length === 0) {
        toast.warning("No se apartó nada", { description: fuera });
      } else {
        toast.success(
          `${requests} ${requests === 1 ? "petición apartada" : "peticiones apartadas"} para comprar`,
          {
            description: [
              references.length === 1
                ? references[0]
                : `${references.length} líneas: ${references.join(", ")}`,
              repeated > 0
                ? `${repeated} ya estaba${repeated === 1 ? "" : "n"} en camino`
                : "",
              fuera ? `Sin apartar — ${fuera}` : "",
            ]
              .filter(Boolean)
              .join(" · "),
          },
        );
      }
      setMarcadas(new Set());
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setApartando(false);
    }
  };

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
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <PackageCheck className="size-4 text-signal" />
                Sin material en el almacén
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Peticiones que el almacén no puede cubrir —repuestos nuevos o
                sin existencias—. Apartarlas es el primer paso para comprarlas.
              </p>
            </div>
            {canManage && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setMarcadas(
                      todasMarcadas
                        ? new Set()
                        : new Set(
                            sinMaterial.map(({ request }) => request._id),
                          ),
                    )
                  }
                >
                  {todasMarcadas ? "Quitar todas" : "Marcar todas"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="gap-2"
                  disabled={apartando || marcadasSinMaterial.length === 0}
                  onClick={() => void apartarMarcadas()}
                >
                  <ShoppingCart className="size-4" />
                  {marcadasSinMaterial.length === 0
                    ? "Apartar las marcadas"
                    : `Apartar ${marcadasSinMaterial.length} ${
                        marcadasSinMaterial.length === 1
                          ? "petición"
                          : "peticiones"
                      }`}
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="grid gap-2">
            {sinMaterial.map(({ request, missing }) => (
              <div
                key={request._id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2"
              >
                <div className="flex min-w-0 items-start gap-3">
                  {canManage && (
                    <Checkbox
                      checked={marcadas.has(request._id)}
                      onCheckedChange={() => alternarSinMaterial(request._id)}
                      aria-label={`Incluir ${request.reference} en la compra`}
                      className="mt-1"
                    />
                  )}
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
