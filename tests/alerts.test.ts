import { backend } from "./backend";
import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import { api } from "../src/convex/_generated/api";
import {
  DEFAULT_WORK_WITHOUT_TRACE_DAYS,
  DEFAULT_WORK_WITHOUT_TRACE_ROLES,
} from "../src/lib/workshop";

async function setup() {
  const t = backend();
  const adminId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Ada Admin",
      email: "admin@taller.es",
      role: "admin",
      active: true,
    }),
  );
  const managerId = await t.run((ctx) =>
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
    manager: t.withIdentity({ subject: `${managerId}|session1` }),
    tech: t.withIdentity({ subject: `${techId}|session1` }),
    managerId,
  };
}

/** Lanza la promesa y comprueba que el error contiene el texto. */
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

/** Filas guardadas de ajustes del aviso (siempre debería haber una o ninguna). */
async function settingsRows(t: ReturnType<typeof convexTest>) {
  return await t.run((ctx) => ctx.db.query("alertSettings").collect());
}

describe("alerts.settings — ajustes vigentes del aviso", () => {
  test("sin nada configurado devuelve los valores de partida", async () => {
    const { tech } = await setup();

    const settings = await tech.query(api.alerts.settings, {});
    expect(settings.days).toBe(DEFAULT_WORK_WITHOUT_TRACE_DAYS);
    expect(settings.roleKeys).toEqual([...DEFAULT_WORK_WITHOUT_TRACE_ROLES]);
    expect(settings.updatedAt).toBe(null);
    expect(settings.updatedBy).toBe(null);
  });

  test("lo lee cualquier persona con sesión: el panel lo necesita para pintar el aviso", async () => {
    const { admin, manager, tech } = await setup();
    await manager.mutation(api.alerts.setSettings, {
      days: 6,
      roleKeys: ["technician"],
    });

    for (const actor of [admin, manager, tech]) {
      const settings = await actor.query(api.alerts.settings, {});
      expect(settings.days).toBe(6);
      expect(settings.roleKeys).toEqual(["technician"]);
    }
  });

  test("sin sesión no hay ajustes que leer", async () => {
    const { t } = await setup();
    await expectConvexError(
      t.query(api.alerts.settings, {}),
      "Debes iniciar sesión",
    );
  });
});

describe("alerts.roleOptions — a qué roles se puede apuntar el aviso", () => {
  test("lista los roles del sistema y los personalizados por su nombre", async () => {
    const { admin, manager } = await setup();
    const key = await admin.mutation(api.permissions.createRole, {
      label: "Auxiliar de almacén",
      description: "Gestiona estanterías y avisos de stock",
      templateKey: "technician",
    });

    const options = await manager.query(api.alerts.roleOptions, {});
    const keys = options.map((option) => option.key);
    expect(keys).toEqual(["admin", "manager", "technician", key]);
    // «Invitado» no está: es la sesión anónima de consulta, no un rol al que
    // apuntar un aviso —ni uno que se le dé a una persona—.
    expect(keys).not.toContain("guest");
    const custom = options.find((option) => option.key === key);
    expect(custom?.label).toBe("Auxiliar de almacén");
    expect(custom?.description).toBe("Gestiona estanterías y avisos de stock");
  });

  test("quien no coordina las incidencias no puede ver la lista", async () => {
    const { tech } = await setup();
    await expectConvexError(
      tech.query(api.alerts.roleOptions, {}),
      "Solo quien coordina las incidencias",
    );
  });
});

describe("alerts.setSettings — margen y audiencia del aviso", () => {
  test("quien coordina guarda el margen y los roles", async () => {
    const { manager } = await setup();

    await manager.mutation(api.alerts.setSettings, {
      days: 5,
      roleKeys: ["admin", "technician"],
    });

    const settings = await manager.query(api.alerts.settings, {});
    expect(settings.days).toBe(5);
    expect(settings.roleKeys).toEqual(["admin", "technician"]);
    // Se firma quién lo cambió, para poder leerlo en la ficha.
    expect(settings.updatedBy).toBe("Elena Vidal");
    expect(settings.updatedAt).toBeGreaterThan(0);
  });

  test("se guarda en una sola fila: el segundo cambio actualiza, no acumula", async () => {
    const { t, manager, admin } = await setup();

    await manager.mutation(api.alerts.setSettings, {
      days: 4,
      roleKeys: ["manager"],
    });
    await admin.mutation(api.alerts.setSettings, {
      days: 9,
      roleKeys: ["admin"],
    });

    const rows = await settingsRows(t);
    expect(rows).toHaveLength(1);
    expect(rows[0].days).toBe(9);
    expect(rows[0].roleKeys).toEqual(["admin"]);
    expect(rows[0].updatedBy).toBe("Ada Admin");
  });

  test("el técnico no puede configurarlo aunque tenga la sesión abierta", async () => {
    const { tech, t } = await setup();

    await expectConvexError(
      tech.mutation(api.alerts.setSettings, { days: 7, roleKeys: [] }),
      "Solo quien coordina las incidencias",
    );
    expect(await settingsRows(t)).toHaveLength(0);
  });

  test("el margen se queda dentro de los límites del aviso", async () => {
    const { manager, t } = await setup();

    await expectConvexError(
      manager.mutation(api.alerts.setSettings, { days: 0, roleKeys: [] }),
      "entre 1 y 30 días",
    );
    await expectConvexError(
      manager.mutation(api.alerts.setSettings, { days: 31, roleKeys: [] }),
      "entre 1 y 30 días",
    );
    expect(await settingsRows(t)).toHaveLength(0);

    // Los extremos sí entran.
    await manager.mutation(api.alerts.setSettings, { days: 1, roleKeys: [] });
    expect((await manager.query(api.alerts.settings, {})).days).toBe(1);
    await manager.mutation(api.alerts.setSettings, { days: 30, roleKeys: [] });
    expect((await manager.query(api.alerts.settings, {})).days).toBe(30);
  });

  test("un margen con decimales se guarda en días enteros", async () => {
    const { manager } = await setup();

    await manager.mutation(api.alerts.setSettings, {
      days: 4.6,
      roleKeys: [],
    });
    expect((await manager.query(api.alerts.settings, {})).days).toBe(5);
  });

  test("la audiencia se guarda sin repetidos", async () => {
    const { manager } = await setup();

    await manager.mutation(api.alerts.setSettings, {
      days: 3,
      roleKeys: ["admin", "admin", "technician", "admin"],
    });
    expect((await manager.query(api.alerts.settings, {})).roleKeys).toEqual([
      "admin",
      "technician",
    ]);
  });

  test("no se puede apuntar el aviso a un rol que ya no existe", async () => {
    const { manager } = await setup();

    await expectConvexError(
      manager.mutation(api.alerts.setSettings, {
        days: 3,
        roleKeys: ["admin", "auxiliar-de-almacen"],
      }),
      "Esos roles ya no existen: auxiliar-de-almacen",
    );
  });

  test("un rol personalizado borrado sale de la audiencia al volver a guardar", async () => {
    const { admin, manager } = await setup();
    const key = await admin.mutation(api.permissions.createRole, {
      label: "Auxiliar de almacén",
      templateKey: "technician",
    });
    await manager.mutation(api.alerts.setSettings, {
      days: 3,
      roleKeys: ["admin", key],
    });
    expect((await manager.query(api.alerts.settings, {})).roleKeys).toEqual([
      "admin",
      key,
    ]);

    await admin.mutation(api.permissions.deleteRole, { key });

    // Guardar de nuevo sin el rol borrado deja la audiencia limpia.
    const options = await manager.query(api.alerts.roleOptions, {});
    const known = new Set(options.map((option) => option.key));
    const kept = (await manager.query(api.alerts.settings, {})).roleKeys.filter(
      (item) => known.has(item),
    );
    await manager.mutation(api.alerts.setSettings, { days: 3, roleKeys: kept });
    expect((await manager.query(api.alerts.settings, {})).roleKeys).toEqual([
      "admin",
    ]);
  });

  test("una audiencia vacía es válida: el aviso no lo ve nadie", async () => {
    const { manager } = await setup();

    await manager.mutation(api.alerts.setSettings, { days: 3, roleKeys: [] });
    expect((await manager.query(api.alerts.settings, {})).roleKeys).toEqual([]);
  });
});
