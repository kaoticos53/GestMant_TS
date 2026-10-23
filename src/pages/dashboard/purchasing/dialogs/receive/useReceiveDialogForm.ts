import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { compressForUpload, uploadToStorage } from "@/lib/upload";
import { getErrorMessage } from "@/lib/workshop";
import {
  buildInitialQuantities,
  parseReceivedItems,
  validateReceiveInput,
} from "./helpers";
import type { UseReceiveDialogFormProps } from "./types";

export function useReceiveDialogForm({
  order,
  onSuccess,
}: UseReceiveDialogFormProps) {
  const recibir = useMutation(api.purchasing.receive);
  const generateUploadUrl = useMutation(api.purchasing.generateUploadUrl);

  const [cantidades, setCantidades] = useState<Record<string, string>>(() =>
    buildInitialQuantities(order.lines),
  );
  const [nota, setNota] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);

  const setCantidad = (purchaseRequestId: string, value: string) => {
    setCantidades((actual) => ({
      ...actual,
      [purchaseRequestId]: value,
    }));
  };

  const enviar = async () => {
    const items = parseReceivedItems(cantidades);
    const validationError = validateReceiveInput(archivo, items);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setEnviando(true);
    try {
      const file = await compressForUpload(archivo!);
      const storageId = await uploadToStorage(await generateUploadUrl(), file);
      const resultado = await recibir({
        orderId: order._id,
        items,
        deliveryNote: {
          storageId,
          name: archivo!.name,
          kind: archivo!.type.startsWith("image/") ? "image" : "document",
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
      onSuccess();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setEnviando(false);
    }
  };

  return {
    cantidades,
    setCantidad,
    nota,
    setNota,
    archivo,
    setArchivo,
    enviando,
    enviar,
  };
}
