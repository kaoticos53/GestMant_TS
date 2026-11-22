import { describe, expect, test } from "vitest";
import {
  evaluateMailTagRules,
  MAIL_TAG_RULE_PRESETS,
  parseMailTriageBatchResponse,
  parseMailTriageSingleResponse,
  type MailHeaderTagInput,
  type MailTagRule,
} from "../src/lib/mailClient/tagging";

const BASE_HEADER: MailHeaderTagInput = {
  messageId: "msg-1",
  subject: "Aviso de avería en Compresor Atlas",
  fromName: "Taller Norte",
  fromAddress: "avisos@tallernorte.es",
  snippet: "El compresor no arranca y da error E4.",
  hasAttachments: false,
};

describe("mailClient/tagging (Fase 1)", () => {
  test("evalúa reglas rápidas por prioridad y soporta palabras clave separadas por comas", () => {
    const rules: MailTagRule[] = [
      {
        id: "r2",
        name: "Compras",
        enabled: true,
        priority: 2,
        matchMode: "any",
        conditions: [
          { field: "subject", operator: "contains", value: "factura, albarán" },
        ],
        tags: ["purchasing"],
      },
      {
        id: "r1",
        name: "Incidencias críticas",
        enabled: true,
        priority: 1,
        matchMode: "any",
        conditions: [
          {
            field: "subject_or_snippet",
            operator: "contains",
            value: "avería, fallo",
          },
        ],
        tags: ["incidents"],
      },
    ];

    const match = evaluateMailTagRules(BASE_HEADER, rules);
    expect(match).toEqual({
      tags: ["incidents"],
      matchedRuleName: "Incidencias críticas",
      reason: "Regla rápida: Incidencias críticas",
    });
  });

  test("soporta condición domain_is y has_attachments con matchMode 'all'", () => {
    const rules: MailTagRule[] = [
      {
        name: "Manuales de proveedor",
        enabled: true,
        priority: 0,
        matchMode: "all",
        conditions: [
          { field: "from_address", operator: "domain_is", value: "sony.com" },
          { field: "has_attachments", operator: "is_true", value: "" },
        ],
        tags: ["manuals"],
      },
    ];

    expect(
      evaluateMailTagRules(
        {
          ...BASE_HEADER,
          fromAddress: "soporte@pro.sony.com",
          hasAttachments: true,
        },
        rules,
      )?.tags,
    ).toEqual(["manuals"]);

    expect(
      evaluateMailTagRules(
        {
          ...BASE_HEADER,
          fromAddress: "soporte@pro.sony.com",
          hasAttachments: false,
        },
        rules,
      ),
    ).toBeNull();
  });

  test("los presets incluyen reglas válidas y listas para usar", () => {
    expect(MAIL_TAG_RULE_PRESETS.length).toBeGreaterThanOrEqual(4);
    const noreplyMatch = evaluateMailTagRules(
      { ...BASE_HEADER, fromAddress: "no-reply@boletin.es" },
      MAIL_TAG_RULE_PRESETS.map((p, i) => ({ ...p, priority: i })),
    );
    expect(noreplyMatch?.tags).toEqual(["informative"]);
  });

  test("parsea respuestas JSON de DeepSeek en lote y mensaje único filtrando tags desconocidos", () => {
    const rawBatch = JSON.stringify({
      items: [
        {
          messageId: "msg-1",
          tags: ["requests", "unknown_tag"],
          confidence: 0.88,
          needsBody: false,
          reason: "Pide 4 filtros hidráulicos",
        },
        {
          messageId: "msg-2",
          tags: [],
          confidence: 0.4,
          needsBody: true,
          reason: "Asunto genérico",
        },
        {
          messageId: "intruder",
          tags: ["incidents"],
          confidence: 0.99,
          needsBody: false,
          reason: "Ignorar",
        },
      ],
    });

    const parsed = parseMailTriageBatchResponse(
      rawBatch,
      new Set(["msg-1", "msg-2"]),
    );
    expect(parsed).toHaveLength(2);
    expect(parsed[0].tags).toEqual(["requests"]);
    expect(parsed[1].needsBody).toBe(true);

    const single = parseMailTriageSingleResponse(
      JSON.stringify({
        tags: ["equipment", "purchasing"],
        confidence: 0.91,
        needsBody: false,
        reason: "Albarán con S/N 12345",
      }),
      "msg-9",
    );
    expect(single?.messageId).toBe("msg-9");
    expect(single?.tags).toEqual(["equipment", "purchasing"]);
  });
});
