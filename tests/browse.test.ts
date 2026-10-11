import { describe, expect, test } from "vitest";
import {
  dateBucket,
  groupByDate,
  matchesQuery,
  monthsAgo,
  normalizeText,
  sortByDate,
  startOfDay,
} from "../src/lib/browse";

/** Marca de tiempo de un día concreto a mediodía (evita líos de husos). */
function at(year: number, month: number, day: number, hour = 12): number {
  return new Date(year, month - 1, day, hour).getTime();
}

const NOW = at(2026, 10, 7);

describe("normalizeText y matchesQuery — buscar en las colas", () => {
  test("ignora mayúsculas y acentos", () => {
    expect(normalizeText("  Cámara Recóndita ")).toBe("camara recondita");
  });

  test("sin texto que buscar, todo coincide", () => {
    expect(matchesQuery(["lo que sea"], "   ")).toBe(true);
    expect(matchesQuery([], "")).toBe(true);
  });

  test("cada palabra debe aparecer, aunque sea en campos distintos", () => {
    const incident = ["INC-204", "Cámara", "Sony FX6", "Plató 2"];
    expect(matchesQuery(incident, "camara")).toBe(true);
    expect(matchesQuery(incident, "fx6 plató 2")).toBe(true);
    expect(matchesQuery(incident, "INC-204 sony")).toBe(true);
    expect(matchesQuery(incident, "camara plató 3")).toBe(false);
  });

  test("los valores vacíos no estorban", () => {
    expect(matchesQuery([null, undefined, "", "ALI-24015"], "ali-24015")).toBe(
      true,
    );
    expect(matchesQuery([null, undefined, ""], "algo")).toBe(false);
  });

  test("los números también se buscan", () => {
    expect(matchesQuery([42, "Repuesto"], "42")).toBe(true);
  });
});

describe("sortByDate — orden por fecha", () => {
  const items = [
    { id: "a", at: at(2026, 10, 1) },
    { id: "b", at: at(2026, 10, 7) },
    { id: "c", at: at(2026, 10, 3) },
  ];

  test("más recientes primero", () => {
    expect(sortByDate(items, (item) => item.at).map((item) => item.id)).toEqual(
      ["b", "c", "a"],
    );
  });

  test("más antiguas primero", () => {
    expect(
      sortByDate(items, (item) => item.at, "oldest").map((item) => item.id),
    ).toEqual(["a", "c", "b"]);
  });

  test("no modifica la lista original", () => {
    const original = [...items];
    sortByDate(items, (item) => item.at);
    expect(items).toEqual(original);
  });
});

describe("dateBucket — rótulos del historial", () => {
  test("hoy, ayer, semana y mes en curso", () => {
    expect(dateBucket(at(2026, 10, 7, 9), NOW).label).toBe("Hoy");
    expect(dateBucket(at(2026, 10, 6, 23), NOW).label).toBe("Ayer");
    expect(dateBucket(at(2026, 10, 3), NOW).label).toBe("Últimos 7 días");
    expect(dateBucket(at(2026, 9, 20), NOW).label).toBe("Últimos 30 días");
  });

  test("lo antiguo se agrupa por mes", () => {
    const older = dateBucket(at(2026, 6, 15), NOW);
    expect(older.label).toBe("Junio de 2026");
    expect(older.key).toBe("2026-06");
  });

  test("un mismo mes comparte clave aunque cambie el día", () => {
    expect(dateBucket(at(2025, 12, 1), NOW).key).toBe(
      dateBucket(at(2025, 12, 28), NOW).key,
    );
  });

  test("una fecha futura cae en el grupo de hoy", () => {
    expect(dateBucket(at(2026, 10, 9), NOW).label).toBe("Hoy");
  });

  test("startOfDay deja la medianoche", () => {
    const midnight = new Date(startOfDay(at(2026, 10, 7, 18)));
    expect([midnight.getHours(), midnight.getMinutes()]).toEqual([0, 0]);
  });
});

describe("groupByDate — secciones de la cola", () => {
  const items = [
    { id: "hoy1", at: at(2026, 10, 7, 8) },
    { id: "hoy2", at: at(2026, 10, 7, 10) },
    { id: "ayer1", at: at(2026, 10, 6) },
    { id: "junio", at: at(2026, 6, 3) },
    { id: "junio2", at: at(2026, 6, 20) },
  ];

  test("conserva el orden de entrada y agrupa por época", () => {
    const groups = groupByDate(items, (item) => item.at, NOW);
    expect(groups.map((group) => group.label)).toEqual([
      "Hoy",
      "Ayer",
      "Junio de 2026",
    ]);
    expect(groups[0].items.map((item) => item.id)).toEqual(["hoy1", "hoy2"]);
    expect(groups[2].items.map((item) => item.id)).toEqual(["junio", "junio2"]);
  });

  test("sin registros no hay secciones", () => {
    expect(groupByDate([], (item: { at: number }) => item.at, NOW)).toEqual([]);
  });
});

describe("monthsAgo — corte del archivado masivo", () => {
  test("se ancla al día 1 del mes, sin depender del día en que se mire", () => {
    expect(monthsAgo(0, NOW)).toBe(at(2026, 10, 1, 0));
    expect(monthsAgo(1, NOW)).toBe(at(2026, 9, 1, 0));
    // El mismo mes se corta igual mires el día que mires.
    expect(monthsAgo(1, at(2026, 10, 28))).toBe(at(2026, 9, 1, 0));
  });

  test("cruza el año sin perder meses", () => {
    expect(monthsAgo(12, NOW)).toBe(at(2025, 10, 1, 0));
    expect(monthsAgo(14, NOW)).toBe(at(2025, 8, 1, 0));
    expect(monthsAgo(36, NOW)).toBe(at(2023, 10, 1, 0));
  });
});
