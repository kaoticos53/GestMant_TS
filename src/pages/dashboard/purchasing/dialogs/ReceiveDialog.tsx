import { useState } from "react";
import { useMutation } from "convex/react";
import { Truck, Upload } from "lucide-react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  FILE_ACCEPT,
  MAX_FILE_SIZE_LABEL,
  compressForUpload,
  exceedsFileLimit,
  uploadToStorage,
} from "@/lib/upload";
import { pendingQuantity, type PurchaseOrderDoc } from "@/lib/purchasing";
import { getErrorMessage } from "@/lib/workshop";

export interface ReceiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: PurchaseOrderDoc;
}

/** La entrada de material: lo que ha llegado y el albarán que lo respalda. */
export function ReceiveDialog({
  open,
  onOpenChange,
  order,
}: ReceiveDialogProps) {
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
