import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "../src/convex/_generated/api";
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
});
