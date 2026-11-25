// @vitest-environment jsdom
import { describe, expect, test, vi } from "vitest";
import { buildToolResultTable } from "../src/lib/ai/tables";
import {
  dispatchAiOpenReference,
  dispatchAiShowTables,
  subscribeAiOpenReference,
  subscribeAiShowTables,
} from "../src/lib/aiBridge";

describe("Tablas estructuradas y puente de navegación del asistente IA", () => {
  test("buildToolResultTable transforma resultados de herramientas en tablas para la ventana principal", () => {
    const incTable = buildToolResultTable("search_incidents", [
      {
        reference: "INC-0012",
        status: "workshop",
        reportedAt: "2026-11-24",
        model: "Sony FX6",
        description: "Sin señal SDI",
      },
    ]);
    expect(incTable).not.toBeNull();
    expect(incTable?.kind).toBe("incidents");
    expect(incTable?.rows[0].ref).toBe("INC-0012");
    expect(incTable?.rows[0].cells.model).toBe("Sony FX6");

    const partsTable = buildToolResultTable("search_spare_parts", [
      {
        code: "REP-01",
        name: "Fusible",
        category: "Alimentación",
        stock: 1,
        minStock: 5,
        unit: "ud",
        location: "A-01",
      },
    ]);
    expect(partsTable?.kind).toBe("parts");
    expect(partsTable?.rows[0].cells.stock).toBe("1 ud");

    expect(buildToolResultTable("search_incidents", [])).toBeNull();
    expect(buildToolResultTable("get_workshop_stats", { ok: true })).toBeNull();

    const manualsTable = buildToolResultTable("search_manuals", [
      {
        id: "man_123",
        title: "Manual Sony FX6",
        type: "Manual de usuario",
        brand: "Sony",
        model: "FX6",
      },
    ]);
    expect(manualsTable?.kind).toBe("manuals");
    expect(manualsTable?.rows[0].id).toBe("man_123");
    expect(manualsTable?.rows[0].ref).toBe("Manual Sony FX6");
  });

  test("aiBridge emite y recibe eventos de apertura de fichas y tablas", () => {
    const onOpen = vi.fn();
    const onTables = vi.fn();

    const unsubOpen = subscribeAiOpenReference(onOpen);
    const unsubTables = subscribeAiShowTables(onTables);

    dispatchAiOpenReference({ reference: "INC-0012", kind: "incidents" });
    expect(onOpen).toHaveBeenCalledWith({
      reference: "INC-0012",
      kind: "incidents",
    });

    const table = buildToolResultTable("search_incidents", [
      {
        reference: "INC-0012",
        status: "workshop",
        reportedAt: "2026-11-24",
        model: "Sony FX6",
        description: "Sin señal",
      },
    ])!;
    dispatchAiShowTables([table]);
    expect(onTables).toHaveBeenCalledWith([table]);

    unsubOpen();
    unsubTables();
  });
});
