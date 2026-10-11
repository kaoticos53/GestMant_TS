import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import { richDocBlocks, richDocToPlainText } from "../src/lib/richDoc";
import { api } from "../src/convex/_generated/api";
import schema from "../src/convex/schema";

/** Todos los módulos de funciones de la app (convex-test los levanta in-process). */
const modules = import.meta.glob("../src/convex/**/!(*.*.*)*.*s");

type Test = ReturnType<typeof convexTest>;
type Authed = ReturnType<Test["withIdentity"]>;

/** Instancia de test con un usuario autenticado del rol indicado. */
async function authedTest(role: "admin" | "manager" | "technician") {
  const t = convexTest(schema, modules);
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
});
