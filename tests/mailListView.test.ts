import { describe, expect, test } from "vitest";
import {
  groupMailHeadersByConversation,
  sortMailHeaders,
  type MailHeaderSortable,
} from "../src/lib/mailClient/listView";

const SAMPLES: MailHeaderSortable[] = [
  {
    messageId: "m-1",
    conversationId: "conv-a",
    subject: "Re: Presupuesto compresor",
    fromName: "Carlos",
    fromAddress: "carlos@taller.es",
    date: 100,
    flags: "",
    hasAttachments: false,
    tags: ["purchasing"],
  },
  {
    messageId: "m-2",
    conversationId: "conv-a",
    subject: "Re: Presupuesto compresor",
    fromName: "Ana",
    fromAddress: "ana@prov.es",
    date: 300,
    flags: "u",
    hasAttachments: true,
    tags: ["equipment"],
  },
  {
    messageId: "m-3",
    conversationId: "conv-b",
    subject: "Avería torno CNC",
    fromName: "Beto",
    fromAddress: "beto@taller.es",
    date: 200,
    flags: "",
    hasAttachments: false,
    tags: ["incidents"],
  },
];

describe("mailClient/listView — ordenación y agrupación por conversaciones", () => {
  test("ordena por fecha, remitente, asunto y adjuntos en ambos sentidos", () => {
    expect(
      sortMailHeaders(SAMPLES, "date", "desc").map((m) => m.messageId),
    ).toEqual(["m-2", "m-3", "m-1"]);

    expect(
      sortMailHeaders(SAMPLES, "sender", "asc").map((m) => m.messageId),
    ).toEqual(["m-2", "m-3", "m-1"]);

    expect(
      sortMailHeaders(SAMPLES, "subject", "asc").map((m) => m.messageId),
    ).toEqual(["m-3", "m-2", "m-1"]);

    expect(
      sortMailHeaders(SAMPLES, "attachments", "desc")[0]?.messageId,
    ).toBe("m-2");
  });

  test("agrupa por conversationId manteniendo el más reciente y combinando adjuntos/tags/no leído", () => {
    const grouped = groupMailHeadersByConversation(SAMPLES);
    expect(grouped).toHaveLength(2);

    const convA = grouped.find((g) => g.conversationId === "conv-a");
    expect(convA?.messageId).toBe("m-2");
    expect(convA?.threadCount).toBe(2);
    expect(convA?.hasAttachments).toBe(true);
    expect(convA?.flags).toContain("u");
    expect(convA?.tags).toEqual(["equipment", "purchasing"]);

    const convB = grouped.find((g) => g.conversationId === "conv-b");
    expect(convB?.threadCount).toBe(1);
  });
});
