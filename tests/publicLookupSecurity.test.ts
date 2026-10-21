import { describe, expect, test } from "vitest";
import { backend } from "./backend";
import { api } from "../src/convex/_generated/api";
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
});
