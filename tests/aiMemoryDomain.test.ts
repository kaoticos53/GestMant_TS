import { describe, expect, test } from "vitest";
import {
  compactChatTurns,
  expandWorkshopQuery,
  formatEquipmentChunk,
  formatIncidentChunk,
  formatMailChunk,
  formatPartChunk,
  planMemoryChunkDiff,
  rankMemoryChunks,
  reciprocalRankFusion,
  type ExistingMemoryChunk,
  type MemoryChunkDraft,
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

  test("planMemoryChunkDiff calcula altas, actualizaciones, bajas y preservación de embeddings", () => {
    const draftBase: MemoryChunkDraft = {
      scope: "shared",
      module: "incidents",
      entityId: "inc-1",
      reference: "INC-0001",
      title: "Compresor",
      compactText: "[INC-0001 | reported] Compresor GA-15",
      tags: ["reported"],
    };
    const draftTagsOnly: MemoryChunkDraft = {
      scope: "shared",
      module: "equipment",
      entityId: "eq-1",
      reference: "EQ-001",
      title: "Cámara HD",
      compactText: "[EQ-001 | Activo] Cámara",
      tags: ["Sony", "Actualizada"],
    };
    const draftChangedText: MemoryChunkDraft = {
      scope: "shared",
      module: "parts",
      entityId: "part-1",
      reference: "REP-001",
      title: "Fusible",
      compactText: "[REP-001 | Agotado: 0/2 ud] Fusible 10A",
      tags: ["Agotado"],
    };
    const draftNew: MemoryChunkDraft = {
      scope: "shared",
      module: "manuals",
      entityId: "man-1",
      reference: "man-1",
      title: "Manual GA-15",
      compactText: "[Manual | Servicio] Manual GA-15",
      tags: ["Servicio"],
    };

    const existing: ExistingMemoryChunk[] = [
      { _id: "id-1", ...draftBase, embedding: [0.1, 0.2] },
      // Duplicado previo de la misma clave: el segundo debe ir a toDelete
      { _id: "id-1-dup", ...draftBase },
      {
        _id: "id-2",
        ...draftTagsOnly,
        tags: ["Sony"],
        embedding: [0.3, 0.4],
      },
      {
        _id: "id-3",
        ...draftChangedText,
        compactText: "[REP-001 | OK: 5/2 ud] Fusible 10A",
        embedding: [0.5, 0.6],
      },
      {
        _id: "id-obsolete",
        scope: "shared",
        module: "requests",
        entityId: "req-9",
        reference: "PET-0009",
        title: "Obsoleta",
        compactText: "[PET-0009] Obsoleta",
        tags: [],
      },
    ];

    const plan = planMemoryChunkDiff(existing, [
      draftBase,
      draftTagsOnly,
      draftChangedText,
      draftNew,
    ]);

    expect(plan.unchanged).toBe(1);
    expect(plan.toInsert).toEqual([draftNew]);
    expect(plan.toDelete).toEqual(["id-1-dup", "id-obsolete"]);
    expect(plan.toPatch).toEqual([
      { id: "id-2", draft: draftTagsOnly, clearEmbedding: false },
      { id: "id-3", draft: draftChangedText, clearEmbedding: true },
    ]);

    const clean = planMemoryChunkDiff(
      [{ _id: "id-a", ...draftBase, embedding: [0.9] }],
      [draftBase],
    );
    expect(clean).toEqual({
      toInsert: [],
      toPatch: [],
      toDelete: [],
      unchanged: 1,
    });
  });
});
