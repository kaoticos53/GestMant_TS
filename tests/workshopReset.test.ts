import { backend } from "./backend";
import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import { api } from "../src/convex/_generated/api";
import type { TableNames } from "../src/convex/_generated/dataModel";

/** Las tablas del taller que vacía el reset (las cuentas y los ajustes no). */
const WORKSHOP_TABLES: TableNames[] = [
  "spareParts",
  "equipment",
  // Los catálogos maestros y el de modelos son del taller: se vacían con él y
  // la muestra los vuelve a levantar desde el inventario.
  "equipmentModels",
  "catalogs",
  "incidents",
  "incidentDocuments",
  "incidentDocumentLog",
  "partRequests",
  "requestDecisions",
  "purchaseRequests",
  "purchaseOrders",
  "receptions",
  "maintenanceRecords",
  "manuals",
  "notifications",
  "messages",
  "reportUploads",
  "storageCleanupRuns",
  "reportUploadPurges",
  "trashFiles",
  "weeklyReports",
  "appSettings",
];

/** Test con sesión iniciada y el rol indicado. */
async function authedTest(role: "admin" | "manager" | "technician") {
  const t = backend();
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Usuario de prueba",
      email: `${role}@taller.es`,
      role,
    }),
  );
  return t.withIdentity({ subject: `${userId}|session1` });
}

/** Cuántas filas quedan en cada tabla del taller. */
async function countWorkshopRows(t: Awaited<ReturnType<typeof authedTest>>) {
  return await t.run(async (ctx) => {
    const counts: Record<string, number> = {};
    for (const table of WORKSHOP_TABLES) {
      counts[table] = (await ctx.db.query(table).collect()).length;
    }
    return counts;
  });
}

describe("vaciar el taller", () => {
  test("deja la base sin datos y permite volver a sembrar la muestra", async () => {
    const authed = await authedTest("admin");
    expect(await authed.mutation(api.seed.seedDemoData, {})).toBe(true);

    // Con la muestra cargada hay trabajo en todas las mesas grandes.
    const before = await countWorkshopRows(authed);
    expect(before.spareParts).toBeGreaterThan(0);
    expect(before.equipment).toBeGreaterThan(0);
    expect(before.incidents).toBeGreaterThan(0);
    expect(before.partRequests).toBeGreaterThan(0);
    expect(before.appSettings).toBeGreaterThan(0);

    const result = await authed.action(api.workshopReset.resetWorkshop, {});
    expect(result.deleted).toBeGreaterThan(0);

    // Ninguna tabla del taller queda con nada.
    const after = await countWorkshopRows(authed);
    for (const table of WORKSHOP_TABLES) {
      expect(after[table], `la tabla ${table} debería quedar vacía`).toBe(0);
    }

    // El flag de «muestra cargada» se fue con las demás: la muestra se puede
    // volver a cargar como si fuera una instalación nueva.
    expect(await authed.mutation(api.seed.seedDemoData, {})).toBe(true);
  });

  test("no se lleva las cuentas ni los ajustes de fondo", async () => {
    const authed = await authedTest("admin");
    await authed.mutation(api.seed.seedDemoData, {});
    await authed.mutation(api.archive.setSettings, {
      enabled: true,
      afterMonths: 9,
    });
    const before = await authed.run((ctx) => ctx.db.query("users").collect());

    await authed.action(api.workshopReset.resetWorkshop, {});

    // Las cuentas son lo que no se toca: ni quien vacía el taller —que sigue
    // con su sesión y su rol— ni el equipo que trajo la muestra.
    const users = await authed.run((ctx) => ctx.db.query("users").collect());
    expect(users.map((user) => user._id).sort()).toEqual(
      before.map((user) => user._id).sort(),
    );
    expect(users.filter((user) => user.role === "admin")).toHaveLength(1);

    // Y el archivado automático conserva lo que se ajustó.
    const archive = await authed.query(api.archive.settings, {});
    expect(archive?.afterMonths).toBe(9);
  });

  test("un responsable de repuestos (manager) no puede vaciar el taller", async () => {
    const manager = await authedTest("manager");
    const error = await manager.action(api.workshopReset.resetWorkshop, {}).then(
      () => null,
      (err: unknown) => err,
    );
    expect(error).toBeInstanceOf(ConvexError);
    const message =
      error instanceof ConvexError ? String(error.data) : String(error);
    expect(message).toContain("No tienes permisos para vaciar el taller.");
  });

  test("un técnico no puede vaciar el taller", async () => {
    const tech = await authedTest("technician");
    const error = await tech.action(api.workshopReset.resetWorkshop, {}).then(
      () => null,
      (err: unknown) => err,
    );
    expect(error).toBeInstanceOf(ConvexError);
    const message =
      error instanceof ConvexError ? String(error.data) : String(error);
    expect(message).toContain("No tienes permisos para vaciar el taller.");
  });

  test("una cuenta dada de baja no puede vaciar el taller", async () => {
    const t = backend();
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Responsable Inactivo",
        email: "inactivo@taller.es",
        role: "manager",
        active: false,
      }),
    );
    const authed = t.withIdentity({ subject: `${userId}|session1` });
    const error = await authed.action(api.workshopReset.resetWorkshop, {}).then(
      () => null,
      (err: unknown) => err,
    );
    expect(error).toBeInstanceOf(ConvexError);
    const message =
      error instanceof ConvexError ? String(error.data) : String(error);
    expect(message).toContain("Debes iniciar sesión para vaciar el taller.");
  });

  test("un invitado anónimo no puede vaciar el taller", async () => {
    const t = backend();
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Invitado",
        isAnonymous: true,
        role: "guest",
      }),
    );
    const authed = t.withIdentity({ subject: `${userId}|session1` });
    const error = await authed.action(api.workshopReset.resetWorkshop, {}).then(
      () => null,
      (err: unknown) => err,
    );
    expect(error).toBeInstanceOf(ConvexError);
    const message =
      error instanceof ConvexError ? String(error.data) : String(error);
    expect(message).toContain("Debes iniciar sesión para vaciar el taller.");
  });
});
