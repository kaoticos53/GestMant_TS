import { Truck } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import type { PurchaseOrderDoc } from "@/lib/purchasing";
import {
  ReceiveDeliveryNoteInput,
  ReceiveLinesInputs,
  useReceiveDialogForm,
} from "./receive";

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
  const {
    cantidades,
    setCantidad,
    nota,
    setNota,
    archivo,
    setArchivo,
    enviando,
    enviar,
  } = useReceiveDialogForm({
    order,
    onSuccess: () => onOpenChange(false),
  });

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
          <ReceiveLinesInputs
            lines={order.lines}
            cantidades={cantidades}
            onChangeCantidad={setCantidad}
            disabled={enviando}
          />

          <ReceiveDeliveryNoteInput
            archivo={archivo}
            onSelectArchivo={setArchivo}
            disabled={enviando}
          />

          <div className="grid gap-2">
            <Label htmlFor="nota-recepcion">Nota</Label>
            <Textarea
              id="nota-recepcion"
              value={nota}
              onChange={(event) => setNota(event.target.value)}
              rows={2}
              placeholder="Falta una caja, el embalaje venía abierto..."
              disabled={enviando}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={enviando}
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
            {enviando ? "Dando entrada..." : "Dar entrada"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
