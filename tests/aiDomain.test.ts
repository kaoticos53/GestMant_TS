import { describe, expect, test } from "vitest";
import {
  AI_MAX_CALLS_PER_USER_HOUR,
  AI_MAX_IMAGE_DATA_URL_BYTES,
  admitAiUsage,
  buildEquipmentLabelMessages,
  buildIncidentQaMessages,
  matchCatalogEquipmentModel,
  parseEquipmentLabelResponse,
  parseIncidentQaResponse,
} from "../src/lib/ai";

describe("Fase 1 TDD — Dominio puro de IA (src/lib/ai)", () => {
  test("admitAiUsage respeta el límite horario por usuario", () => {
    expect(admitAiUsage(0).allowed).toBe(true);
    expect(admitAiUsage(AI_MAX_CALLS_PER_USER_HOUR - 1).allowed).toBe(true);
    const blocked = admitAiUsage(AI_MAX_CALLS_PER_USER_HOUR);
    expect(blocked.allowed).toBe(false);
    expect(blocked.error).toContain("límite");
  });

  test("parseEquipmentLabelResponse limpia ruido, maneja campos ausentes y deduplica alternativas", () => {
    const parsed = parseEquipmentLabelResponse(
      JSON.stringify({
        brand: "  SL POWER ELECTRONICS CORP. ",
        model: "MODEL(型号): MW155RA2400F02 ",
        serialNumber: "   ",
        equipmentKind: "Fuente de alimentación",
        confidence: "high",
        evidence: "MODEL(型号): MW155RA2400F02",
        alternatives: [
          "MW155RA2400F02",
          " SATELLITE A200-1C0 ",
          "PSAE0E-02400DSP",
          "PSAE0E-02400DSP",
        ],
        warnings: ["No se encontró número de serie en la etiqueta"],
      }),
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.brand).toBe("SL POWER ELECTRONICS CORP.");
    expect(parsed.value.model).toBe("MW155RA2400F02");
    expect(parsed.value.serialNumber).toBeUndefined();
    expect(parsed.value.confidence).toBe("high");
    expect(parsed.value.alternatives).toEqual([
      "SATELLITE A200-1C0",
      "PSAE0E-02400DSP",
    ]);
    expect(parsed.value.warnings).toEqual([
      "No se encontró número de serie en la etiqueta",
    ]);
  });

  test("parseEquipmentLabelResponse rechaza JSON inválido o sin estructura de objeto", () => {
    expect(parseEquipmentLabelResponse("no es json").ok).toBe(false);
    expect(parseEquipmentLabelResponse("[]").ok).toBe(false);
    expect(
      parseEquipmentLabelResponse(JSON.stringify({ confidence: "invalid" })).ok,
    ).toBe(false);
  });

  test("matchCatalogEquipmentModel detecta coincidencia en el catálogo del taller", () => {
    const catalog = [
      { model: "OPM-4250", brand: "Orion PDP", equipmentKind: "Monitor" },
      { model: "50UM7600PLB", brand: "LG", equipmentKind: "Televisor" },
    ];

    const exact = matchCatalogEquipmentModel(
      { model: "opm-4250", alternatives: [] },
      catalog,
    );
    expect(exact).toEqual({
      model: "OPM-4250",
      brand: "Orion PDP",
      equipmentKind: "Monitor",
    });

    const viaAlternative = matchCatalogEquipmentModel(
      {
        model: "50UM7600PLB.BEUSLJP",
        alternatives: ["50UM7600PLB"],
      },
      catalog,
    );
    expect(viaAlternative?.model).toBe("50UM7600PLB");
  });

  test("buildEquipmentLabelMessages incluye pistas de códigos de barras y reglas anti-trampa", () => {
    const messages = buildEquipmentLabelMessages({
      imageDataUrl: "data:image/jpeg;base64,/9j/4AAQ",
      detectedBarcodes: ["912MAYY5H530", "50UM7600PLB.BEUSLJP"],
      knownBrands: ["LG", "Sony", "Toshiba"],
    });

    expect(messages).toHaveLength(2);
    expect(messages[0]?.role).toBe("system");
    expect(String(messages[0]?.content)).toContain("MAC");
    expect(String(messages[0]?.content)).toContain("REF");
    const userContent = messages[1]?.content;
    expect(Array.isArray(userContent)).toBe(true);
    expect(JSON.stringify(userContent)).toContain("912MAYY5H530");
    expect(AI_MAX_IMAGE_DATA_URL_BYTES).toBeGreaterThan(100_000);
  });

  test("buildIncidentQaMessages y parseIncidentQaResponse estructuran respuestas con referencias", () => {
    const messages = buildIncidentQaMessages({
      question: "¿Qué le ha pasado al monitor OPM-4250?",
      incidents: [
        {
          reference: "INC-0014",
          status: "resolved",
          equipmentKind: "Monitor",
          model: "OPM-4250",
          brand: "Orion PDP",
          serialNumber: "OM50A11100275",
          description: "No enciende la fuente principal.",
          reportedAt: Date.UTC(2026, 9, 10),
          resolutionNote: "Sustituida fuente interna.",
        },
      ],
    });
    expect(messages).toHaveLength(2);
    expect(String(messages[1]?.content)).toContain("INC-0014");

    const parsed = parseIncidentQaResponse(
      JSON.stringify({
        answer: "El monitor OPM-4250 tuvo un fallo de fuente en INC-0014.",
        citedReferences: ["INC-0014", "INC-9999"],
      }),
      new Set(["INC-0014"]),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.citedReferences).toEqual(["INC-0014"]);
  });

  test("parseEquipmentLabelResponse extrae technicalDetails y formatLabelDescription genera la descripción", async () => {
    const { formatLabelDescription, parseEquipmentLabelResponse } = await import(
      "@/lib/ai"
    );
    const parsed = parseEquipmentLabelResponse(
      JSON.stringify({
        brand: "SL Power",
        model: "MW155RA2400F02",
        serialNumber: null,
        equipmentKind: "Fuente de alimentación médica",
        technicalDetails: ["Input: 100-240V~, 50-60Hz", "Output: +24V 5.0A"],
        confidence: "high",
        alternatives: [],
        warnings: ["Sin número de serie visible"],
      }),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.technicalDetails).toEqual([
      "Input: 100-240V~, 50-60Hz",
      "Output: +24V 5.0A",
    ]);
    const description = formatLabelDescription(parsed.value);
    expect(description).toContain("Tipo de equipo: Fuente de alimentación médica");
    expect(description).toContain("- Input: 100-240V~, 50-60Hz");
    expect(description).toContain("- Output: +24V 5.0A");
  });

  test("parseWorkshopQaResponse acepta Markdown plano tras tool calling y extrae citas válidas", async () => {
    const { parseWorkshopQaResponse } = await import("@/lib/ai");
    const parsed = parseWorkshopQaResponse(
      "El repuesto **AUD-POP01** es compatible con **EQ-007** (no con FAKE-999).",
      new Set(["AUD-POP01", "EQ-007"]),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.answer).toContain("AUD-POP01");
    expect(parsed.value.citedReferences).toEqual(["AUD-POP01", "EQ-007"]);
  });
});
