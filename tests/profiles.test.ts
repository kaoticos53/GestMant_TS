import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import { api } from "../src/convex/_generated/api";
import schema from "../src/convex/schema";

/** Todos los módulos de funciones de la app (convex-test los levanta in-process). */
const modules = import.meta.glob("../src/convex/**/!(*.*.*)*.*s");

async function setup() {
  const t = convexTest(schema, modules);
  const adminId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Elena Vidal",
      email: "admin@taller.es",
      role: "admin",
    }),
  );
  const techId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Iván Torres",
      email: "tecnico@taller.es",
      role: "technician",
      position: "Cámara",
      location: "Plató 1",
      active: true,
    }),
  );
  return {
    t,
    admin: t.withIdentity({ subject: `${adminId}|session1` }),
    tech: t.withIdentity({ subject: `${techId}|session1` }),
    adminId,
    techId,
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

describe("perfil propio", () => {
  test("actualiza nombre, puesto, ubicación y teléfono", async () => {
    const { t, tech, techId } = await setup();

    await tech.mutation(api.members.updateProfile, {
      name: "Iván Torres Ruiz",
      position: "Cámara principal",
      location: "Plató 2",
      phone: "600 123 456",
    });

    const updated = await t.run((ctx) => ctx.db.get(techId));
    expect(updated?.name).toBe("Iván Torres Ruiz");
    expect(updated?.position).toBe("Cámara principal");
    expect(updated?.location).toBe("Plató 2");
    expect(updated?.phone).toBe("600 123 456");
    // El perfil propio nunca toca el rol
    expect(updated?.role).toBe("technician");
  });

  test("dejar un campo vacío lo limpia de la ficha", async () => {
    const { t, tech, techId } = await setup();

    await tech.mutation(api.members.updateProfile, {
      name: "Iván Torres",
      phone: "",
    });

    const updated = await t.run((ctx) => ctx.db.get(techId));
    expect(updated?.phone).toBeUndefined();
    expect(updated?.position).toBe("Cámara"); // no tocado
  });

  test("rechaza un nombre vacío", async () => {
    const { tech } = await setup();
    await expectConvexError(
      tech.mutation(api.members.updateProfile, { name: "   " }),
      "Indica tu nombre y apellidos.",
    );
  });

  test("guarda el ancho del menú y si está plegado en la ficha", async () => {
    const { t, tech, techId } = await setup();

    await tech.mutation(api.members.saveSidebarLayout, {
      width: 320,
      collapsed: true,
    });

    const saved = await t.run((ctx) => ctx.db.get(techId));
    expect(saved?.sidebarWidth).toBe(320);
    expect(saved?.sidebarCollapsed).toBe(true);
    // Y al desplegar de nuevo se actualiza sin perder el ancho
    await tech.mutation(api.members.saveSidebarLayout, {
      width: 320,
      collapsed: false,
    });
    const reopened = await t.run((ctx) => ctx.db.get(techId));
    expect(reopened?.sidebarWidth).toBe(320);
    expect(reopened?.sidebarCollapsed).toBe(false);
  });

  test("el ancho del menú se guarda dentro de los límites", async () => {
    const { t, tech, techId } = await setup();

    await tech.mutation(api.members.saveSidebarLayout, {
      width: 5000,
      collapsed: false,
    });
    expect((await t.run((ctx) => ctx.db.get(techId)))?.sidebarWidth).toBe(420);

    await tech.mutation(api.members.saveSidebarLayout, {
      width: 10,
      collapsed: false,
    });
    expect((await t.run((ctx) => ctx.db.get(techId)))?.sidebarWidth).toBe(208);
  });

  test("la preferencia del menú es de cada persona", async () => {
    const { t, tech, adminId } = await setup();

    await tech.mutation(api.members.saveSidebarLayout, {
      width: 300,
      collapsed: true,
    });

    // La propia se guarda y su sesión la lee del perfil…
    const techProfile = await tech.query(api.users.currentUser, {});
    expect(techProfile?.sidebarWidth).toBe(300);
    expect(techProfile?.sidebarCollapsed).toBe(true);
    // …y la de nadie más se toca.
    expect((await t.run((ctx) => ctx.db.get(adminId)))?.sidebarWidth).toBe(
      undefined,
    );
  });

  test("sin sesión no se puede guardar la preferencia", async () => {
    const { t } = await setup();
    await expectConvexError(
      t.mutation(api.members.saveSidebarLayout, { width: 300, collapsed: false }),
      "Debes iniciar sesión",
    );
  });

  test("el aviso cerrado se guarda en el perfil, no en el navegador", async () => {
    const { t, tech, techId } = await setup();

    await tech.mutation(api.members.saveWorkAlertDismissal, {
      dismissal: { marginDays: 3, references: [" INC-2 ", "INC-1", "INC-2"] },
    });

    // Va al perfil, con las referencias limpias y ordenadas: entrar desde otro
    // dispositivo devuelve exactamente lo mismo.
    const own = await tech.query(api.users.currentUser, {});
    expect(own?.workAlertDismissal).toEqual({
      marginDays: 3,
      references: ["INC-1", "INC-2"],
    });
    expect((await t.run((ctx) => ctx.db.get(techId)))?.workAlertDismissal)
      .toEqual({ marginDays: 3, references: ["INC-1", "INC-2"] });
  });

  test("el aviso cerrado es de cada persona y se puede olvidar", async () => {
    const { t, tech, adminId } = await setup();

    await tech.mutation(api.members.saveWorkAlertDismissal, {
      dismissal: { marginDays: 7, references: ["INC-9"] },
    });
    expect(
      (await t.run((ctx) => ctx.db.get(adminId)))?.workAlertDismissal,
    ).toBeUndefined();

    // «Volver a mostrar el aviso» lo olvida: el campo desaparece del perfil.
    await tech.mutation(api.members.saveWorkAlertDismissal, { dismissal: null });
    const cleared = await tech.query(api.users.currentUser, {});
    expect(cleared?.workAlertDismissal).toBeUndefined();
  });

  test("sin sesión no se puede cerrar el aviso", async () => {
    const { t } = await setup();
    await expectConvexError(
      t.mutation(api.members.saveWorkAlertDismissal, {
        dismissal: { marginDays: 3, references: ["INC-1"] },
      }),
      "Debes iniciar sesión",
    );
  });
});

describe("edición por el administrador", () => {
  test("edita el perfil de otra persona y lo ve en el listado", async () => {
    const { t, admin, techId } = await setup();

    await admin.mutation(api.members.updateUser, {
      userId: techId,
      name: "Iván T.",
      position: "Audio",
      location: "Plató 3",
      phone: "655 000 111",
    });

    const updated = await t.run((ctx) => ctx.db.get(techId));
    expect(updated?.name).toBe("Iván T.");
    expect(updated?.position).toBe("Audio");

    const list = await admin.query(api.members.list, {});
    const entry = list.find((item) => item._id === techId);
    expect(entry?.position).toBe("Audio");
    expect(entry?.location).toBe("Plató 3");
    expect(entry?.phone).toBe("655 000 111");
    expect(entry?.active).toBe(true);
  });

  test("un técnico no puede editar a otros ni ver el listado", async () => {
    const { tech, adminId } = await setup();
    await expectConvexError(
      tech.mutation(api.members.updateUser, {
        userId: adminId,
        name: "Hackeado",
      }),
      "Solo el administrador puede gestionar usuarios",
    );
    await expectConvexError(
      tech.query(api.members.list, {}),
      "Solo el administrador puede gestionar usuarios",
    );
  });

  test("rechaza editar un usuario que ya no existe", async () => {
    const { t, admin } = await setup();
    const ghost = await t.run((ctx) =>
      ctx.db.insert("users", { name: "Temporal" }),
    );
    await t.run((ctx) => ctx.db.delete(ghost));
    await expectConvexError(
      admin.mutation(api.members.updateUser, { userId: ghost, name: "X" }),
      "El usuario ya no existe.",
    );
  });
});

describe("alta de usuarios", () => {
  test("el administrador da de alta con cuenta de acceso", async () => {
    const { t, admin } = await setup();

    const newId = await admin.action(api.members.createUser, {
      name: "Sandra Ruiz",
      email: "  Sandra@Taller.es ",
      password: "secreta123",
      role: "technician",
      position: "Realización",
      location: "Sala de realización",
    });

    const created = await t.run((ctx) => ctx.db.get(newId));
    expect(created?.name).toBe("Sandra Ruiz");
    expect(created?.email).toBe("sandra@taller.es"); // normalizado
    expect(created?.role).toBe("technician");
    expect(created?.active).toBe(true);
    expect(created?.position).toBe("Realización");
    expect(created?.location).toBe("Sala de realización");

    // La credencial de acceso quedó creada con el proveedor password
    const accounts = await t.run((ctx) => ctx.db.query("authAccounts").collect());
    expect(
      accounts.some(
        (account) =>
          account.provider === "password" &&
          account.providerAccountId === "sandra@taller.es" &&
          Boolean(account.secret),
      ),
    ).toBe(true);
  });

  test("valida correo, contraseña y duplicados", async () => {
    const { admin } = await setup();
    const base = {
      name: "Sandra Ruiz",
      password: "secreta123",
      role: "technician" as const,
    };
    await expectConvexError(
      admin.action(api.members.createUser, { ...base, email: "no-es-correo" }),
      "correo electrónico válido",
    );
    await expectConvexError(
      admin.action(api.members.createUser, {
        ...base,
        email: "sandra@taller.es",
        password: "corta",
      }),
      "al menos 8 caracteres",
    );
    await expectConvexError(
      admin.action(api.members.createUser, {
        ...base,
        email: "tecnico@taller.es",
      }),
      "Ya existe una cuenta con ese correo.",
    );
  });

  test("un técnico no puede dar de alta", async () => {
    const { tech } = await setup();
    await expectConvexError(
      tech.action(api.members.createUser, {
        name: "Sandra Ruiz",
        email: "sandra@taller.es",
        password: "secreta123",
        role: "technician",
      }),
      "Solo el administrador puede gestionar usuarios",
    );
  });
});

describe("bajas y reactivación", () => {
  test("baja, excluye del listado de asignación y reactiva", async () => {
    const { admin, techId } = await setup();

    // Antes de la baja: asignable
    const before = await admin.query(api.members.listAssignable, {});
    expect(before.some((item) => item._id === techId)).toBe(true);

    expect(
      await admin.action(api.members.setActive, {
        userId: techId,
        active: false,
      }),
    ).toBe(true);

    const deactivated = (await admin.query(api.members.list, {})).find(
      (item) => item._id === techId,
    );
    expect(deactivated?.active).toBe(false);
    const during = await admin.query(api.members.listAssignable, {});
    expect(during.some((item) => item._id === techId)).toBe(false);

    // Reactivar
    expect(
      await admin.action(api.members.setActive, { userId: techId, active: true }),
    ).toBe(true);
    const after = await admin.query(api.members.listAssignable, {});
    expect(after.some((item) => item._id === techId)).toBe(true);
  });

  test("sin cambios devuelve false y un usuario inexistente falla", async () => {
    const { t, admin, techId } = await setup();
    expect(
      await admin.action(api.members.setActive, { userId: techId, active: true }),
    ).toBe(false);

    const ghost = await t.run((ctx) =>
      ctx.db.insert("users", { name: "Temporal" }),
    );
    await t.run((ctx) => ctx.db.delete(ghost));
    await expectConvexError(
      admin.action(api.members.setActive, { userId: ghost, active: false }),
      "El usuario ya no existe.",
    );
  });

  test("el administrador no puede darse de baja a sí mismo", async () => {
    const { admin, adminId } = await setup();
    await expectConvexError(
      admin.action(api.members.setActive, { userId: adminId, active: false }),
      "No puedes dar de baja tu propia cuenta.",
    );
  });

  test("un técnico no puede cambiar estados", async () => {
    const { tech, techId } = await setup();
    await expectConvexError(
      tech.action(api.members.setActive, { userId: techId, active: false }),
      "Solo el administrador puede gestionar usuarios",
    );
  });
});

describe("peticiones ligadas al usuario", () => {
  test("create registra el requesterId del solicitante", async () => {
    const { tech, techId } = await setup();

    await tech.mutation(api.partRequests.create, {
      requesterName: "Iván Torres",
      priority: "normal",
      description: "Baterías V-Mount de repuesto.",
    });

    const requests = await tech.query(api.partRequests.list, {});
    expect(requests).toHaveLength(1);
    expect(requests[0].requesterId).toBe(techId);
  });
});
