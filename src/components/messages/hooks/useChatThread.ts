import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/hooks/use-auth";
import { richDocIsEmpty, richDocToPlainText } from "@/lib/richDoc";
import { getErrorMessage } from "@/lib/workshop";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MAX_MESSAGE_TEXT, type Contact } from "../types";

export interface UseChatThreadOptions {
  threadId: Id<"users">;
  threadName: string;
  contacts: readonly Contact[];
}

/**
 * Hook que gestiona el ciclo de vida de una conversación directa:
 * - Carga en tiempo real de mensajes del hilo.
 * - Marcado de lectura automático en background.
 * - Auto-scroll hacia abajo al recibir nuevos mensajes.
 * - Validación y envío de mensajes enriquecidos.
 */
export function useChatThread({
  threadId,
  threadName,
  contacts,
}: UseChatThreadOptions) {
  const { user } = useAuth();
  const messages = useQuery(
    api.messages.thread,
    threadId ? { userId: threadId } : "skip",
  );
  const send = useMutation(api.messages.send);
  const markThreadRead = useMutation(api.messages.markThreadRead);

  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const plainText = richDocToPlainText(text);
  const canSubmit =
    !richDocIsEmpty(text) && plainText.length <= MAX_MESSAGE_TEXT;

  const meId = user?._id;
  const resolvedName =
    contacts.find((contact) => contact._id === threadId)?.name ?? threadName;

  // Al abrir y ante cada mensaje entrante, se marca el hilo como leído
  useEffect(() => {
    void markThreadRead({ userId: threadId }).catch((error) => {
      console.warn("No se pudo marcar el hilo como leído:", error);
    });
  }, [threadId, messages?.length, markThreadRead]);

  // Auto-scroll al final del contenedor cuando cambia la longitud del hilo
  useEffect(() => {
    const element = listRef.current;
    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  }, [messages?.length]);

  const handleSend = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    setBusy(true);
    try {
      await send({ recipientId: threadId, text });
      setText("");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return {
    messages,
    meId,
    resolvedName,
    text,
    setText,
    busy,
    canSubmit,
    listRef,
    handleSend,
  };
}
