import { describe, expect, test } from "vitest";
import {
  compactChatTurns,
  expandWorkshopQuery,
  formatEquipmentChunk,
  formatIncidentChunk,
  formatMailChunk,
  formatPartChunk,
  rankMemoryChunks,
  reciprocalRankFusion,
} from "../src/lib/ai/memory";

describe("ai/memory (Fase 1)", () => {
  test("construye chunks compactos para incidencias, equipos, repuestos y correos", () => {
    const inc = formatIncidentChunk({
      id: "inc-1",
      reference: "INC-0012",
      status: "resolved",
      severity: "high",
      equipmentKind: "Compresor",
      model: "GA-15",
      serialNumber: "SN998",
      description: "<p>Pérdida de presión en válvula principal</p>",
      resolution: "Cambio de junta tórica",
    });
    expect(inc.compactText).toContain("INC-0012");
    expect(inc.compactText).toContain("SN:SN998");
    expect(inc.compactText).not.toContain("<p>");

    const eq = formatEquipmentChunk({
      id: "eq-1",
      code: "EQ-001",
      name: "Compresor Atlas",
      model: "GA-15",
      serialNumber: "8821",
    });
    expect(eq.compactText).toContain("S/N:8821");

    const part = formatPartChunk({
      id: "p-1",
      code: "REP-001",
      name: "Junta K12",
      category: "Juntas",
      stock: 0,
      minStock: 2,
      unit: "ud",
    });
    expect(part.compactText).toContain("Agotado");

    const mail = formatMailChunk({
      messageId: "m-1",
      subject: "Pedido filtros",
      fromName: "Ana",
      fromAddress: "ana@prov.es",
      snippet: "Adjunto albarán",
      tags: ["purchasing"],
    });
    expect(mail.scope).toBe("mailbox");
    expect(mail.compactText).toContain("purchasing");
  });

  test("expande sinónimos técnicos y rankea por BM25", () => {
    const expanded = expandWorkshopQuery("fuga en compresor");
    expect(expanded).toContain("perdida");

    const chunks = [
      {
        entityId: "1",
        compactText: "[INC-0001] Pérdida de presión en compresor Atlas",
      },
      {
        entityId: "2",
        compactText: "[REP-002] Bombilla halógena 24V",
      },
    ];
    const ranked = rankMemoryChunks(chunks, "fuga compresor");
    expect(ranked[0]?.entityId).toBe("1");
  });

  test("combina rankings con Reciprocal Rank Fusion y comprime turnos antiguos", () => {
    const fused = reciprocalRankFusion(
      [
        [{ entityId: "a" }, { entityId: "b" }],
        [{ entityId: "b" }, { entityId: "c" }],
      ],
      3,
    );
    expect(fused.map((x) => x.entityId)).toEqual(["b", "a", "c"]);

    const history = Array.from({ length: 7 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `Mensaje número ${i + 1}`,
    }));
    const compacted = compactChatTurns(history, 4);
    expect(compacted).toHaveLength(5);
    expect(compacted[0]?.content).toContain("Resumen de turnos previos");
    expect(compacted[4]?.content).toBe("Mensaje número 7");
  });
});
