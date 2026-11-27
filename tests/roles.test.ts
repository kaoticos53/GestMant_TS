import { backend } from "./backend";
import { ConvexError } from "convex/values";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../src/convex/_generated/api";

async function setup(
  role?: "admin" | "manager" | "technician",
  email = "user@taller.es",
) {
  const t = backend();
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Usuario de prueba",
      email,
      ...(role ? { role } : {}),
    }),
  );
  const authed = t.withIdentity({ subject: `${userId}|session1` });
  return { t, authed, userId };
}

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

describe("members.ensureRole — rol inicial", () => {
  test("la cuenta del administrador recibe rol admin", async () => {
    const { t, authed, userId } = await setup(undefined, "admin@taller.es");
    expect(await authed.mutation(api.members.ensureRole, {})).toBe("admin");
    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user?.role).toBe("admin");
  });

  test("el resto de usuarios entra como técnico y es idempotente", async () => {
    const { t, authed } = await setup(undefined, "tecnico@taller.es");
    // El taller ya tiene administrador: el primero que entra lo es, así que sin
    // uno previo este usuario también saldría administrador.
    await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Ada Admin",
        email: "admin@taller.es",
        role: "admin",
      }),
    );
    expect(await authed.mutation(api.members.ensureRole, {})).toBe("technician");
    expect(await authed.mutation(api.members.ensureRole, {})).toBe("technician");
  });

  test("un usuario con correo admin@taller.es no recibe rol admin si ya existe un administrador", async () => {
    const { t, authed, userId } = await setup(undefined, "admin@taller.es");
    // Simulamos que ya existe un administrador previo registrado
    await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Administrador Real",
        email: "jefa@taller.es",
        role: "admin",
      }),
    );
    // El nuevo registro con correo admin@taller.es debe ser degradado a técnico
    expect(await authed.mutation(api.members.ensureRole, {})).toBe("technician");
    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user?.role).toBe("technician");
  });

  test("no cambia un rol ya asignado", async () => {
    const { authed } = await setup("manager", "responsable@taller.es");
    expect(await authed.mutation(api.members.ensureRole, {})).toBe("manager");
  });
});

describe("members.list / setRole — solo administrador", () => {
  test("un técnico no puede listar usuarios", async () => {
    const { authed } = await setup("technician");
    await expectConvexError(
      authed.query(api.members.list, {}),
      "Solo el administrador",
    );
  });

  test("el administrador lista a todos los usuarios", async () => {
    const { t, authed } = await setup("admin");
    await t.run((ctx) =>
      ctx.db.insert("users", { name: "Otro", email: "otro@taller.es" }),
    );
    const users = await authed.query(api.members.list, {});
    expect(users).toHaveLength(2);
  });

  test("un responsable no puede cambiar roles", async () => {
    const { t, authed } = await setup("manager");
    const targetId = await t.run((ctx) =>
      ctx.db.insert("users", { name: "Otro", email: "otro@taller.es" }),
    );
    await expectConvexError(
      authed.mutation(api.members.setRole, { userId: targetId, role: "admin" }),
      "Solo el administrador",
    );
  });

  test("el administrador promueve a responsable y no puede cambiar su propio rol", async () => {
    const { t, authed, userId } = await setup("admin");
    const targetId = await t.run((ctx) =>
      ctx.db.insert("users", { name: "Otro", email: "otro@taller.es" }),
    );

    await authed.mutation(api.members.setRole, {
      userId: targetId,
      role: "manager",
    });
    const target = await t.run((ctx) => ctx.db.get(targetId));
    expect(target?.role).toBe("manager");

    await expectConvexError(
      authed.mutation(api.members.setRole, { userId, role: "technician" }),
      "No puedes cambiar tu propio rol",
    );
  });
});

describe("permisos de negocio", () => {
  async function partAndFreeRequest(t: ReturnType<typeof convexTest>) {
    const sparePartId = await t.run((ctx) =>
      ctx.db.insert("spareParts", {
        code: "TRI-60004",
        name: "Triac BTA16-600B",
        category: "Electrónica",
        unit: "ud",
        stock: 10,
        minStock: 2,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );
    return { sparePartId };
  }

  test("un técnico crea peticiones pero no puede aprobar", async () => {
    const { t, authed } = await setup("technician");
    const { sparePartId } = await partAndFreeRequest(t);

    const reference = await authed.mutation(api.partRequests.create, {
      requesterName: "Técnico de prueba",
      priority: "normal",
      lines: [{ sparePartId, quantity: 1 }],
    });
    expect(reference).toBe("PET-0001");

    const [request] = await authed.query(api.partRequests.list, {});
    await expectConvexError(
      authed.mutation(api.partRequests.approve, { requestId: request._id }),
      "No tienes permisos",
    );
    await expectConvexError(
      authed.mutation(api.partRequests.reject, { requestId: request._id }),
      "No tienes permisos",
    );

    const part = await t.run((ctx) => ctx.db.get(sparePartId));
    expect(part?.stock).toBe(10);
  });

  test("un técnico no puede escribir en el catálogo ni en equipos", async () => {
    const { authed } = await setup("technician");

    await expectConvexError(
      authed.mutation(api.spareParts.create, {
        code: "NUE-00001",
        name: "Repuesto nuevo",
        category: "Electrónica",
        unit: "ud",
        stock: 1,
        minStock: 0,
      }),
      "gestionar el catálogo",
    );

    await expectConvexError(
      authed.mutation(api.equipment.create, {
        code: "EQ-099",
        name: "Equipo nuevo",
        model: "X-1",
      }),
      "gestionar los equipos",
    );
  });

  test("el responsable aprueba y descuenta stock", async () => {
    const { t, authed } = await setup("manager");
    const { sparePartId } = await partAndFreeRequest(t);

    const reference = await authed.mutation(api.partRequests.create, {
      requesterName: "Técnico de prueba",
      priority: "normal",
      lines: [{ sparePartId, quantity: 2 }],
    });
    expect(reference).toBe("PET-0001");

    const [request] = await authed.query(api.partRequests.list, {});
    await authed.mutation(api.partRequests.approve, { requestId: request._id });

    const [approved] = await authed.query(api.partRequests.list, {});
    expect(approved.status).toBe("approved");
    const part = await t.run((ctx) => ctx.db.get(sparePartId));
    expect(part?.stock).toBe(8);
  });

  test("un técnico no puede cargar los datos de ejemplo", async () => {
    const { authed } = await setup("technician");
    await expectConvexError(
      authed.mutation(api.seed.seedDemoData, {}),
      "No tienes permisos",
    );
  });
});

describe("múltiples roles por usuario (setRoles y unión OR de capacidades)", () => {
  test("setRoles combina capacidades de varios roles, revoca sesiones, audita y protege borrado", async () => {
    const { t, authed: admin, userId: adminId } = await setup("admin", "admin@taller.es");
    const customKey = await admin.mutation(api.permissions.createRole, {
      label: "Auxiliar de almacén",
    });
    await admin.mutation(api.permissions.setRolePermissions, {
      role: customKey,
      grants: { viewInventory: true, managePurchasing: true },
    });

    const targetId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("users", {
        name: "Lucía Multirrol",
        email: "lucia@taller.es",
        role: "technician",
        active: true,
      });
      await ctx.db.insert("authSessions", {
        userId: id,
        expirationTime: Date.now() + 60_000,
      });
      await ctx.db.insert("spareParts", {
        code: "FUS-001",
        name: "Fusible 5A",
        category: "Alimentación",
        unit: "ud",
        stock: 10,
        minStock: 2,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      return id;
    });

    await admin.mutation(api.members.setRoles, {
      userId: targetId,
      roles: ["technician", customKey],
    });

    // Sesión revocada tras el cambio de roles
    const remainingSessions = await t.run((ctx) =>
      ctx.db
        .query("authSessions")
        .withIndex("userId", (q) => q.eq("userId", targetId))
        .collect(),
    );
    expect(remainingSessions).toHaveLength(0);

    // Log de auditoría registrado
    const auditLogs = await t.run((ctx) =>
      ctx.db.query("securityAuditLog").collect(),
    );
    const changeLog = auditLogs.find((row) => row.action === "role_change");
    expect(changeLog).toBeDefined();
    expect(changeLog?.metadata).toContain(customKey);

    // myPermissions devuelve la unión OR de ambos roles
    const lucia = t.withIdentity({ subject: `${targetId}|session2` });
    const perms = await lucia.query(api.permissions.myPermissions, {});
    expect(perms.roles).toEqual(["technician", customKey]);
    expect(perms.role).toBe("technician");
    expect(perms.label).toContain("Técnico");
    expect(perms.label).toContain("Auxiliar de almacén");
    expect(perms.grants.viewIncidents).toBe(true);
    expect(perms.grants.createRequests).toBe(true);
    expect(perms.grants.viewInventory).toBe(true);
    expect(perms.grants.managePurchasing).toBe(true);

    // search.global ve repuestos gracias al rol secundario
    const searchRes = await lucia.query(api.search.global, {
      query: "Fusible",
    });
    expect(searchRes.parts).toHaveLength(1);

    // listRoles cuenta al usuario en ambos roles y deleteRole bloquea borrar el rol secundario
    const allRoles = await admin.query(api.permissions.listRoles, {});
    expect(allRoles.find((r) => r.key === customKey)?.userCount).toBe(1);
    await expectConvexError(
      admin.mutation(api.permissions.deleteRole, { key: customKey }),
      "reasígnalas desde el módulo de usuarios",
    );

    // Validaciones negativas de setRoles
    await expectConvexError(
      admin.mutation(api.members.setRoles, { userId: targetId, roles: [] }),
      "Asigna al menos un rol",
    );
    await expectConvexError(
      admin.mutation(api.members.setRoles, {
        userId: targetId,
        roles: ["guest"],
      }),
      "solo para sesiones anónimas",
    );
    await expectConvexError(
      admin.mutation(api.members.setRoles, {
        userId: adminId,
        roles: ["admin"],
      }),
      "No puedes cambiar tus propios roles",
    );

    // Incluir "admin" junto a otro rol deja "admin" como rol principal
    await admin.mutation(api.members.setRoles, {
      userId: targetId,
      roles: ["technician", "admin"],
    });
    const list = await admin.query(api.members.list, {});
    const luciaRow = list.find((u) => u._id === targetId);
    expect(luciaRow?.role).toBe("admin");
    expect(luciaRow?.roles).toEqual(["admin", "technician"]);
  });

  test("createUser admite asignar varios roles en el alta", async () => {
    const { authed: admin } = await setup("admin", "admin@taller.es");
    const customKey = await admin.mutation(api.permissions.createRole, {
      label: "Compras",
    });

    const newId = await admin.action(api.members.createUser, {
      name: "Mario Dual",
      email: "mario@taller.es",
      password: "Password123!",
      roles: ["technician", customKey],
    });

    const list = await admin.query(api.members.list, {});
    const mario = list.find((u) => u._id === newId);
    expect(mario?.roles).toEqual(["technician", customKey]);
  });
});
