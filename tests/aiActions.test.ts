import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../src/convex/_generated/api";
import { AI_MAX_CALLS_PER_USER_HOUR } from "../src/lib/ai";
import { backend } from "./backend";

afterEach(() => {
  delete process.env.DEEPSEEK_API_KEY;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function setup() {
  const t = backend();
  const { techId, guestId, inactiveId } = await t.run(async (ctx) => {
    const techId = await ctx.db.insert("users", {
      name: "Técnico",
      email: "tech@taller.es",
      role: "technician",
      active: true,
    });
    const guestId = await ctx.db.insert("users", {
      name: "Invitado",
      isAnonymous: true,
      role: "guest",
    });
    const inactiveId = await ctx.db.insert("users", {
      name: "Baja",
      email: "baja@taller.es",
      role: "technician",
      active: false,
    });
    await ctx.db.insert("equipmentModels", {
      model: "OPM-4250",
      brand: "Orion PDP",
      name: "Monitor",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await ctx.db.insert("incidents", {
      reference: "INC-0014",
      reporterName: "Laura",
      equipmentKind: "Monitor",
      model: "OPM-4250",
      serialNumber: "OM50A11100275",
      description: "No enciende tras corte eléctrico.",
      status: "resolved",
      reportedAt: Date.now() - 10_000,
      createdAt: Date.now() - 10_000,
      updatedAt: Date.now() - 5_000,
      resolvedNote: "Fuente sustituida.",
      history: [{ status: "reported", at: Date.now() - 10_000, by: "Laura" }],
    });
    return { techId, guestId, inactiveId };
  });

  return {
    t,
    techId,
    tech: t.withIdentity({ subject: `${techId}|s-tech` }),
    guest: t.withIdentity({ subject: `${guestId}|s-guest` }),
    inactive: t.withIdentity({ subject: `${inactiveId}|s-baja` }),
  };
}

describe("Fase 2 TDD — acciones de IA (solo usuarios autenticados activos)", () => {
  test("anónimos, invitados y cuentas de baja no pueden invocar extractEquipmentLabel ni askIncidents", async () => {
    process.env.DEEPSEEK_API_KEY = "sk-test";
    const { t, guest, inactive } = await setup();

    for (const actor of [t, guest, inactive]) {
      await expect(
        actor.action(api.ai.extractEquipmentLabel, {
          imageDataUrl: "data:image/jpeg;base64,/9j/4AAQ",
        }),
      ).rejects.toThrow();

      await expect(
        actor.action(api.ai.askIncidents, {
          question: "¿Qué falló en el monitor?",
        }),
      ).rejects.toThrow();
    }
  });

  test("extractEquipmentLabel envía imagen + códigos de barras a DeepSeek y cruza con catálogo", async () => {
    process.env.DEEPSEEK_API_KEY = "sk-test";
    const { t, tech } = await setup();

    await t.run((ctx) =>
      ctx.db.insert("aiSettings", {
        key: "default",
        enabled: true,
        baseUrl: "https://api.deepseek.com/v1",
        visionModel: "deepseek-flash",
        chatModel: "deepseek-chat",
        updatedAt: Date.now(),
      }),
    );

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                brand: "ORION PDP",
                model: "OPM-4250",
                serialNumber: "OM50A11100275",
                equipmentKind: "Monitor",
                confidence: "high",
                evidence: "Model Name : OPM-4250 | S/N : OM50A11100275",
                alternatives: [],
                warnings: [],
              }),
            },
          },
        ],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await tech.action(api.ai.extractEquipmentLabel, {
      imageDataUrl: "data:image/jpeg;base64,/9j/4AAQ",
      detectedBarcodes: ["OM50A11100275"],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.model).toBe("OPM-4250");
    expect(result.serialNumber).toBe("OM50A11100275");
    expect(result.catalogMatch?.model).toBe("OPM-4250");
    expect(result.catalogMatch?.brand).toBe("Orion PDP");
  });

  test("askIncidents responde citando referencias reales y respeta límite horario por usuario", async () => {
    process.env.DEEPSEEK_API_KEY = "sk-test";
    const { t, tech, techId } = await setup();

    await t.run((ctx) =>
      ctx.db.insert("aiSettings", {
        key: "default",
        enabled: true,
        baseUrl: "https://api.deepseek.com/v1",
        visionModel: "deepseek-flash",
        chatModel: "deepseek-chat",
        updatedAt: Date.now(),
      }),
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  answer:
                    "El monitor OPM-4250 tuvo una avería de fuente resuelta en INC-0014.",
                  citedReferences: ["INC-0014", "INC-INVENTADA"],
                }),
              },
            },
          ],
        }),
      })),
    );

    const answer = await tech.action(api.ai.askIncidents, {
      question: "¿Qué avería tuvo el monitor OPM-4250?",
    });
    expect(answer.answer).toContain("INC-0014");
    expect(answer.citedReferences).toEqual(["INC-0014"]);

    // Al alcanzar el límite horario del usuario se bloquea antes de llamar a DeepSeek
    await t.run(async (ctx) => {
      const existing = await ctx.db
        .query("aiUsageLimits")
        .withIndex("by_user", (q) => q.eq("userId", techId))
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, {
          count: AI_MAX_CALLS_PER_USER_HOUR,
        });
      } else {
        await ctx.db.insert("aiUsageLimits", {
          userId: techId,
          windowStart: Date.now(),
          count: AI_MAX_CALLS_PER_USER_HOUR,
        });
      }
    });

    await expect(
      tech.action(api.ai.askIncidents, { question: "Otra pregunta" }),
    ).rejects.toThrow(/límite/i);
  });

  test("askWorkshop ejecuta tool calling contra la BD, filtra herramientas por permisos y respeta allowedRoles", async () => {
    process.env.DEEPSEEK_API_KEY = "sk-test";
    const { t, tech } = await setup();

    await t.run(async (ctx) => {
      await ctx.db.insert("roles", {
        key: "technician",
        label: "Técnico",
        description: "Técnico de taller",
        kind: "system",
        grants: {
          viewIncidents: true,
          viewEquipment: true,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("equipment", {
        code: "EQ-007",
        name: "Monitor principal",
        brand: "Orion PDP",
        model: "OPM-4250",
        serialNumber: "OM50A11100275",
        location: "Control A",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("aiSettings", {
        key: "default",
        enabled: true,
        baseUrl: "https://api.deepseek.com/v1",
        visionModel: "deepseek-flash",
        chatModel: "deepseek-chat",
        enabledModules: ["equipment", "incidents", "purchasing"],
        updatedAt: Date.now(),
      });
    });

    let round = 0;
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      round += 1;
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        tools?: Array<{ function?: { name?: string } }>;
      };

      // El técnico no tiene permiso de compras por defecto -> no se expone search_purchase_orders
      const toolNames = (body.tools ?? []).map((item) => item.function?.name);
      expect(toolNames).toContain("get_equipment_history");
      expect(toolNames).not.toContain("search_purchase_orders");

      if (round === 1) {
        return {
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: null,
                  tool_calls: [
                    {
                      id: "call_1",
                      type: "function",
                      function: {
                        name: "get_equipment_history",
                        arguments: JSON.stringify({ codeOrModel: "EQ-007" }),
                      },
                    },
                  ],
                },
              },
            ],
          }),
        };
      }

      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  answer: "El equipo EQ-007 (OPM-4250) tuvo la incidencia INC-0014.",
                  citedReferences: ["EQ-007", "INC-0014"],
                }),
              },
            },
          ],
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await tech.action(api.ai.askWorkshop, {
      question: "Dime el historial del equipo EQ-007",
      debug: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.usedTools).toEqual(["get_equipment_history"]);
    expect(res.citedReferences).toEqual(["EQ-007", "INC-0014"]);
    expect(res.debugTrace).toHaveLength(2);
    expect(res.debugTrace?.[0]?.toolCalls?.[0]?.name).toBe("get_equipment_history");
    expect(JSON.stringify(res.debugTrace)).not.toContain("sk-test");

    // Si restringimos allowedRoles a ["admin"], el técnico pierde acceso
    await t.run(async (ctx) => {
      const row = await ctx.db.query("aiSettings").unique();
      if (row) {
        await ctx.db.patch(row._id, { allowedRoles: ["admin"] });
      }
    });

    const avail = await tech.query(api.ai.availability, {});
    expect(avail.available).toBe(false);
    await expect(
      tech.action(api.ai.askWorkshop, { question: "Hola" }),
    ).rejects.toThrow(/permiso|habilitado/i);
  });

  test("querySpareParts resuelve equipos y modelos compatibles y askWorkshop acepta respuesta Markdown", async () => {
    process.env.DEEPSEEK_API_KEY = "sk-test";
    const { t, tech } = await setup();

    await t.run(async (ctx) => {
      await ctx.db.insert("roles", {
        key: "technician",
        label: "Técnico",
        description: "Técnico de taller",
        kind: "system",
        grants: {
          viewInventory: true,
          viewEquipment: true,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const modelRow = await ctx.db
        .query("equipmentModels")
        .withIndex("by_model", (q) => q.eq("model", "OPM-4250"))
        .first();
      const eqId = await ctx.db.insert("equipment", {
        code: "EQ-010",
        name: "Micrófono de caña",
        model: "MKH-416",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("spareParts", {
        code: "AUD-POP01",
        name: "Antiviento de micrófono",
        category: "Audio",
        unit: "ud",
        stock: 4,
        minStock: 3,
        compatibleWith: [eqId],
        ...(modelRow ? { compatibleModels: [modelRow._id] } : {}),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("aiSettings", {
        key: "default",
        enabled: true,
        baseUrl: "https://api.deepseek.com/v1",
        visionModel: "deepseek-flash",
        chatModel: "deepseek-chat",
        enabledModules: ["parts", "equipment"],
        updatedAt: Date.now(),
      });
    });

    const partsResult = await t.query(internal._ai.workshopTools.querySpareParts, {
      query: "Antiviento",
    });
    expect(partsResult).toHaveLength(1);
    expect(partsResult[0]?.compatibleEquipment).toEqual([
      { code: "EQ-010", name: "Micrófono de caña", model: "MKH-416" },
    ]);
    expect(partsResult[0]?.compatibleModels).toEqual([
      { brand: "Orion PDP", model: "OPM-4250", name: "Monitor" },
    ]);

    let round = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        round += 1;
        if (round === 1) {
          return {
            ok: true,
            json: async () => ({
              choices: [
                {
                  message: {
                    content: null,
                    tool_calls: [
                      {
                        id: "call_parts",
                        type: "function",
                        function: {
                          name: "search_spare_parts",
                          arguments: JSON.stringify({ query: "Antiviento" }),
                        },
                      },
                    ],
                  },
                },
              ],
            }),
          };
        }
        return {
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content:
                    "El repuesto **AUD-POP01** es compatible con **EQ-010** (Micrófono de caña).",
                },
              },
            ],
          }),
        };
      }),
    );

    const res = await tech.action(api.ai.askWorkshop, {
      question: "¿Qué equipos usan Antiviento?",
    });
    expect(res.answer).toContain("EQ-010");
    expect(res.citedReferences).toEqual(["EQ-010", "AUD-POP01"]);
  });
});
