import { describe, expect, test } from "vitest";
import type { Id } from "../src/convex/_generated/dataModel";
import { formatDateTime } from "../src/lib/workshop";
import {
  AUDIT_ACTIONS,
  AUDIT_PRESETS,
  EMPTY_AUDIT_FILTERS,
  applyAuditPreset,
  auditActionCount,
  auditActionLabel,
  auditCsvTable,
  documentMoveAlert,
  auditFilterCount,
  auditPresetOf,
  auditPresetRange,
  auditQueryArgs,
  auditRange,
  dayFromInput,
  dayInputValue,
  describeAuditRange,
  endOfDay,
  summarizeAudit,
  type AuditCsvEntry,
  type AuditFilters,
} from "../src/lib/audit";

const DIA = 24 * 60 * 60 * 1000;
/** Mediodía local del 15 de septiembre de 2026: el huso no entra en juego. */
const ahora = new Date(2026, 8, 15, 12, 0, 0).getTime();
const persona = "usuario1" as Id<"users">;

const filtros = (over: Partial<AuditFilters> = {}): AuditFilters => ({
  ...EMPTY_AUDIT_FILTERS,
  ...over,
});

describe("fechas del filtro de auditoría", () => {
  test("lee el día escrito en el calendario", () => {
    const dia = dayFromInput("2026-09-15");
    expect(dia).toBe(new Date(2026, 8, 15).getTime());
    expect(new Date(dia as number).getHours()).toBe(0);
  });

  test("sin fecha no hay filtro, y una fecha imposible no amplía el rango", () => {
    expect(dayFromInput("")).toBe(null);
    expect(dayFromInput("  ")).toBe(null);
    expect(dayFromInput("15/09/2026")).toBe(null);
    // `Date` recolocaría el 31 de febrero en marzo: se descarta en vez de
    // ensanchar el periodo sin avisar.
    expect(dayFromInput("2026-02-31")).toBe(null);
    expect(dayFromInput("2026-13-01")).toBe(null);
  });

  test("el valor del calendario y la marca de tiempo se corresponden", () => {
    const dia = dayFromInput("2026-09-15") as number;
    expect(dayInputValue(dia)).toBe("2026-09-15");
    expect(dayInputValue(dia + DIA - 1)).toBe("2026-09-15");
    expect(dayInputValue(dia + DIA)).toBe("2026-09-16");
  });

  test("el día «hasta» incluye su último milisegundo", () => {
    const dia = dayFromInput("2026-09-15") as number;
    expect(endOfDay(dia)).toBe(endOfDay(dia + 13 * 60 * 60 * 1000));
    expect(endOfDay(dia)).toBe(dia + DIA - 1);
  });
});

describe("periodos del filtro de auditoría", () => {
  test("cada atajo abarca su tramo y «Todo» no pone topes", () => {
    expect(auditPresetRange("today", ahora)).toEqual({
      from: new Date(2026, 8, 15).getTime(),
      to: endOfDay(ahora),
    });
    expect(auditPresetRange("week", ahora).from).toBe(
      new Date(2026, 8, 15).getTime() - 6 * DIA,
    );
    expect(auditPresetRange("month", ahora).from).toBe(
      new Date(2026, 8, 15).getTime() - 29 * DIA,
    );
    expect(auditPresetRange("all", ahora)).toEqual({ from: null, to: null });
  });

  test("los periodos se reconocen a partir de las dos fechas", () => {
    for (const preset of AUDIT_PRESETS) {
      const range = auditPresetRange(preset.id, ahora);
      expect(auditPresetOf(range, ahora)).toBe(preset.id);
    }
    // Un día suelto escrito a mano no es ninguno de los atajos.
    const suelto = { from: dayFromInput("2026-09-02"), to: endOfDay(ahora) };
    expect(auditPresetOf(suelto, ahora)).toBe("custom");
  });

  test("aplicar un atajo escribe sus fechas y no toca el resto de filtros", () => {
    const base = filtros({ userId: persona, action: "removed" });
    const semana = applyAuditPreset(base, "week", ahora);
    expect(semana.userId).toBe(persona);
    expect(semana.action).toBe("removed");
    expect(semana.from).toBe(
      dayInputValue(new Date(2026, 8, 15).getTime() - 6 * DIA),
    );
    expect(semana.to).toBe("2026-09-15");

    // «Todo» vacía las dos fechas.
    expect(applyAuditPreset(semana, "all", ahora)).toEqual({
      ...base,
      from: "",
      to: "",
    });
  });

  test("las fechas cruzadas se ordenan en vez de dejar el rango vacío", () => {
    const range = auditRange(filtros({ from: "2026-09-15", to: "2026-09-01" }));
    expect(range.from).toBe(dayFromInput("2026-09-01"));
    expect(range.to).toBe(endOfDay(dayFromInput("2026-09-15") as number));
  });

  test("un solo extremo deja el otro abierto", () => {
    expect(auditRange(filtros({ from: "2026-09-01" }))).toEqual({
      from: dayFromInput("2026-09-01"),
      to: null,
    });
    expect(auditRange(filtros({ to: "2026-09-01" }))).toEqual({
      from: null,
      to: endOfDay(dayFromInput("2026-09-01") as number),
    });
    expect(auditRange(filtros())).toEqual({ from: null, to: null });
    // Una fecha imposible no filtra por accidente.
    expect(auditRange(filtros({ from: "ayer" }))).toEqual({
      from: null,
      to: null,
    });
  });
});

describe("argumentos de la consulta de auditoría", () => {
  test("sin filtros no se manda ninguno: se pide el histórico entero", () => {
    expect(auditQueryArgs(filtros())).toEqual({});
  });

  test("con filtros se mandan la persona, el tramo y el movimiento", () => {
    expect(
      auditQueryArgs(
        filtros({
          userId: persona,
          from: "2026-09-01",
          to: "2026-09-15",
          action: "edited",
        }),
      ),
    ).toEqual({
      userId: persona,
      from: dayFromInput("2026-09-01"),
      to: endOfDay(dayFromInput("2026-09-15") as number),
      action: "edited",
    });
  });

  test("se cuentan los filtros puestos, no los campos rellenos a medias", () => {
    expect(auditFilterCount(filtros())).toBe(0);
    expect(auditFilterCount(filtros({ userId: persona }))).toBe(1);
    // Las dos fechas son un solo filtro: el periodo.
    expect(
      auditFilterCount(filtros({ from: "2026-09-01", to: "2026-09-15" })),
    ).toBe(1);
    expect(auditFilterCount(filtros({ to: "no vale" }))).toBe(0);
    expect(
      auditFilterCount(
        filtros({ userId: persona, from: "2026-09-01", action: "attached" }),
      ),
    ).toBe(3);
  });
});

describe("resumen de la auditoría", () => {
  const entradas = [
    { action: "attached" as const, byId: "u1", incidentId: "i1" },
    { action: "attached" as const, byId: "u2", incidentId: "i1" },
    { action: "edited" as const, byId: "u1", incidentId: "i2" },
    { action: "replaced" as const, byId: "u1", incidentId: "i2" },
    { action: "removed" as const, byId: "u1", incidentId: "i1" },
  ];

  test("cuenta movimientos, personas distintas e incidencias tocadas", () => {
    expect(summarizeAudit(entradas)).toEqual({
      total: 5,
      people: 2,
      incidents: 2,
      byAction: { attached: 2, edited: 1, replaced: 1, removed: 1 },
    });
  });

  test("sin movimientos el resumen queda a cero", () => {
    expect(summarizeAudit([])).toEqual({
      total: 0,
      people: 0,
      incidents: 0,
      byAction: { attached: 0, edited: 0, replaced: 0, removed: 0 },
    });
  });

  test("el desglose se escribe en singular y plural", () => {
    expect(auditActionCount("attached", 1)).toBe("1 alta");
    expect(auditActionCount("attached", 3)).toBe("3 altas");
    expect(auditActionCount("edited", 1)).toBe("1 edición");
    expect(auditActionCount("edited", 0)).toBe("0 ediciones");
    expect(auditActionCount("replaced", 1)).toBe("1 reemplazo");
    expect(auditActionCount("replaced", 2)).toBe("2 reemplazos");
    expect(auditActionCount("removed", 2)).toBe("2 retiradas");
  });

  test("los filtros de movimiento son los cuatro del rastro", () => {
    expect(AUDIT_ACTIONS.map((item) => item.id)).toEqual([
      "attached",
      "edited",
      "replaced",
      "removed",
    ]);
  });
});

describe("frase del periodo filtrado", () => {
  test("los atajos se nombran por su nombre", () => {
    expect(describeAuditRange(auditPresetRange("today", ahora), ahora)).toBe(
      "Hoy",
    );
    expect(describeAuditRange(auditPresetRange("week", ahora), ahora)).toBe(
      "Últimos 7 días",
    );
    expect(describeAuditRange(auditPresetRange("month", ahora), ahora)).toBe(
      "Últimos 30 días",
    );
    expect(describeAuditRange(auditPresetRange("all", ahora), ahora)).toBe(
      "Todo",
    );
  });

  test("un día suelto y un tramo a mano se leen en castellano", () => {
    expect(
      describeAuditRange(
        {
          from: dayFromInput("2026-09-03"),
          to: endOfDay(dayFromInput("2026-09-03") as number),
        },
        ahora,
      ),
    ).toBe("El 3 de septiembre de 2026");
    expect(
      describeAuditRange(
        {
          from: dayFromInput("2026-09-03"),
          to: endOfDay(dayFromInput("2026-09-09") as number),
        },
        ahora,
      ),
    ).toBe("Del 3 al 9 de septiembre de 2026");
    // Cambiando de mes se dicen las dos fechas enteras.
    expect(
      describeAuditRange(
        {
          from: dayFromInput("2026-08-28"),
          to: endOfDay(dayFromInput("2026-09-03") as number),
        },
        ahora,
      ),
    ).toBe("Del 28 de agosto de 2026 al 3 de septiembre de 2026");
  });

  test("los tramos abiertos y el histórico también se explican", () => {
    expect(
      describeAuditRange({ from: dayFromInput("2026-09-03"), to: null }, ahora),
    ).toBe("Desde el 3 de septiembre de 2026");
    // Del inicio del histórico hasta un día concreto: no es un atajo, así que
    // se dice con la fecha.
    expect(describeAuditRange({ from: null, to: endOfDay(ahora) }, ahora)).toBe(
      "Hasta el 15 de septiembre de 2026",
    );
    expect(
      describeAuditRange(
        { from: null, to: endOfDay(dayFromInput("2026-09-01") as number) },
        ahora,
      ),
    ).toBe("Hasta el 1 de septiembre de 2026");
    expect(describeAuditRange({ from: null, to: null }, ahora)).toBe("Todo");
  });
});

describe("CSV del tramo filtrado", () => {
  const movimiento = (over: Partial<AuditCsvEntry> = {}): AuditCsvEntry => ({
    reference: "INC-0007",
    title: "Cámara Sony FX3",
    status: "workshop",
    archived: false,
    action: "attached",
    name: "parte-de-trabajo.pdf",
    by: "Marta Ruiz",
    at: ahora,
    ...over,
  });

  test("el movimiento se nombra en singular, como en el filtro pero una vez", () => {
    expect(auditActionLabel("attached")).toBe("Alta");
    expect(auditActionLabel("edited")).toBe("Edición");
    expect(auditActionLabel("replaced")).toBe("Reemplazo");
    expect(auditActionLabel("removed")).toBe("Retirada");
    // El filtro de la vista sigue en plural: son dos lecturas distintas.
    expect(AUDIT_ACTIONS.map((action) => action.label)).toEqual([
      "Altas",
      "Ediciones",
      "Reemplazos",
      "Retiradas",
    ]);
  });

  test("la cabecera y sus filas van juntas y en el mismo orden", () => {
    const { header, rows } = auditCsvTable([movimiento()]);

    expect(header).toHaveLength(rows[0].length);
    expect(header).toEqual([
      "Fecha y hora",
      "Movimiento",
      "Persona",
      "Incidencia",
      "Equipo",
      "Estado",
      "Archivada",
      "Documento",
      "Documento anterior",
    ]);
    expect(rows[0]).toEqual([
      formatDateTime(ahora),
      "Alta",
      "Marta Ruiz",
      "INC-0007",
      "Cámara Sony FX3",
      "En taller",
      "No",
      "parte-de-trabajo.pdf",
      "",
    ]);
  });

  test("una edición con nombre anterior y una incidencia archivada", () => {
    const { rows } = auditCsvTable([
      movimiento({
        action: "edited",
        name: "informe-final.pdf",
        previousName: "informe.pdf",
        archived: true,
      }),
    ]);

    expect(rows[0]).toContain("Edición");
    expect(rows[0]).toContain("informe.pdf");
    expect(rows[0]).toContain("Sí");
  });

  test("sin estado legible (incidencia borrada) queda vacío, no «undefined»", () => {
    const [row] = auditCsvTable([
      movimiento({ status: undefined, reference: "—", title: "" }),
    ]).rows;

    expect(row).toContain("");
    expect(row.join(";")).not.toMatch(/undefined/);
    expect(row[3]).toBe("—");
  });

  test("una sola fila por movimiento, y sin filas si no hay tramo", () => {
    const { rows } = auditCsvTable([
      movimiento({ action: "attached" }),
      movimiento({ action: "removed", name: "foto.jpg" }),
    ]);

    expect(rows).toHaveLength(2);
    expect(auditCsvTable([]).rows).toEqual([]);
    expect(auditCsvTable([]).header).toHaveLength(9);
  });
});

describe("aviso al administrador por un movimiento del expediente", () => {
  const aviso = (over: Partial<Parameters<typeof documentMoveAlert>[0]>) =>
    documentMoveAlert({
      action: "attached",
      reference: "INC-0007",
      name: "Acta de intervención.pdf",
      closed: false,
      ...over,
    });

  test("una retirada avisa siempre: es lo único que queda del documento", () => {
    expect(aviso({ action: "removed", name: "Acta.pdf" })).toBe(
      "Expediente de INC-0007 · se retiró «Acta.pdf»",
    );
    expect(
      aviso({ action: "removed", name: "Acta.pdf", closed: true }),
    ).toBe(
      "Expediente de INC-0007 (incidencia cerrada) · se retiró «Acta.pdf»",
    );
  });

  test("un reemplazo también avisa: el archivo anterior ya no está", () => {
    expect(aviso({ action: "replaced", name: "Acta.pdf" })).toBe(
      "Expediente de INC-0007 · se reemplazó el archivo de «Acta.pdf»",
    );
    // Si el reemplazo vino con un renombrado, el aviso cuenta los dos nombres.
    expect(
      aviso({
        action: "replaced",
        name: "Acta revisada.pdf",
        previousName: "Acta.pdf",
        closed: true,
      }),
    ).toBe(
      "Expediente de INC-0007 (incidencia cerrada) · se reemplazó el archivo de «Acta.pdf» y se renombró a «Acta revisada.pdf»",
    );
  });

  test("un alta o una edición en una incidencia en curso no avisa a nadie", () => {
    expect(aviso({ action: "attached" })).toBeNull();
    expect(aviso({ action: "edited" })).toBeNull();
    expect(aviso({ action: "edited", previousName: "Acta.pdf" })).toBeNull();
  });

  test("el expediente de una incidencia cerrada avisa hasta en un alta", () => {
    expect(aviso({ action: "attached", closed: true })).toBe(
      "Expediente de INC-0007 (incidencia cerrada) · se adjuntó «Acta de intervención.pdf»",
    );
  });

  test("un renombrado cuenta los dos nombres y una corrección de nota, uno", () => {
    expect(
      aviso({
        action: "edited",
        name: "Acta revisada.pdf",
        previousName: "Acta.pdf",
        closed: true,
      }),
    ).toBe(
      "Expediente de INC-0007 (incidencia cerrada) · se renombró «Acta.pdf» a «Acta revisada.pdf»",
    );
    expect(aviso({ action: "edited", closed: true })).toBe(
      "Expediente de INC-0007 (incidencia cerrada) · se editó «Acta de intervención.pdf»",
    );
  });

  test("el aviso lleva la referencia de la incidencia y nunca un hueco", () => {
    for (const action of [
      "attached",
      "edited",
      "replaced",
      "removed",
    ] as const) {
      const text = aviso({ action, closed: true });
      expect(text).toContain("INC-0007");
      expect(text).not.toMatch(/undefined|null/);
    }
  });
});
