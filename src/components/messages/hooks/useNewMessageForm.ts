import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { richDocIsEmpty, richDocToPlainText } from "@/lib/richDoc";
import { getErrorMessage } from "@/lib/workshop";
import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { MAX_MESSAGE_TEXT, type Contact } from "../types";

export interface UseNewMessageFormOptions {
  contacts: readonly Contact[];
  onSent: (userId: Id<"users">, name: string) => void;
}

/**
 * Hook para gestionar el formulario de inicio de una nueva conversación:
 * - Selección del destinatario.
 * - Validación de contenido enriquecido y límite de caracteres.
 * - Mutación de envío y notificación de éxito.
 */
export function useNewMessageForm({
  contacts,
  onSent,
}: UseNewMessageFormOptions) {
  const send = useMutation(api.messages.send);
  const [recipientId, setRecipientId] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plainText = richDocToPlainText(text);
  const canSubmit =
    !richDocIsEmpty(text) && plainText.length <= MAX_MESSAGE_TEXT;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!recipientId) {
      setError("Elige a quién quieres escribir.");
      return;
    }
    if (richDocIsEmpty(text)) {
      setError("Escribe un mensaje antes de enviarlo.");
      return;
    }
    if (plainText.length > MAX_MESSAGE_TEXT) {
      setError(
        `Los mensajes no pueden superar los ${MAX_MESSAGE_TEXT} caracteres.`,
      );
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await send({ recipientId: recipientId as Id<"users">, text });
      const contact = contacts.find((item) => item._id === recipientId);
      toast.success("Mensaje enviado");
      onSent(recipientId as Id<"users">, contact?.name ?? "Contacto");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return {
    recipientId,
    setRecipientId,
    text,
    setText,
    busy,
    error,
    canSubmit,
    handleSubmit,
  };
}
