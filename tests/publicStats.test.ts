// Las cifras públicas de la portada: lo que se cuenta, lo que se publica y lo
// que no sale de aquí.
//
// La portada está abierta a internet, así que esta consulta es la única de todo
// el backend que puede llamar cualquiera sin sesión. Lo que se comprueba es el
// contrato: solo agregados —ni un nombre, ni una referencia, ni un código—, la
// papelera fuera, los equipos de baja fuera, y la media sin publicar mientras la
// muestra sea tan pequeña que señale a un caso concreto.
import "./precalentarModulos";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../src/convex/_generated/api";
import schema from "../src/convex/schema";
import {
  formatCount,
  formatMinutes,
  publishedMeanMinutes,
} from "../src/lib/workshopStats";

const modules = import.meta.glob("../src/convex/**/!(*.*.*)*.*s");

type Test = ReturnType<typeof convexTest>;

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

/**
 * Una incidencia con lo justo que mira la foto: su estado, cuándo se notificó,
 * cuándo se cerró y si está en la papelera o en el archivo.
 */
function incidencia(
  t: Test,
  fields: {
    reference: string;
    status: "reported" | "assigned" | "resolved" | "unresolved";
    reportedAt: number;
    closedAt?: number;
    archivedAt?: number;
    deletedAt?: number;
  },
) {
  return t.run((ctx) =>
    ctx.db.insert("incidents", {
      reference: fields.reference,
      reporterName: "Laura Peña",
      description: "Pérdida de sincronismo en directo.",
      reportedAt: fields.reportedAt,
      status: fields.status,
      ...(fields.closedAt === undefined ? {} : { closedAt: fields.closedAt }),
      ...(fields.archivedAt === undefined
        ? {}
        : { archivedAt: fields.archivedAt, archivedBy: "Ada Admin" }),
      ...(fields.deletedAt === undefined
        ? {}
        : {
            deletedAt: fields.deletedAt,
            purgeAt: fields.deletedAt + 30 * DAY,
          }),
      history: [
        {
          status: fields.status,
          at: fields.closedAt ?? fields.reportedAt,
        },
      ],
      createdAt: fields.reportedAt,
      updatedAt: fields.closedAt ?? fields.reportedAt,
    }),
  );
}

/** Un equipo del catálogo, dado de alta o ya de baja. */
function equipo(t: Test, code: string, baja = false) {
  const now = Date.now();
  return t.run((ctx) =>
    ctx.db.insert("equipment", {
      name: "Cámara de estudio",
      model: "HDC-3500",
      code,
      ...(baja ? { decommissionDate: now - DAY } : {}),
      createdAt: now,
      updatedAt: now,
    }),
  );
}

/** Un repuesto del almacén. */
function repuesto(t: Test, code: string) {
  const now = Date.now();
  return t.run((ctx) =>
    ctx.db.insert("spareParts", {
      code,
      name: `Repuesto ${code}`,
      category: "Conectores",
      unit: "ud",
      stock: 4,
      minStock: 1,
      createdAt: now,
      updatedAt: now,
    }),
  );
}

/** El taller de la prueba: dos equipos en servicio, uno de baja y tres repuestos. */
async function taller() {
  const t = convexTest(schema, modules);
  await equipo(t, "EQ-001");
  await equipo(t, "EQ-002");
  await equipo(t, "EQ-003", true);
  await repuesto(t, "CON-001");
  await repuesto(t, "CON-002");
  await repuesto(t, "CON-003");
  return t;
}

describe("las cifras públicas del taller", () => {
  test("sin foto todavía no se publica nada, y no se publican ceros", async () => {
    const t = await taller();
    // Nadie ha contado aún: no es lo mismo «no hay» que «aún no se ha contado».
    expect(await t.query(api.publicStats.summary, {})).toBeNull();
  });

  test("la foto cuenta equipos en servicio, repuestos, cola viva y cierres recientes", async () => {
    const t = await taller();
    const now = Date.now();

    // Cinco cierres dentro de la ventana, con una media de 48 min.
    const duraciones = [46, 47, 48, 49, 50];
    for (const [indice, minutos] of duraciones.entries()) {
      const reportedAt = now - 2 * DAY;
      await incidencia(t, {
        reference: `INC-10${indice}`,
        status: "resolved",
        reportedAt,
        closedAt: reportedAt + minutos * MINUTE,
      });
    }
    // Fuera de la ventana: no entra en la media.
    await incidencia(t, {
      reference: "INC-200",
      status: "resolved",
      reportedAt: now - 60 * DAY,
      closedAt: now - 40 * DAY,
    });
    // En la papelera: no es trabajo del taller mientras espera a borrarse.
    await incidencia(t, {
      reference: "INC-201",
      status: "resolved",
      reportedAt: now - 3 * DAY,
      closedAt: now - 2 * DAY,
      deletedAt: now - DAY,
    });
    // Viva en la cola, pendiente de asignar.
    await incidencia(t, {
      reference: "INC-202",
      status: "reported",
      reportedAt: now - DAY,
    });
    // Abierta pero archivada a mano: tampoco está en la cola viva.
    await incidencia(t, {
      reference: "INC-203",
      status: "assigned",
      reportedAt: now - DAY,
      archivedAt: now - DAY,
    });

    await t.mutation(internal.publicStats.refresh, {});
    const cifras = await t.query(api.publicStats.summary, {});

    expect(cifras).not.toBeNull();
    // Los dos equipos de alta; el de baja no está en el taller.
    expect(cifras?.equipment).toBe(2);
    expect(cifras?.spareParts).toBe(3);
    expect(cifras?.openIncidents).toBe(1);
    expect(cifras?.closedLastMonth).toBe(5);
    // 46, 47, 48, 49 y 50 dan 48 de media, que se publica redondeada a 50.
    expect(cifras?.meanResolutionMinutes).toBe(50);
    expect(cifras?.computedAt).toBeGreaterThan(0);
  });

  test("con menos de cinco cierres no se publica la media", async () => {
    const t = await taller();
    const now = Date.now();

    for (const indice of [0, 1, 2, 3]) {
      const reportedAt = now - DAY;
      await incidencia(t, {
        reference: `INC-30${indice}`,
        status: "resolved",
        reportedAt,
        closedAt: reportedAt + 30 * MINUTE,
      });
    }

    await t.mutation(internal.publicStats.refresh, {});
    const cifras = await t.query(api.publicStats.summary, {});

    // El recuento sí se publica —es un agregado—, pero la media no: con cuatro
    // casos sería la duración de un trabajo concreto.
    expect(cifras?.closedLastMonth).toBe(4);
    expect(cifras?.meanResolutionMinutes).toBeNull();
  });

  test("solo salen agregados: ni un nombre, ni una referencia, ni un código", async () => {
    const t = await taller();
    const now = Date.now();
    await incidencia(t, {
      reference: "INC-401",
      status: "reported",
      reportedAt: now - DAY,
    });

    await t.mutation(internal.publicStats.refresh, {});
    const cifras = await t.query(api.publicStats.summary, {});

    // Una lista blanca, comprobada al derecho y al revés: lo que la portada lee
    // son seis números y una fecha, y nada más.
    expect(Object.keys(cifras ?? {}).sort()).toEqual([
      "closedLastMonth",
      "computedAt",
      "equipment",
      "meanResolutionMinutes",
      "openIncidents",
      "spareParts",
    ]);
    expect(JSON.stringify(cifras)).not.toContain("INC-");
    expect(JSON.stringify(cifras)).not.toContain("Laura");
    expect(JSON.stringify(cifras)).not.toContain("EQ-");
  });

  test("refrescar dos veces deja una sola fila y la pone al día", async () => {
    const t = await taller();
    await t.mutation(internal.publicStats.refresh, {});
    const primera = await t.query(api.publicStats.summary, {});

    await equipo(t, "EQ-004");
    await t.mutation(internal.publicStats.refresh, {});
    const segunda = await t.query(api.publicStats.summary, {});

    expect(segunda?.equipment).toBe(3);
    expect(segunda?.computedAt).toBeGreaterThanOrEqual(
      primera?.computedAt ?? 0,
    );

    // La foto es una sola fila: la tabla no crece con cada pasada.
    const filas = await t.run((ctx) => ctx.db.query("publicStats").collect());
    expect(filas).toHaveLength(1);
  });
});

describe("cómo se leen las cifras", () => {
  test("la media no se publica por debajo de cinco casos", () => {
    expect(publishedMeanMinutes([30, 40, 50, 60])).toBeNull();
    expect(publishedMeanMinutes([30, 40, 50, 60, 70])).toBe(50);
  });

  test("la media se redondea a diez minutos", () => {
    // 61, 62, 63, 64 y 65 dan 63 de media: 60, que es lo que se lee.
    expect(publishedMeanMinutes([61, 62, 63, 64, 65])).toBe(60);
  });

  test("las duraciones se escriben como en la portada", () => {
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(60)).toBe("1 h");
    expect(formatMinutes(260)).toBe("4 h 20");
  });

  test("los recuentos se escriben en español", () => {
    expect(formatCount(312)).toBe("312");
    // En español el separador de miles empieza a partir de cinco cifras: 1234
    // se escribe sin punto y 12 345 con él. No es un fallo del formateador, es
    // la convención de `Intl` para es-ES.
    expect(formatCount(1234)).toBe("1234");
    expect(formatCount(12345)).toBe("12.345");
  });
});
