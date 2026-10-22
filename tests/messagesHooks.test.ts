import {
  calculateMessageThreads,
  calculateUnreadTotal,
} from "@/components/messages/hooks/useMessageThreads";
import type { MessageSummaryItem } from "@/components/messages/types";
import { describe, expect, it } from "vitest";

describe("calculateUnreadTotal", () => {
  it("devuelve 0 si no hay usuario autenticado", () => {
    const items: MessageSummaryItem[] = [
      {
        _id: "m1",
        senderId: "u2",
        recipientId: "u1",
        senderName: "Iván",
        recipientName: "Elena",
        text: "Hola",
        read: false,
        createdAt: 1000,
      },
    ];
    expect(calculateUnreadTotal(items, undefined)).toBe(0);
  });

  it("cuenta únicamente los mensajes no leídos donde el usuario actual es el destinatario", () => {
    const items: MessageSummaryItem[] = [
      {
        _id: "m1",
        senderId: "u2",
        recipientId: "u1",
        senderName: "Iván",
        recipientName: "Elena",
        text: "Hola 1",
        read: false,
        createdAt: 1000,
      },
      {
        _id: "m2",
        senderId: "u1",
        recipientId: "u2",
        senderName: "Elena",
        recipientName: "Iván",
        text: "Respuesta",
        read: false, // Enviado por mí pero no leído por el otro: no debe contar para mí
        createdAt: 2000,
      },
      {
        _id: "m3",
        senderId: "u3",
        recipientId: "u1",
        senderName: "Carlos",
        recipientName: "Elena",
        text: "Hola 2",
        read: true, // Ya leído por mí
        createdAt: 3000,
      },
      {
        _id: "m4",
        senderId: "u3",
        recipientId: "u1",
        senderName: "Carlos",
        recipientName: "Elena",
        text: "Hola 3",
        read: false,
        createdAt: 4000,
      },
    ];

    expect(calculateUnreadTotal(items, "u1")).toBe(2);
  });
});

describe("calculateMessageThreads", () => {
  it("devuelve array vacío si no hay usuario autenticado o no hay mensajes", () => {
    expect(calculateMessageThreads([], "u1")).toEqual([]);
    expect(calculateMessageThreads([], undefined)).toEqual([]);
  });

  it("agrupa los mensajes por interlocutor y preserva el más reciente como resumen", () => {
    // Supongamos mensajes ordenados descendentemente por createdAt (comportamiento Convex)
    const items: MessageSummaryItem[] = [
      {
        _id: "m3",
        senderId: "u2",
        recipientId: "u1",
        senderName: "Iván Torres",
        recipientName: "Elena Vidal",
        text: "¿Pudiste revisar el equipo?",
        read: false,
        createdAt: 3000,
      },
      {
        _id: "m2",
        senderId: "u3",
        recipientId: "u1",
        senderName: "Lucía Gómez",
        recipientName: "Elena Vidal",
        text: "Pedido recibido",
        read: true,
        createdAt: 2000,
      },
      {
        _id: "m1",
        senderId: "u1",
        recipientId: "u2",
        senderName: "Elena Vidal",
        recipientName: "Iván Torres",
        text: "Hola Iván",
        read: true,
        createdAt: 1000,
      },
    ];

    const threads = calculateMessageThreads(items, "u1");

    expect(threads).toHaveLength(2);

    // Primer hilo: Iván Torres (u2), con 1 mensaje sin leer y preview del mensaje más reciente (m3)
    expect(threads[0]).toEqual({
      userId: "u2",
      name: "Iván Torres",
      preview: "¿Pudiste revisar el equipo?",
      at: 3000,
      unread: 1,
    });

    // Segundo hilo: Lucía Gómez (u3), con 0 no leídos
    expect(threads[1]).toEqual({
      userId: "u3",
      name: "Lucía Gómez",
      preview: "Pedido recibido",
      at: 2000,
      unread: 0,
    });
  });

  it("acumula los no leídos múltiples de una misma conversación", () => {
    const items: MessageSummaryItem[] = [
      {
        _id: "m2",
        senderId: "u2",
        recipientId: "u1",
        senderName: "Iván",
        recipientName: "Elena",
        text: "Segundo mensaje",
        read: false,
        createdAt: 2000,
      },
      {
        _id: "m1",
        senderId: "u2",
        recipientId: "u1",
        senderName: "Iván",
        recipientName: "Elena",
        text: "Primer mensaje",
        read: false,
        createdAt: 1000,
      },
    ];

    const threads = calculateMessageThreads(items, "u1");
    expect(threads).toHaveLength(1);
    expect(threads[0].unread).toBe(2);
    expect(threads[0].preview).toBe("Segundo mensaje");
  });
});
