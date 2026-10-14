import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import { api } from "../src/convex/_generated/api";
import { DEFAULT_GRANTS } from "../src/lib/permissions";
import schema from "../src/convex/schema";

/** Todos los módulos de funciones de la app (convex-test los levanta in-process). */
const modules = import.meta.glob("../src/convex/**/!(*.*.*)*.*s");

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
    adminId,
    managerId,
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

describe("roles.createRole — alta de roles personalizados", () => {
  test("crea un rol con clave derivada del nombre y plantilla de permisos", async () => {
    const { admin } = await setup();

    const key = await admin.mutation(api.permissions.createRole, {
      label: "Auxiliar de Almacén",
      description: "Gestiona estanterías y avisos de stock",
      templateKey: "technician",
    });
    expect(key).toBe("auxiliar-de-almacen");

    const roles = await admin.query(api.permissions.listRoles, {});
    const created = roles.find((item) => item.key === key);
    expect(created).toBeDefined();
    expect(created?.kind).toBe("custom");
    expect(created?.label).toBe("Auxiliar de Almacén");
    expect(created?.description).toBe("Gestiona estanterías y avisos de stock");
    expect(created?.userCount).toBe(0);
    // La plantilla decide los permisos iniciales (los del técnico)
    expect(created?.grants.createRequests).toBe(true);
    expect(created?.grants.decideRequests).toBe(false);
    expect(created?.grants.manageUsers).toBe(false);
  });

  test("valida nombre, clave reservada y duplicados", async () => {
    const { admin } = await setup();

    await expectConvexError(
      admin.mutation(api.permissions.createRole, { label: "   " }),
      "Indica el nombre del rol",
    );
    await expectConvexError(
      admin.mutation(api.permissions.createRole, { label: "Admin" }),
      "clave reservada",
    );
    await admin.mutation(api.permissions.createRole, {
      label: "Auxiliar de Almacén",
    });
    await expectConvexError(
      admin.mutation(api.permissions.createRole, {
        label: "Auxiliar de Almacén",
      }),
      "Ya existe un rol con un nombre similar",
    );
    await expectConvexError(
      admin.mutation(api.permissions.createRole, {
        label: "Otro rol",
        templateKey: "admin",
      }),
      "elige otro rol de partida",
    );
    await expectConvexError(
      admin.mutation(api.permissions.createRole, {
        label: "Otro rol",
        templateKey: "fantasma",
      }),
      "El rol de partida ya no existe",
    );
  });

  test("solo el administrador crea, renombra y borra roles", async () => {
    const { manager, tech } = await setup();
    const args = { label: "Coordinador de plató" };

    await expectConvexError(
      manager.mutation(api.permissions.createRole, args),
      "Solo el administrador",
    );
    await expectConvexError(
      tech.mutation(api.permissions.createRole, args),
      "Solo el administrador",
    );
    await expectConvexError(
      manager.mutation(api.permissions.updateRole, {
        key: "technician",
        label: "Técnico 2",
      }),
      "Solo el administrador",
    );
    await expectConvexError(
      manager.mutation(api.permissions.deleteRole, { key: "technician" }),
      "Solo el administrador",
    );
  });
});

describe("roles.updateRole / deleteRole", () => {
  test("renomar cambia la etiqueta pero no la clave", async () => {
    const { admin } = await setup();
    const key = await admin.mutation(api.permissions.createRole, {
      label: "Coordinador de plató",
    });

    await admin.mutation(api.permissions.updateRole, {
      key,
      label: "Coordinación de plató",
      description: "Coordina realización y platós",
    });
    const roles = await admin.query(api.permissions.listRoles, {});
    const updated = roles.find((item) => item.key === key);
    expect(updated?.key).toBe("coordinador-de-plato");
    expect(updated?.label).toBe("Coordinación de plató");
    expect(updated?.description).toBe("Coordina realización y platós");

    // Descripción omitida = no tocar
    await admin.mutation(api.permissions.updateRole, { key, label: "Plató" });
    const after = await admin.query(api.permissions.listRoles, {});
    expect(after.find((item) => item.key === key)?.description).toBe(
      "Coordina realización y platós",
    );
  });

  test("los roles del sistema no se renombran ni se borran", async () => {
    const { admin } = await setup();

    await expectConvexError(
      admin.mutation(api.permissions.updateRole, {
        key: "manager",
        label: "Otro nombre",
      }),
      "Los roles del sistema no se pueden renombrar",
    );
    await expectConvexError(
      admin.mutation(api.permissions.deleteRole, { key: "technician" }),
      "Los roles del sistema no se pueden borrar",
    );
  });

  test("no se borra un rol con personas asignadas; al liberarlo, sí", async () => {
    const { admin, techId } = await setup();
    const key = await admin.mutation(api.permissions.createRole, {
      label: "Auxiliar de almacén",
    });
    await admin.mutation(api.members.setRole, { userId: techId, role: key });

    await expectConvexError(
      admin.mutation(api.permissions.deleteRole, { key }),
      "reasígnalas desde el módulo de usuarios",
    );

    // Se libera la persona y el borrado pasa
    await admin.mutation(api.members.setRole, {
      userId: techId,
      role: "technician",
    });
    expect(await admin.mutation(api.permissions.deleteRole, { key })).toBe(true);

    const roles = await admin.query(api.permissions.listRoles, {});
    expect(roles.some((item) => item.key === key)).toBe(false);
    await expectConvexError(
      admin.mutation(api.members.setRole, { userId: techId, role: key }),
      "El rol indicado no existe",
    );
  });

  test("no se guardan permisos de un rol que ya no existe", async () => {
    const { admin } = await setup();
    await expectConvexError(
      admin.mutation(api.permissions.setRolePermissions, {
        role: "rol-fantasma",
        grants: DEFAULT_GRANTS.technician,
      }),
      "Ese rol ya no existe",
    );
  });
});

describe("permisos de un rol personalizado en marcha", () => {
  test("asignado a una persona, sus permisos se aplican en los módulos", async () => {
    const { admin, tech, techId, t } = await setup();
    const key = await admin.mutation(api.permissions.createRole, {
      label: "Auxiliar de almacén",
      templateKey: "technician",
    });
    await admin.mutation(api.permissions.setRolePermissions, {
      role: key,
      grants: { ...DEFAULT_GRANTS.technician, manageInventory: true },
    });
    await admin.mutation(api.members.setRole, {
      userId: techId,
      role: key,
    });

    const perms = await tech.query(api.permissions.myPermissions, {});
    expect(perms.role).toBe(key);
    expect(perms.kind).toBe("custom");
    expect(perms.label).toBe("Auxiliar de almacén");
    expect(perms.grants.manageInventory).toBe(true);
    expect(perms.grants.manageUsers).toBe(false); // bloqueada
    expect(perms.grants.manageEquipment).toBe(false);

    // Puede escribir en el catálogo pero no en equipos
    await tech.mutation(api.spareParts.create, {
      code: "ALM-00001",
      name: "Cable de audio",
      category: "Consumibles",
      unit: "m",
      stock: 5,
      minStock: 1,
    });
    await expectConvexError(
      tech.mutation(api.equipment.create, {
        name: "Equipo nuevo",
        model: "X-1",
      }),
      "gestionar los equipos",
    );
    const parts = await t.run((ctx) => ctx.db.query("spareParts").collect());
    expect(parts).toHaveLength(1);
  });

  test("con «gestionar incidencias» el rol personalizado coordina y se le avisa", async () => {
    const { admin, tech, techId, t } = await setup();
    const key = await admin.mutation(api.permissions.createRole, {
      label: "Jefe de realización",
      templateKey: "technician",
    });
    await admin.mutation(api.permissions.setRolePermissions, {
      role: key,
      grants: { ...DEFAULT_GRANTS.technician, manageIncidents: true },
    });
    const techUserId = techId;
    await admin.mutation(api.members.setRole, {
      userId: techUserId,
      role: key,
    });

    // Antes de que existiera la incidencia ya está en el listado de asignación
    const assignable = await tech.query(api.members.listAssignable, {});
    expect(assignable.length).toBe(3);

    const { reference } = await t.mutation(api.incidents.report, {
      reporterName: "Laura Peña",
      equipmentKind: "Cámara de estudio",
      model: "HDC-3500",
      description: "La cámara se apaga sola en directo cuando se mueve el cable.",
      reportedAt: Date.now() - 60 * 60 * 1000,
    });
    expect(reference).toBe("INC-0001");

    // Los avisos de nueva incidencia llegan a quien tiene la capacidad
    const notifications = await tech.query(api.notifications.list, {});
    expect(
      notifications.some((item) => item.text.includes("Nueva incidencia")),
    ).toBe(true);

    // Y puede asignar a otros (antes lo bloqueaba el rol, no la capacidad)
    const [incident] = await t.run((ctx) =>
      ctx.db.query("incidents").collect(),
    );
    await tech.mutation(api.incidents.assign, {
      incidentId: incident._id,
      assigneeId: techUserId,
    });
    const updated = await t.run((ctx) => ctx.db.get(incident._id));
    expect(updated?.status).toBe("assigned");
    expect(updated?.assigneeId).toBe(techUserId);

    // La capacidad —y no el rol del sistema— es lo que abre los documentos y
    // las notas: un rol personalizado con «manageIncidents» los gestiona.
    await tech.mutation(api.incidents.attachDocument, {
      incidentId: incident._id,
      name: "Informe técnico.pdf",
      note: "Medición previa",
    });
    await tech.mutation(api.incidents.addNote, {
      incidentId: incident._id,
      note: "Coordinado con realización.",
    });
    const withExtras = await t.run((ctx) => ctx.db.get(incident._id));
    expect(withExtras?.documents).toHaveLength(1);
    expect(withExtras?.documents[0].name).toBe("Informe técnico.pdf");
    // Firma quien lo adjuntó, con la capacidad y no con el rol del sistema.
    expect(withExtras?.documents[0].author).toBe("Iván Torres");
    expect(withExtras?.lifecycleNotes).toHaveLength(1);
    expect(withExtras?.lifecycleNotes[0].author).toBe("Iván Torres");
  });

  test("el alta de usuarios acepta la clave de un rol personalizado", async () => {
    const { admin } = await setup();
    const key = await admin.mutation(api.permissions.createRole, {
      label: "Coordinador de audio",
    });

    await expectConvexError(
      admin.action(api.members.createUser, {
        name: "Sin Rol",
        email: "sinrol@taller.es",
        password: "secreto123",
        role: "rol-fantasma",
      }),
      "El rol indicado no existe",
    );

    const userId = await admin.action(api.members.createUser, {
      name: "Marta Soto",
      email: "marta@taller.es",
      password: "secreto123",
      role: key,
    });
    expect(userId).toBeDefined();
    const created = await admin.query(api.members.list, {});
    expect(
      created.find((item) => item.email === "marta@taller.es")?.role,
    ).toBe("coordinador-de-audio");
  });

  test("las capacidades bloqueadas no se conceden a un rol personalizado", async () => {
    const { admin, tech, techId } = await setup();
    const key = await admin.mutation(api.permissions.createRole, {
      label: "Superusuario",
      templateKey: "manager",
    });
    await admin.mutation(api.permissions.setRolePermissions, {
      role: key,
      grants: {
        ...DEFAULT_GRANTS.manager,
        manageUsers: true,
        configurePermissions: true,
      },
    });
    await admin.mutation(api.members.setRole, {
      userId: techId,
      role: key,
    });

    const perms = await tech.query(api.permissions.myPermissions, {});
    expect(perms.grants.manageUsers).toBe(false);
    expect(perms.grants.configurePermissions).toBe(false);
    await expectConvexError(
      tech.query(api.permissions.listRoles, {}),
      "Solo el administrador",
    );
    await expectConvexError(
      tech.query(api.members.list, {}),
      "Solo el administrador",
    );
  });
});

describe("claves de rol inválidas y límites", () => {
  test("una clave de rol huérfana no concede ninguna capacidad", async () => {
    const { t, managerId } = await setup();
    // Clave que no existe en la tabla `roles` (p. ej. un rol borrado a mano
    // o un dato legado): los permisos deben fallar cerrados.
    const ghostId = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Sin rol válido",
        email: "ghost@taller.es",
        role: "rol-borrado",
        active: true,
      }),
    );
    const ghost = t.withIdentity({ subject: `${ghostId}|session1` });

    const perms = await ghost.query(api.permissions.myPermissions, {});
    expect(perms.role).toBe("rol-borrado");
    expect(perms.kind).toBe("custom");
    expect(perms.label).toBe("rol-borrado");
    expect(Object.values(perms.grants).every((granted) => !granted)).toBe(true);

    // Tampoco puede escribir, aunque tenga sesión
    await expectConvexError(
      ghost.mutation(api.messages.send, {
        recipientId: managerId,
        text: "¿Alguien me oye?",
      }),
      "No tienes permisos para enviar mensajes",
    );
  });

  test("renombrar o borrar un rol que ya no existe", async () => {
    const { admin } = await setup();
    await expectConvexError(
      admin.mutation(api.permissions.updateRole, {
        key: "rol-fantasma",
        label: "Otro nombre",
      }),
      "Ese rol ya no existe",
    );
    await expectConvexError(
      admin.mutation(api.permissions.deleteRole, { key: "rol-fantasma" }),
      "Ese rol ya no existe",
    );
  });

  test("el nombre del rol tiene un límite de 60 caracteres (inclusive)", async () => {
    const { admin } = await setup();
    await expectConvexError(
      admin.mutation(api.permissions.createRole, { label: "A".repeat(61) }),
      "no puede superar los 60 caracteres",
    );
    const key = await admin.mutation(api.permissions.createRole, {
      label: "B".repeat(60),
    });
    expect(key).toBe("b".repeat(60));
  });
});

describe("roles y permisos sin sesión", () => {
  test("consultar y configurar exige haber iniciado sesión", async () => {
    const { t } = await setup();
    const anon = t;

    await expectConvexError(
      anon.query(api.permissions.myPermissions, {}),
      "Debes iniciar sesión",
    );
    await expectConvexError(
      anon.query(api.permissions.listRoles, {}),
      "Debes iniciar sesión",
    );
    await expectConvexError(
      anon.query(api.permissions.capabilities, {}),
      "Debes iniciar sesión",
    );
    await expectConvexError(
      anon.mutation(api.permissions.setRolePermissions, {
        role: "technician",
        grants: {},
      }),
      "Debes iniciar sesión",
    );
    await expectConvexError(
      anon.mutation(api.permissions.createRole, { label: "Sin sesión" }),
      "Debes iniciar sesión",
    );
    await expectConvexError(
      anon.mutation(api.permissions.updateRole, {
        key: "technician",
        label: "Sin sesión",
      }),
      "Debes iniciar sesión",
    );
    await expectConvexError(
      anon.mutation(api.permissions.deleteRole, { key: "technician" }),
      "Debes iniciar sesión",
    );
  });
});
