import { backend } from "./backend";
import { ConvexError } from "convex/values";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../src/convex/_generated/api";
import type { Id } from "../src/convex/_generated/dataModel";

type Test = ReturnType<typeof convexTest>;

async function authedTest() {
  const t = backend();
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Responsable de modelos",
      email: "modelos@taller.es",
      role: "admin",
    }),
  );
  return { t, authed: t.withIdentity({ subject: `${userId}|session1` }) };
}

async function expectConvexError(promise: Promise<unknown>, fragment: string) {
  const error = await promise.then(
    () => null,
    (err: unknown) => err,
  );
  expect(
    error,
    `Se esperaba un error que contuviera: ${fragment}`,
  ).not.toBeNull();
  const message =
    error instanceof ConvexError ? String(error.data) : String(error);
  expect(message).toContain(fragment);
}

describe("Catálogo maestro de modelos de equipos (equipmentModels)", () => {
  test("ensureModel registra un modelo técnico sin instanciar un equipo físico", async () => {
    const { t, authed } = await authedTest();

    // Invocar ensureModel con solo el modelo (como ocurre en la creación al vuelo de repuestos)
    const modelId = await authed.mutation(api.equipmentModels.ensureModel, {
      model: "Toyota 8FGF25",
    });

    expect(modelId).toBeDefined();

    // Comprobar que existe en la tabla equipmentModels
    const modelDoc = await t.run((ctx) => ctx.db.get(modelId));
    expect(modelDoc).not.toBeNull();
    expect(modelDoc?.model).toBe("Toyota 8FGF25");
    expect(modelDoc?.name).toBe("Toyota 8FGF25");

    // Verificar que NO se ha creado ningún equipo físico en la tabla equipment
    const physicalEquip = await t.run((ctx) => ctx.db.query("equipment").collect());
    expect(physicalEquip).toHaveLength(0);

    // Si se vuelve a invocar con el mismo modelo, es idempotente y devuelve el mismo id
    const secondId = await authed.mutation(api.equipmentModels.ensureModel, {
      model: "Toyota 8FGF25",
    });
    expect(secondId).toBe(modelId);
  });

  test("create y update permiten editar la ficha técnica de un modelo", async () => {
    const { t, authed } = await authedTest();

    const modelId = await authed.mutation(api.equipmentModels.create, {
      brand: "Rexroth",
      model: "A10VSO",
      name: "Bomba de pistones axiales",
      category: "Hidráulica",
      defaultMaintenanceIntervalDays: 180,
      defaultSupplier: "Bosch Rexroth",
      description: "Bomba de desplazamiento variable",
    });

    const created = await t.run((ctx) => ctx.db.get(modelId));
    expect(created?.brand).toBe("Rexroth");
    expect(created?.defaultMaintenanceIntervalDays).toBe(180);

    // Actualizar datos del modelo
    await authed.mutation(api.equipmentModels.update, {
      id: modelId,
      brand: "Bosch Rexroth",
      model: "A10VSO-71",
      name: "Bomba axial de pistones 71cc",
      category: "Hidráulica de potencia",
      defaultMaintenanceIntervalDays: 90,
      defaultSupplier: "Bosch Rexroth España",
      description: "Versión actualizada con mayor cilindrada",
    });

    const updated = await t.run((ctx) => ctx.db.get(modelId));
    expect(updated?.brand).toBe("Bosch Rexroth");
    expect(updated?.model).toBe("A10VSO-71");
    expect(updated?.name).toBe("Bomba axial de pistones 71cc");
    expect(updated?.defaultMaintenanceIntervalDays).toBe(90);
  });

  test("remove impide borrar un modelo con equipos físicos asociados", async () => {
    const { t, authed } = await authedTest();

    const modelId = await authed.mutation(api.equipmentModels.create, {
      model: "HDC-3500",
      name: "Cámara de estudio",
      brand: "Sony",
    });

    // Crear un equipo físico que referencia este modelId
    await t.run((ctx) =>
      ctx.db.insert("equipment", {
        modelId,
        code: "EQ-001",
        name: "Cámara Plató 1",
        model: "HDC-3500",
        brand: "Sony",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );

    await expectConvexError(
      authed.mutation(api.equipmentModels.remove, { id: modelId }),
      "No se puede eliminar el modelo porque hay equipos en el inventario asociados a él",
    );
  });

  test("remove borra el modelo si no tiene equipos físicos ni manuales y desvincula repuestos", async () => {
    const { t, authed } = await authedTest();

    const modelId = await authed.mutation(api.equipmentModels.create, {
      model: "NDR-150-24",
      name: "Fuente de alimentación carril DIN",
      brand: "Mean Well",
    });

    // Crear un repuesto compatible con este modelo
    const partId = await t.run((ctx) =>
      ctx.db.insert("spareParts", {
        code: "PWR-001",
        name: "Fuente 24V",
        category: "Electricidad",
        unit: "ud",
        stock: 5,
        minStock: 2,
        compatibleModels: [modelId],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );

    // Eliminar el modelo
    await authed.mutation(api.equipmentModels.remove, { id: modelId });

    // El modelo ya no existe
    const deletedModel = await t.run((ctx) => ctx.db.get(modelId));
    expect(deletedModel).toBeNull();

    // El repuesto debe seguir existiendo pero con compatibleModels limpio sin ese id
    const partAfter = await t.run((ctx) => ctx.db.get(partId));
    expect(partAfter).not.toBeNull();
    expect(partAfter?.compatibleModels).toEqual([]);
  });
});
