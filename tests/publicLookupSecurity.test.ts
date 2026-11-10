import { describe, expect, test } from "vitest";
import { backend } from "./backend";
import { api } from "../src/convex/_generated/api";
import { GLOBAL_INTAKE_LIMIT_PER_HOUR } from "../src/lib/incidentIntake";
import { GLOBAL_LOOKUP_LIMIT_PER_HOUR, admitGlobalLookup } from "../src/lib/publicLookup";

describe("Seguridad AppSec: Mitigación de Fuerza Bruta en Consulta Pública (CWE-307)", () => {
  test("admitGlobalLookup rechaza consultas cuando se alcanza el límite global horario", () => {
    expect(admitGlobalLookup(GLOBAL_LOOKUP_LIMIT_PER_HOUR - 1).allowed).toBe(true);
    expect(admitGlobalLookup(GLOBAL_LOOKUP_LIMIT_PER_HOUR).allowed).toBe(false);
    expect(admitGlobalLookup(GLOBAL_LOOKUP_LIMIT_PER_HOUR + 10).allowed).toBe(false);
  });

  test("incidents.byCode bloquea el barrido masivo distribuido al superar el límite global", async () => {
    const t = backend();

    // Simular que en la última hora ya se han registrado consultas hasta el límite global
    const now = Date.now();
    await t.run(async (ctx) => {
      for (let i = 0; i < GLOBAL_LOOKUP_LIMIT_PER_HOUR; i++) {
        await ctx.db.insert("publicLookupLimits", {
          code: `INC-PROBADO-${i}`,
          windowStart: now - 1000,
          count: 1,
        });
      }
    });

    // La siguiente consulta (incluso con un código nuevo legítimo) debe ser rechazada por el freno global
    await expect(
      t.mutation(api.incidents.byCode, { code: "A7K2-QX9M" }),
    ).rejects.toThrow(/límite global de consultas/i);
  });

  test("incidents.report rechaza bots que rellenan el campo honeypot", async () => {
    const t = backend();
    await expect(
      t.mutation(api.incidents.report, {
        reporterName: "Bot Automático",
        description: "Texto largo de relleno automático para probar el envío.",
        reportedAt: Date.now(),
        website: "https://bot.invalid",
      }),
    ).rejects.toThrow(/No se ha podido procesar la solicitud/i);
  });

  test("incidents.report frena el flooding al superar el límite global horario de altas", async () => {
    const t = backend();
    const now = Date.now();
    await t.run(async (ctx) => {
      for (let i = 0; i < GLOBAL_INTAKE_LIMIT_PER_HOUR; i++) {
        await ctx.db.insert("incidents", {
          reference: `INC-FLOOD-${i}`,
          reporterName: `Persona ${i}`,
          description: "Incidencia de prueba para validar el límite horario.",
          status: "reported",
          reportedAt: now - 1000,
          createdAt: now - 1000,
          updatedAt: now - 1000,
          history: [{ status: "reported", at: now - 1000, by: `Persona ${i}` }],
        });
      }
    });

    await expect(
      t.mutation(api.incidents.report, {
        reporterName: "Usuario Legítimo Nuevo",
        description: "La cámara del plató 2 no enciende al pulsar el interruptor.",
        reportedAt: now,
      }),
    ).rejects.toThrow(/demasiadas notificaciones públicas/i);
  });
});
