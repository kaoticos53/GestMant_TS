import { backend } from "./backend";
import { describe, expect, test } from "vitest";
import { api } from "../src/convex/_generated/api";

async function setup() {
  const t = backend();
  const adminId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Admin",
      email: "admin@taller.es",
      role: "admin",
    }),
  );

  return {
    t,
    admin: t.withIdentity({ subject: `${adminId}|session1` }),
  };
}

describe("Paginación por cursor en Convex (paginatedList)", () => {
  test("api.spareParts.paginatedList pagina los repuestos por cursor", async () => {
    const { t, admin } = await setup();

    // Insertar 5 repuestos
    await t.run(async (ctx) => {
      for (let i = 1; i <= 5; i++) {
        await ctx.db.insert("spareParts", {
          code: `REP-${String(i).padStart(3, "0")}`,
          name: `Pieza de repuesto ${i}`,
          category: "Mecánica",
          unit: "ud",
          stock: 10,
          minStock: 2,
          createdAt: 1000 + i,
          updatedAt: 1000 + i,
        });
      }
    });

    // Pedir primera página de 2 elementos
    const firstPage = await admin.query(api.spareParts.paginatedList, {
      paginationOpts: { numItems: 2, cursor: null },
    });

    expect(firstPage.page.length).toBe(2);
    expect(firstPage.isDone).toBe(false);
    expect(firstPage.continueCursor).toBeTruthy();

    // Pedir segunda página con el cursor
    const secondPage = await admin.query(api.spareParts.paginatedList, {
      paginationOpts: { numItems: 2, cursor: firstPage.continueCursor },
    });

    expect(secondPage.page.length).toBe(2);
    expect(secondPage.isDone).toBe(false);
    expect(secondPage.page[0]._id).not.toBe(firstPage.page[0]._id);

    // Pedir tercera página
    const thirdPage = await admin.query(api.spareParts.paginatedList, {
      paginationOpts: { numItems: 2, cursor: secondPage.continueCursor },
    });

    expect(thirdPage.page.length).toBe(1);
    expect(thirdPage.isDone).toBe(true);
  });

  test("api.incidents.paginatedList pagina las incidencias respetando filtros de borrado", async () => {
    const { t, admin } = await setup();

    // Insertar 4 incidencias, una de ellas borrada/retirada
    await t.run(async (ctx) => {
      for (let i = 1; i <= 3; i++) {
        await ctx.db.insert("incidents", {
          reference: `INC-2026-${String(i).padStart(4, "0")}`,
          reporterName: `Notificador ${i}`,
          location: "Plató 1",
          description: `Incidencia ${i}`,
          reportedAt: 2000 + i,
          status: "reported",
          history: [{ status: "reported", at: 2000 + i }],
          createdAt: 2000 + i,
          updatedAt: 2000 + i,
        });
      }
      // Incidencia retirada a la papelera
      await ctx.db.insert("incidents", {
        reference: "INC-2026-9999",
        reporterName: "Retirado",
        location: "Plató 1",
        description: "Retirada",
        reportedAt: 3000,
        status: "reported",
        history: [{ status: "reported", at: 3000 }],
        deletedAt: 3500,
        createdAt: 3000,
        updatedAt: 3500,
      });
    });

    const page = await admin.query(api.incidents.paginatedList, {
      paginationOpts: { numItems: 10, cursor: null },
    });

    // Solo deben salir las 3 vivas, la retirada queda filtrada
    expect(page.page.length).toBe(3);
    expect(page.page.some((inc) => inc.reference === "INC-2026-9999")).toBe(false);
  });

  test("api.purchasing.paginatedOrders pagina las órdenes de compra", async () => {
    const { t, admin } = await setup();

    await t.run(async (ctx) => {
      for (let i = 1; i <= 3; i++) {
        await ctx.db.insert("purchaseOrders", {
          reference: `OC-${String(i).padStart(4, "0")}`,
          supplier: "Proveedor Test",
          status: "pending",
          orderedAt: 1000 + i,
          orderedBy: "Admin",
          requestRefs: [],
          lines: [],
          createdAt: 1000 + i,
          updatedAt: 1000 + i,
        });
      }
    });

    const page = await admin.query(api.purchasing.paginatedOrders, {
      paginationOpts: { numItems: 2, cursor: null },
    });

    expect(page.page.length).toBe(2);
    expect(page.isDone).toBe(false);
    expect(page.continueCursor).toBeTruthy();
  });
});
