import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import { api } from "../src/convex/_generated/api";
import { richDocBlocks, richDocToPlainText } from "../src/lib/richDoc";
import { nextReview } from "../src/lib/workshop";
import schema from "../src/convex/schema";

/** Todos los módulos de funciones de la app (convex-test los levanta in-process). */
const modules = import.meta.glob("../src/convex/**/!(*.*.*)*.*s");

/** Test con sesión, rol indicado y un equipo dado de alta. */
async function setup(role: "admin" | "manager" | "technician") {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Usuario de prueba",
      email: `${role}@taller.es`,
      role,
    }),
  );
  const equipmentId = await t.run((ctx) =>
    ctx.db.insert("equipment", {
      code: "EQ-900",
      name: "Cámara de estudio",
      model: "HDC-3500",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
  );
  return {
    t,
    authed: t.withIdentity({ subject: `${userId}|session1` }),
    equipmentId,
  };
}

/** Lanza la promesa y comprueba que el ConvexError contiene el texto. */
async function expectConvexError(promise: Promise<unknown>, fragment: string) {
  const error = await promise.then(
    () => null,
    (err: unknown) => err,
  );
  expect(error, `Se esperaba un error que contuviera: ${fragment}`).not.toBeNull();
  const message =
    error instanceof ConvexError ? String(error.data) : String(error);
  expect(message).toContain(fragment);
}

const baseRecord = {
  kind: "repair" as const,
  title: "Sustitución de la fuente",
  performedAt: Date.now() - 24 * 60 * 60 * 1000,
  technician: "Iván Torres",
};

describe("historial de mantenimiento", () => {
  test("create registra la intervención y aparece en el historial", async () => {
    const { authed, equipmentId } = await setup("manager");
    await authed.mutation(api.maintenance.create, {
      ...baseRecord,
      equipmentId,
      description: "Cortaba en caliente.",
    });

    const list = await authed.query(api.maintenance.list, {});
    expect(list).toHaveLength(1);
    expect(list[0].kind).toBe("repair");
    expect(list[0].title).toBe("Sustitución de la fuente");
    expect(list[0].description).toBe("Cortaba en caliente.");
    expect(list[0].equipmentId).toBe(equipmentId);
    expect(list[0].technician).toBe("Iván Torres");
  });

  test("update edita la intervención y remove la elimina", async () => {
    const { authed, equipmentId } = await setup("admin");
    await authed.mutation(api.maintenance.create, {
      ...baseRecord,
      equipmentId,
    });
    const created = (await authed.query(api.maintenance.list, {}))[0];

    await authed.mutation(api.maintenance.update, {
      id: created._id,
      equipmentId,
      kind: "preventive",
      title: "Revisión semestral",
      performedAt: baseRecord.performedAt,
    });
    const updated = (await authed.query(api.maintenance.list, {}))[0];
    expect(updated.kind).toBe("preventive");
    expect(updated.title).toBe("Revisión semestral");
    expect(updated.description).toBeUndefined();
    expect(updated.technician).toBeUndefined();

    await authed.mutation(api.maintenance.remove, { id: created._id });
    expect(await authed.query(api.maintenance.list, {})).toHaveLength(0);
    // El registro ya no existe: un segundo borrado falla
    await expectConvexError(
      authed.mutation(api.maintenance.remove, { id: created._id }),
      "La intervención ya no existe.",
    );
  });

  test("la descripción se guarda como documento y se lee como texto", async () => {
    const { authed, equipmentId } = await setup("manager");
    await authed.mutation(api.maintenance.create, {
      ...baseRecord,
      equipmentId,
      description:
        "<p>Cortaba en <strong>caliente</strong>.</p><ul><li>Sello nuevo</li></ul>",
    });

    const [record] = await authed.query(api.maintenance.list, {});
    expect(richDocBlocks(record.description)).toEqual([
      {
        type: "paragraph",
        inline: [
          { text: "Cortaba en " },
          { text: "caliente", marks: ["bold"] },
          { text: "." },
        ],
      },
      {
        type: "list",
        ordered: false,
        items: [[{ type: "paragraph", inline: [{ text: "Sello nuevo" }] }]],
      },
    ]);
    expect(record.description).not.toContain("<p>");
    expect(richDocToPlainText(record.description)).toBe(
      "Cortaba en caliente.\nSello nuevo",
    );
  });

  test("una nota de siempre se guarda tal cual y vaciarla la quita", async () => {
    const { authed, equipmentId } = await setup("admin");
    await authed.mutation(api.maintenance.create, {
      ...baseRecord,
      equipmentId,
      description: "  Revisado el ventilador.  ",
    });
    const created = (await authed.query(api.maintenance.list, {}))[0];
    expect(created.description).toBe("Revisado el ventilador.");

    await authed.mutation(api.maintenance.update, {
      id: created._id,
      equipmentId,
      kind: baseRecord.kind,
      title: baseRecord.title,
      performedAt: baseRecord.performedAt,
      description: "<p></p>",
    });
    const [cleared] = await authed.query(api.maintenance.list, {});
    expect(cleared.description).toBeUndefined();
  });

  test("rechaza un resumen vacío y una fecha futura", async () => {
    const { authed, equipmentId } = await setup("manager");
    await expectConvexError(
      authed.mutation(api.maintenance.create, {
        ...baseRecord,
        equipmentId,
        title: "   ",
      }),
      "El resumen de la intervención es obligatorio.",
    );
    await expectConvexError(
      authed.mutation(api.maintenance.create, {
        ...baseRecord,
        equipmentId,
        performedAt: Date.now() + 3 * 24 * 60 * 60 * 1000,
      }),
      "La fecha de la intervención no puede ser futura.",
    );
  });

  test("rechaza un equipo que ya no existe", async () => {
    const { t, authed, equipmentId } = await setup("manager");
    await t.run((ctx) => ctx.db.delete(equipmentId));
    await expectConvexError(
      authed.mutation(api.maintenance.create, {
        ...baseRecord,
        equipmentId,
      }),
      "El equipo ya no existe.",
    );
  });

  test("un técnico no puede registrar intervenciones", async () => {
    const { authed, equipmentId } = await setup("technician");
    await expectConvexError(
      authed.mutation(api.maintenance.create, {
        ...baseRecord,
        equipmentId,
      }),
      "No tienes permisos para registrar intervenciones.",
    );
  });

  test("el historial requiere sesión iniciada", async () => {
    const { t } = await setup("manager");
    await expectConvexError(
      t.query(api.maintenance.list, {}),
      "Debes iniciar sesión para consultar el historial",
    );
  });
});

describe("cálculo de la próxima revisión", () => {
  const DAY = 24 * 60 * 60 * 1000;
  const now = Date.now();

  test("sin intervalo no hay plan de preventivo", () => {
    expect(nextReview([], undefined)).toEqual({ state: "none", dueAt: null });
    expect(nextReview([], 0)).toEqual({ state: "none", dueAt: null });
  });

  test("la última revisión preventiva marca la próxima fecha", () => {
    const performedAt = now - 10 * DAY;
    const result = nextReview(
      [
        { kind: "preventive", performedAt },
        { kind: "repair", performedAt: now - 1 * DAY },
      ],
      90,
    );
    expect(result.state).toBe("ok");
    expect(result.dueAt).toBe(performedAt + 90 * DAY);
  });

  test("una revisión vieja marca el plan como vencido", () => {
    const result = nextReview(
      [{ kind: "preventive", performedAt: now - 100 * DAY }],
      90,
    );
    expect(result.state).toBe("overdue");
  });

  test("sin revisiones se parte de la fecha de alta", () => {
    const purchaseDate = now - 200 * DAY;
    const result = nextReview([], 90, purchaseDate);
    expect(result.state).toBe("overdue");
    expect(result.dueAt).toBe(purchaseDate + 90 * DAY);
  });

  test("las averías no resetean el calendario preventivo", () => {
    const lastPreventive = now - 80 * DAY;
    const result = nextReview(
      [
        { kind: "preventive", performedAt: lastPreventive },
        { kind: "repair", performedAt: now - 1 * DAY },
      ],
      90,
    );
    expect(result.state).toBe("ok");
    expect(result.dueAt).toBe(lastPreventive + 90 * DAY);
  });
});
