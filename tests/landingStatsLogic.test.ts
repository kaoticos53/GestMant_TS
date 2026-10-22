import {
  buildLandingFigures,
  type PublicStatsDoc,
} from "@/pages/landing/hooks/useLandingStatsSummary";
import { describe, expect, it } from "vitest";

describe("buildLandingFigures", () => {
  it("devuelve guiones '—' cuando cifras es null o undefined", () => {
    const figurasNull = buildLandingFigures(null);
    expect(figurasNull).toHaveLength(4);
    expect(figurasNull.every((f) => f.valor === "—")).toBe(true);

    const figurasUndefined = buildLandingFigures(undefined);
    expect(figurasUndefined.every((f) => f.valor === "—")).toBe(true);
  });

  it("formatea correctamente las cifras cuantitativas cuando hay datos completos", () => {
    const mockCifras: PublicStatsDoc = {
      equipment: 120,
      spareParts: 450,
      openIncidents: 12,
      closedLastMonth: 35,
      meanResolutionMinutes: 135,
      computedAt: 1000000,
    };

    const figuras = buildLandingFigures(mockCifras);
    expect(figuras).toEqual([
      { valor: "120", label: "Equipos en servicio" },
      { valor: "450", label: "Repuestos en catálogo" },
      { valor: "12", label: "Incidencias abiertas" },
      { valor: "2 h 15", label: "Tiempo medio de resolución" },
    ]);
  });

  it("muestra un guion en el tiempo medio cuando meanResolutionMinutes es null", () => {
    const mockCifras: PublicStatsDoc = {
      equipment: 50,
      spareParts: 80,
      openIncidents: 3,
      closedLastMonth: 2,
      meanResolutionMinutes: null, // muestra insuficiente
      computedAt: 1000000,
    };

    const figuras = buildLandingFigures(mockCifras);
    expect(figuras[3]).toEqual({
      valor: "—",
      label: "Tiempo medio de resolución",
    });
  });
});
