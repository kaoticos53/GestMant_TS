import { backend } from "./backend";
import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import { richDocBlocks, richDocToPlainText } from "../src/lib/richDoc";
import { api } from "../src/convex/_generated/api";

type Test = ReturnType<typeof convexTest>;
type Authed = ReturnType<Test["withIdentity"]>;

/** Instancia de test con un usuario autenticado del rol indicado. */
async function authedTest(role: "admin" | "manager" | "technician") {
  const t = backend();
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Usuario de prueba",
      email: `${role}@taller.es`,
      role,
    }),
  );
  return { t, authed: t.withIdentity({ subject: `${userId}|session1` }) };
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

const ALTA = new Date(2024, 4, 15).getTime();
const GARANTIA = new Date(2027, 4, 15).getTime();
const BAJA = new Date(2026, 0, 10).getTime();

const baseEquipment = {
  code: "EQ-100",
  brand: "Hakko",
  name: "Estación de soldadura",
  model: "FX-999",
  location: "Taller SMD",
} as const;

async function findEquipment(authed: Authed, code: string) {
  const list = await authed.query(api.equipment.list, {});
  return list.find((item) => item.code === code);
}

describe("equipos: ficha de compra y ciclo de vida", () => {
  test("create guarda serie, proveedor y fechas", async () => {
    const { authed } = await authedTest("manager");
    await authed.mutation(api.equipment.create, {
      ...baseEquipment,
      serialNumber: "FX999-2405-0001",
      supplier: "Farnell",
      purchaseDate: ALTA,
      warrantyEndDate: GARANTIA,
      decommissionDate: BAJA,
    });

    const item = await findEquipment(authed, "EQ-100");
    expect(item).toBeDefined();
    expect(item!.serialNumber).toBe("FX999-2405-0001");
    expect(item!.supplier).toBe("Farnell");
    expect(item!.purchaseDate).toBe(ALTA);
    expect(item!.warrantyEndDate).toBe(GARANTIA);
    expect(item!.decommissionDate).toBe(BAJA);
  });

  test("create sin ficha no crea campos vacíos", async () => {
    const { authed } = await authedTest("manager");
    await authed.mutation(api.equipment.create, baseEquipment);

    const item = await findEquipment(authed, "EQ-100");
    expect(item!.serialNumber).toBeUndefined();
    expect(item!.supplier).toBeUndefined();
    expect(item!.purchaseDate).toBeUndefined();
    expect(item!.warrantyEndDate).toBeUndefined();
    expect(item!.decommissionDate).toBeUndefined();
  });

  test("create rechaza una fecha de baja anterior al alta", async () => {
    const { authed } = await authedTest("manager");
    await expectConvexError(
      authed.mutation(api.equipment.create, {
        ...baseEquipment,
        code: "EQ-101",
        purchaseDate: ALTA,
        decommissionDate: ALTA - 1000,
      }),
      "La fecha de baja no puede ser anterior a la fecha de alta.",
    );
  });

  test("create rechaza un fin de garantía anterior al alta", async () => {
    const { authed } = await authedTest("admin");
    await expectConvexError(
      authed.mutation(api.equipment.create, {
        ...baseEquipment,
        code: "EQ-102",
        purchaseDate: ALTA,
        warrantyEndDate: ALTA - 1000,
      }),
      "El fin de garantía no puede ser anterior a la fecha de alta.",
    );
  });

  test("update guarda los cambios y limpia las fechas vaciadas", async () => {
    const { authed } = await authedTest("admin");
    await authed.mutation(api.equipment.create, {
      ...baseEquipment,
      serialNumber: "FX999-2405-0001",
      supplier: "Farnell",
      purchaseDate: ALTA,
      warrantyEndDate: GARANTIA,
    });
    const created = (await findEquipment(authed, "EQ-100"))!;

    await authed.mutation(api.equipment.update, {
      id: created._id,
      code: "EQ-100",
      brand: "Hakko",
      name: "Estación de soldadura",
      model: "FX-999",
      serialNumber: "CAMBIADO-0042",
      purchaseDate: ALTA,
      // Sin garantía ni baja: al ir en `undefined`, el patch elimina el campo
      warrantyEndDate: undefined,
      decommissionDate: undefined,
    });

    const updated = (await findEquipment(authed, "EQ-100"))!;
    expect(updated.serialNumber).toBe("CAMBIADO-0042");
    expect(updated.purchaseDate).toBe(ALTA);
    expect(updated.warrantyEndDate).toBeUndefined();
    expect(updated.decommissionDate).toBeUndefined();
  });

  test("update rechaza una fecha de baja anterior al alta", async () => {
    const { authed } = await authedTest("admin");
    await authed.mutation(api.equipment.create, baseEquipment);
    const created = (await findEquipment(authed, "EQ-100"))!;

    await expectConvexError(
      authed.mutation(api.equipment.update, {
        id: created._id,
        code: "EQ-100",
        name: "Estación de soldadura",
        model: "FX-999",
        purchaseDate: ALTA,
        decommissionDate: ALTA - 1,
      }),
      "La fecha de baja no puede ser anterior a la fecha de alta.",
    );
  });

  test("un técnico no puede crear equipos", async () => {
    const { authed } = await authedTest("technician");
    await expectConvexError(
      authed.mutation(api.equipment.create, baseEquipment),
      "No tienes permisos para gestionar los equipos.",
    );
  });
});

describe("equipos: la descripción es la nota del equipo", () => {
  test("guarda el formato como documento y se lee como texto", async () => {
    const { authed } = await authedTest("manager");
    const html =
      "<p>Grabadora de <strong>campo</strong> para exteriores.</p><ul><li>Con dos baterías</li></ul>";
    await authed.mutation(api.equipment.create, {
      ...baseEquipment,
      description: html,
    });

    const item = (await findEquipment(authed, "EQ-100"))!;
    // Lo que se guarda es el documento del editor —sus bloques y sus marcas—,
    // no el HTML con el que se escribió...
    expect(richDocBlocks(item.description)).toEqual([
      {
        type: "paragraph",
        inline: [
          { text: "Grabadora de " },
          { text: "campo", marks: ["bold"] },
          { text: " para exteriores." },
        ],
      },
      {
        type: "list",
        ordered: false,
        items: [[{ type: "paragraph", inline: [{ text: "Con dos baterías" }] }]],
      },
    ]);
    expect(item.description).not.toContain("<p>");
    // ...y lo que lee el buscador o un informe es su texto, sin formato.
    expect(richDocToPlainText(item.description)).toBe(
      "Grabadora de campo para exteriores.\nCon dos baterías",
    );
  });

  test("una nota de siempre se guarda tal cual y vaciarla la quita", async () => {
    const { authed } = await authedTest("admin");
    await authed.mutation(api.equipment.create, {
      ...baseEquipment,
      description: "  Comprada de segunda mano en el mercadillo.  ",
    });
    const created = (await findEquipment(authed, "EQ-100"))!;
    expect(created.description).toBe(
      "Comprada de segunda mano en el mercadillo.",
    );

    // El editor vacío deja un párrafo vacío: eso no es una nota, así que el
    // equipo se queda sin descripción en vez de con un hueco en blanco.
    await authed.mutation(api.equipment.update, {
      id: created._id,
      code: "EQ-100",
      name: "Estación de soldadura",
      model: "FX-999",
      description: "<p></p>",
    });
    const cleared = (await findEquipment(authed, "EQ-100"))!;
    expect(cleared.description).toBeUndefined();
  });

  test("create sin código genera automáticamente el siguiente correlativo único", async () => {
    const { authed } = await authedTest("manager");
    const id1 = await authed.mutation(api.equipment.create, {
      name: "Cámara de estudio",
      model: "HDC-3500",
    });
    const id2 = await authed.mutation(api.equipment.create, {
      name: "Óptica teleobjetivo",
      model: "HJ24ex7.5B",
    });

    const list = await authed.query(api.equipment.list, {});
    const eq1 = list.find((e) => e._id === id1);
    const eq2 = list.find((e) => e._id === id2);

    expect(eq1?.code).toMatch(/^EQ-\d{3,}$/);
    expect(eq2?.code).toMatch(/^EQ-\d{3,}$/);
    expect(eq1?.code).not.toEqual(eq2?.code);
  });

  test("nextCode sugiere el siguiente código correlativo libre", async () => {
    const { authed } = await authedTest("manager");
    const next = await authed.query(api.equipment.nextCode, {});
    expect(next).toMatch(/^EQ-\d{3,}$/);
  });

  test("create con código repetido falla por colisión de unicidad", async () => {
    const { authed } = await authedTest("manager");
    await authed.mutation(api.equipment.create, {
      code: "EQ-555",
      name: "Monitor de vídeo",
      model: "LMD-A240",
    });

    await expectConvexError(
      authed.mutation(api.equipment.create, {
        code: "eq-555",
        name: "Monitor duplicado",
        model: "LMD-A240",
      }),
      "Ya existe un equipo con el código EQ-555.",
    );
  });

  test("create y update vinculan incidencias sin equipo y no tocan las ya vinculadas ni retiradas", async () => {
    const { t, authed } = await authedTest("admin");
    const now = Date.now();
    const otroEqId = await authed.mutation(api.equipment.create, {
      code: "EQ-700",
      name: "Monitor referencia",
      model: "PVM-1741",
    });

    const incPorSerieId = await t.run((ctx) =>
      ctx.db.insert("incidents", {
        reference: "INC-0701",
        reporterName: "Laura",
        description: "Sin imagen",
        model: "Otro modelo",
        serialNumber: "SN-XYZ-99",
        reportedAt: now,
        status: "reported",
        history: [{ status: "reported", at: now, by: "Laura" }],
        createdAt: now,
        updatedAt: now,
      }),
    );
    const incPorModeloId = await t.run((ctx) =>
      ctx.db.insert("incidents", {
        reference: "INC-0702",
        reporterName: "Laura",
        description: "Botón atascado",
        model: "HDC-4300",
        reportedAt: now,
        status: "reported",
        history: [{ status: "reported", at: now, by: "Laura" }],
        createdAt: now,
        updatedAt: now,
      }),
    );
    const incYaVinculadaId = await t.run((ctx) =>
      ctx.db.insert("incidents", {
        reference: "INC-0703",
        reporterName: "Laura",
        description: "Ya vinculada",
        model: "HDC-4300",
        equipmentId: otroEqId,
        reportedAt: now,
        status: "reported",
        history: [{ status: "reported", at: now, by: "Laura" }],
        createdAt: now,
        updatedAt: now,
      }),
    );
    const incRetiradaId = await t.run((ctx) =>
      ctx.db.insert("incidents", {
        reference: "INC-0704",
        reporterName: "Laura",
        description: "Retirada",
        model: "HDC-4300",
        deletedAt: now,
        reportedAt: now,
        status: "reported",
        history: [{ status: "reported", at: now, by: "Laura" }],
        createdAt: now,
        updatedAt: now,
      }),
    );

    const nuevoEqId = await authed.mutation(api.equipment.create, {
      code: "EQ-701",
      name: "Cámara 4K",
      model: "HDC-4300",
      serialNumber: "SN-TEMP",
    });

    expect(
      (await t.run((ctx) => ctx.db.get(incPorModeloId)))?.equipmentId,
    ).toBe(nuevoEqId);
    expect(
      (await t.run((ctx) => ctx.db.get(incYaVinculadaId)))?.equipmentId,
    ).toBe(otroEqId);
    expect(
      (await t.run((ctx) => ctx.db.get(incRetiradaId)))?.equipmentId,
    ).toBeUndefined();
    expect(
      (await t.run((ctx) => ctx.db.get(incPorSerieId)))?.equipmentId,
    ).toBeUndefined();

    // Al actualizar el número de serie, enlaza la incidencia pendiente por serie
    await authed.mutation(api.equipment.update, {
      id: nuevoEqId,
      code: "EQ-701",
      name: "Cámara 4K",
      model: "HDC-4300",
      serialNumber: "SN-XYZ-99",
    });
    expect(
      (await t.run((ctx) => ctx.db.get(incPorSerieId)))?.equipmentId,
    ).toBe(nuevoEqId);
  });

  test("remove desvincula solo las peticiones de repuestos del equipo borrado", async () => {
    const { t, authed } = await authedTest("admin");
    const now = Date.now();
    const eqBorrado = await authed.mutation(api.equipment.create, {
      code: "EQ-801",
      name: "Grabador A",
      model: "Ki Pro Ultra",
    });
    const eqConservado = await authed.mutation(api.equipment.create, {
      code: "EQ-802",
      name: "Grabador B",
      model: "Ki Pro Ultra",
    });

    const reqBorrada = await t.run((ctx) =>
      ctx.db.insert("partRequests", {
        reference: "PET-0801",
        requesterName: "Teo",
        priority: "normal",
        status: "pending",
        equipmentId: eqBorrado,
        equipment: "Grabador A Ki Pro Ultra",
        lines: [],
        createdAt: now,
      }),
    );
    const reqAjena = await t.run((ctx) =>
      ctx.db.insert("partRequests", {
        reference: "PET-0802",
        requesterName: "Teo",
        priority: "normal",
        status: "pending",
        equipmentId: eqConservado,
        equipment: "Grabador B Ki Pro Ultra",
        lines: [],
        createdAt: now,
      }),
    );

    await authed.mutation(api.equipment.remove, { id: eqBorrado });

    expect((await t.run((ctx) => ctx.db.get(reqBorrada)))?.equipmentId).toBeUndefined();
    expect((await t.run((ctx) => ctx.db.get(reqAjena)))?.equipmentId).toBe(
      eqConservado,
    );
  });

  test("relatedSummary devuelve repuestos compatibles y peticiones propias o de texto libre sin mezclar otro equipo", async () => {
    const { t, authed } = await authedTest("admin");
    const now = Date.now();

    const eqPrincipal = await authed.mutation(api.equipment.create, {
      code: "EQ-901",
      name: "Consola Mezcla 1",
      model: "QL5",
    });
    const eqHermano = await authed.mutation(api.equipment.create, {
      code: "EQ-902",
      name: "Consola Mezcla 2",
      model: "QL5",
    });
    const eqDoc = await t.run((ctx) => ctx.db.get(eqPrincipal));
    expect(eqDoc?.modelId).toBeDefined();

    const partCompatibleId = await t.run((ctx) =>
      ctx.db.insert("spareParts", {
        code: "FAD-QL5",
        name: "Fader motorizado QL5",
        category: "Audio",
        unit: "ud",
        stock: 4,
        minStock: 1,
        compatibleModels: [eqDoc!.modelId!],
        createdAt: now,
        updatedAt: now,
      }),
    );

    const reqPropia = await t.run((ctx) =>
      ctx.db.insert("partRequests", {
        reference: "PET-0901",
        requesterName: "Teo",
        priority: "normal",
        status: "pending",
        equipmentId: eqPrincipal,
        equipment: "Consola Mezcla 1 QL5",
        lines: [],
        createdAt: now - 3000,
      }),
    );
    const reqTextoLibre = await t.run((ctx) =>
      ctx.db.insert("partRequests", {
        reference: "PET-0902",
        requesterName: "Teo",
        priority: "normal",
        status: "pending",
        equipment: "Consola QL5 de plató",
        lines: [],
        createdAt: now - 2000,
      }),
    );
    // Vinculada explícitamente a otro equipo del mismo modelo: no debe colarse
    await t.run((ctx) =>
      ctx.db.insert("partRequests", {
        reference: "PET-0903",
        requesterName: "Teo",
        priority: "normal",
        status: "pending",
        equipmentId: eqHermano,
        equipment: "Consola Mezcla 2 QL5",
        lines: [],
        createdAt: now - 1000,
      }),
    );
    // Petición retirada: excluida
    await t.run((ctx) =>
      ctx.db.insert("partRequests", {
        reference: "PET-0904",
        requesterName: "Teo",
        priority: "normal",
        status: "pending",
        equipmentId: eqPrincipal,
        deletedAt: now,
        lines: [],
        createdAt: now,
      }),
    );

    const summary = await authed.query(api.equipment.relatedSummary, {
      equipmentId: eqPrincipal,
    });
    expect(summary).not.toBeNull();
    expect(summary!.compatible.map((p) => p._id)).toEqual([partCompatibleId]);
    expect(summary!.requests.map((r) => r._id).sort()).toEqual(
      [reqPropia, reqTextoLibre].sort(),
    );
  });
});
