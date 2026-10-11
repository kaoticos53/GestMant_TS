import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import { api } from "../src/convex/_generated/api";
import schema from "../src/convex/schema";
import { DEFAULT_AUDIT_ALERT_ROLES } from "../src/lib/audit";

/** Todos los módulos de funciones de la app (convex-test los levanta in-process). */
const modules = import.meta.glob("../src/convex/**/!(*.*.*)*.*s");

type Test = ReturnType<typeof convexTest>;

async function setup() {
  const t = convexTest(schema, modules);
  const adminId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Ada Admin",
      email: "admin@taller.es",
      role: "admin",
      active: true,
    }),
  );
  const coordinatorId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Elena Vidal",
      email: "coord@taller.es",
      role: "manager",
      active: true,
    }),
  );
  const techId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Iván Torres",
      email: "tecnico@taller.es",
      role: "technician",
      active: true,
    }),
  );
  return {
    t,
    admin: t.withIdentity({ subject: `${adminId}|session1` }),
    coordinator: t.withIdentity({ subject: `${coordinatorId}|session1` }),
    tech: t.withIdentity({ subject: `${techId}|session1` }),
  };
}

/** Lanza la promesa y comprueba que el error contiene el texto. */
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

/** Filas guardadas de la audiencia (siempre debería haber una o ninguna). */
async function settingsRows(t: Test) {
  return await t.run((ctx) => ctx.db.query("auditAlertSettings").collect());
}

describe("auditAlerts.settings — a quién le llegan los avisos del expediente", () => {
  test("sin nada configurado avisa a quien audita", async () => {
    const { admin } = await setup();

    const settings = await admin.query(api.auditAlerts.settings, {});
    expect(settings.roleKeys).toEqual([...DEFAULT_AUDIT_ALERT_ROLES]);
    expect(settings.updatedAt).toBe(null);
    expect(settings.updatedBy).toBe(null);
  });

  test("solo lo lee quien audita el expediente", async () => {
    const { coordinator, tech } = await setup();

    // La coordinación mueve el expediente, pero no lo audita: la lista que
    // decide quién recibe los avisos no es suya.
    await expectConvexError(
      coordinator.query(api.auditAlerts.settings, {}),
      "Solo quien audita el expediente",
    );
    await expectConvexError(
      tech.query(api.auditAlerts.settings, {}),
      "Solo quien audita el expediente",
    );
  });

  test("sin sesión no hay ajustes que leer", async () => {
    const { t } = await setup();

    await expectConvexError(
      t.query(api.auditAlerts.settings, {}),
      "Debes iniciar sesión",
    );
  });
});

describe("auditAlerts.roleOptions — a qué roles se puede apuntar el aviso", () => {
  test("lista los roles del sistema y los personalizados por su nombre", async () => {
    const { admin } = await setup();
    const key = await admin.mutation(api.permissions.createRole, {
      label: "Auxiliar de almacén",
      description: "Gestiona estanterías y avisos de stock",
      templateKey: "technician",
    });

    const options = await admin.query(api.auditAlerts.roleOptions, {});
    expect(options.map((option) => option.key)).toEqual([
      "admin",
      "manager",
      "technician",
      key,
    ]);
    const custom = options.find((option) => option.key === key);
    expect(custom?.label).toBe("Auxiliar de almacén");
    expect(custom?.description).toBe("Gestiona estanterías y avisos de stock");
  });

  test("quien no audita el expediente no puede ver la lista", async () => {
    const { coordinator } = await setup();

    await expectConvexError(
      coordinator.query(api.auditAlerts.roleOptions, {}),
      "Solo quien audita el expediente",
    );
  });
});

describe("auditAlerts.setAudience — quién recibe los avisos del expediente", () => {
  test("quien audita guarda la lista y queda firmada", async () => {
    const { admin } = await setup();

    await admin.mutation(api.auditAlerts.setAudience, {
      roleKeys: ["admin", "manager"],
    });

    const settings = await admin.query(api.auditAlerts.settings, {});
    expect(settings.roleKeys).toEqual(["admin", "manager"]);
    // Se firma quién lo cambió, para poder leerlo en la ficha.
    expect(settings.updatedBy).toBe("Ada Admin");
    expect(settings.updatedAt).toBeGreaterThan(0);
  });

  test("se guarda en una sola fila: el segundo cambio actualiza, no acumula", async () => {
    const { t, admin } = await setup();

    await admin.mutation(api.auditAlerts.setAudience, {
      roleKeys: ["admin"],
    });
    await admin.mutation(api.auditAlerts.setAudience, {
      roleKeys: ["technician"],
    });

    const rows = await settingsRows(t);
    expect(rows).toHaveLength(1);
    expect(rows[0].roleKeys).toEqual(["technician"]);
  });

  test("la audiencia se guarda sin repetidos", async () => {
    const { admin } = await setup();

    await admin.mutation(api.auditAlerts.setAudience, {
      roleKeys: ["manager", "manager", "admin", "manager"],
    });
    expect((await admin.query(api.auditAlerts.settings, {})).roleKeys).toEqual([
      "manager",
      "admin",
    ]);
  });

  test("un rol personalizado se puede apuntar y borrarlo no deja basura", async () => {
    const { admin } = await setup();
    const key = await admin.mutation(api.permissions.createRole, {
      label: "Auxiliar de almacén",
      templateKey: "technician",
    });

    await admin.mutation(api.auditAlerts.setAudience, {
      roleKeys: ["admin", key],
    });
    expect((await admin.query(api.auditAlerts.settings, {})).roleKeys).toEqual([
      "admin",
      key,
    ]);

    await admin.mutation(api.permissions.deleteRole, { key });

    // Ya no existe: apuntarlo otra vez es un error que se ve, no un rol que se
    // queda en la lista dando a entender que alguien lo recibe.
    await expectConvexError(
      admin.mutation(api.auditAlerts.setAudience, { roleKeys: [key] }),
      `Esos roles ya no existen: ${key}`,
    );
    // Y al guardar sin él la audiencia queda limpia.
    await admin.mutation(api.auditAlerts.setAudience, { roleKeys: ["admin"] });
    expect((await admin.query(api.auditAlerts.settings, {})).roleKeys).toEqual([
      "admin",
    ]);
  });

  test("una audiencia vacía es válida: no avisa a nadie", async () => {
    const { admin } = await setup();

    await admin.mutation(api.auditAlerts.setAudience, { roleKeys: [] });
    expect((await admin.query(api.auditAlerts.settings, {})).roleKeys).toEqual(
      [],
    );
  });

  test("quien no audita el expediente no puede cambiarla", async () => {
    const { t, coordinator, tech } = await setup();

    await expectConvexError(
      coordinator.mutation(api.auditAlerts.setAudience, {
        roleKeys: ["manager"],
      }),
      "Solo quien audita el expediente",
    );
    await expectConvexError(
      tech.mutation(api.auditAlerts.setAudience, { roleKeys: ["technician"] }),
      "Solo quien audita el expediente",
    );
    expect(await settingsRows(t)).toHaveLength(0);
  });
});
