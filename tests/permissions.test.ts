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

/** Repuesto mínimo para poder crear peticiones con línea. */
async function insertPart(t: ReturnType<typeof convexTest>) {
  return await t.run((ctx) =>
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
}

describe("permissions.myPermissions / list — quién ve qué", () => {
  test("cada rol recibe sus permisos por defecto sin ninguna fila guardada", async () => {
    const { tech, manager, admin } = await setup();

    const technicianPerms = await tech.query(api.permissions.myPermissions, {});
    expect(technicianPerms.role).toBe("technician");
    expect(technicianPerms.grants.createRequests).toBe(true);
    expect(technicianPerms.grants.viewIncidents).toBe(true);
    expect(technicianPerms.grants.manageInventory).toBe(false);
    expect(technicianPerms.grants.manageUsers).toBe(false);

    const managerPerms = await manager.query(api.permissions.myPermissions, {});
    expect(managerPerms.role).toBe("manager");
    expect(managerPerms.grants.manageInventory).toBe(true);
    expect(managerPerms.grants.decideRequests).toBe(true);
    expect(managerPerms.grants.configurePermissions).toBe(false);

    const adminPerms = await admin.query(api.permissions.myPermissions, {});
    expect(adminPerms.role).toBe("admin");
    expect(adminPerms.grants.manageUsers).toBe(true);
    expect(adminPerms.grants.configurePermissions).toBe(true);
  });

  test("solo el administrador consulta la matriz completa", async () => {
    const { admin, manager, tech } = await setup();

    await expectConvexError(
      manager.query(api.permissions.listRoles, {}),
      "Solo el administrador",
    );
    await expectConvexError(
      tech.query(api.permissions.listRoles, {}),
      "Solo el administrador",
    );

    const roles = await admin.query(api.permissions.listRoles, {});
    expect(roles.map((item) => item.key)).toEqual([
      "admin",
      "manager",
      "technician",
    ]);
    const adminRole = roles.find((item) => item.key === "admin");
    const managerRole = roles.find((item) => item.key === "manager");
    const technicianRole = roles.find((item) => item.key === "technician");
    expect(adminRole?.kind).toBe("system");
    expect(adminRole?.grants.manageUsers).toBe(true);
    expect(managerRole?.grants.decideRequests).toBe(true);
    expect(technicianRole?.grants.decideRequests).toBe(false);
    expect(technicianRole?.grants.manageEquipment).toBe(false);
    expect(technicianRole?.userCount).toBe(1);
  });

  test("los catalogados de capacidades solo requieren sesión", async () => {
    const { tech } = await setup();
    const items = await tech.query(api.permissions.capabilities, {});
    expect(items.length).toBeGreaterThanOrEqual(12);
    expect(items.some((item) => item.id === "manageUsers" && item.locked)).toBe(
      true,
    );
  });
});

describe("permissions.setRolePermissions — configuración", () => {
  test("ni responsable ni técnico pueden tocar los permisos", async () => {
    const { manager, tech } = await setup();

    await expectConvexError(
      manager.mutation(api.permissions.setRolePermissions, {
        role: "technician",
        grants: {},
      }),
      "Solo el administrador",
    );
    await expectConvexError(
      tech.mutation(api.permissions.setRolePermissions, {
        role: "manager",
        grants: {},
      }),
      "Solo el administrador",
    );
  });

  test("el rol del administrador no es configurable", async () => {
    const { admin } = await setup();
    await expectConvexError(
      admin.mutation(api.permissions.setRolePermissions, {
        role: "admin",
        grants: {},
      }),
      "El administrador siempre tiene todos los permisos",
    );
  });

  test("las capacidades bloqueadas no se conceden a otros roles", async () => {
    const { admin, tech, t } = await setup();

    await admin.mutation(api.permissions.setRolePermissions, {
      role: "technician",
      grants: {
        ...DEFAULT_GRANTS.technician,
        manageUsers: true,
        configurePermissions: true,
      },
    });

    const perms = await tech.query(api.permissions.myPermissions, {});
    expect(perms.grants.manageUsers).toBe(false);
    expect(perms.grants.configurePermissions).toBe(false);
    await expectConvexError(
      tech.query(api.members.list, {}),
      "Solo el administrador",
    );

    const stored = await t.run((ctx) => ctx.db.query("roles").collect());
    expect(stored).toHaveLength(1);
    expect(stored[0].key).toBe("technician");
    expect(stored[0].kind).toBe("system");
    // Las capacidades bloqueadas se guardan siempre en false.
    expect(stored[0].grants.manageUsers).toBe(false);
    expect(stored[0].grants.configurePermissions).toBe(false);
  });

  test("una clave desconocida se rechaza", async () => {
    const { admin } = await setup();
    await expectConvexError(
      admin.mutation(api.permissions.setRolePermissions, {
        role: "technician",
        grants: { noExiste: true },
      }),
      "Capacidad desconocida",
    );
  });
});

describe("capacidades aplicadas en los módulos", () => {
  test("concedida «modificar repuestos», el técnico puede dar de alta en el catálogo", async () => {
    const { admin, tech, t } = await setup();

    await expectConvexError(
      tech.mutation(api.spareParts.create, {
        code: "NUE-00001",
        name: "Repuesto nuevo",
        category: "Electrónica",
        unit: "ud",
        stock: 1,
        minStock: 0,
      }),
      "gestionar el catálogo",
    );

    await admin.mutation(api.permissions.setRolePermissions, {
      role: "technician",
      grants: { ...DEFAULT_GRANTS.technician, manageInventory: true },
    });

    await tech.mutation(api.spareParts.create, {
      code: "NUE-00001",
      name: "Repuesto nuevo",
      category: "Electrónica",
      unit: "ud",
      stock: 1,
      minStock: 0,
    });
    const parts = await t.run((ctx) => ctx.db.query("spareParts").collect());
    expect(parts).toHaveLength(1);

    const perms = await tech.query(api.permissions.myPermissions, {});
    expect(perms.grants.manageInventory).toBe(true);
  });

  test("quitada «crear peticiones», el técnico deja de poder pedir material", async () => {
    const { admin, tech, t } = await setup();
    const sparePartId = await insertPart(t);

    await admin.mutation(api.permissions.setRolePermissions, {
      role: "technician",
      grants: { ...DEFAULT_GRANTS.technician, createRequests: false },
    });

    await expectConvexError(
      tech.mutation(api.partRequests.create, {
        requesterName: "Iván Torres",
        priority: "normal",
        lines: [{ sparePartId, quantity: 1 }],
      }),
      "crear peticiones",
    );
  });

  test("quitada «decidir peticiones», el responsable ya no puede aprobar", async () => {
    const { admin, manager, tech, t } = await setup();
    const sparePartId = await insertPart(t);

    await tech.mutation(api.partRequests.create, {
      requesterName: "Iván Torres",
      priority: "normal",
      lines: [{ sparePartId, quantity: 1 }],
    });
    const [request] = await t.run((ctx) =>
      ctx.db.query("partRequests").collect(),
    );

    // Con los permisos por defecto sí puede aprobar
    await manager.mutation(api.partRequests.approve, { requestId: request._id });

    // Ahora se le quita la capacidad y la siguiente decisión falla
    await admin.mutation(api.permissions.setRolePermissions, {
      role: "manager",
      grants: { ...DEFAULT_GRANTS.manager, decideRequests: false },
    });
    await expectConvexError(
      manager.mutation(api.partRequests.markIssued, { requestId: request._id }),
      "No tienes permisos",
    );
  });

  test("quitada la capacidad de gestionar incidencias, no puede asignarlas", async () => {
    const { admin, manager, techId, t } = await setup();

    await t.mutation(api.incidents.report, {
      reporterName: "Laura Peña",
      equipmentKind: "Cámara de estudio",
      model: "HDC-3500",
      description: "La cámara se apaga sola en directo cuando se mueve el cable.",
      reportedAt: Date.now() - 60 * 60 * 1000,
    });
    const [incident] = await t.run((ctx) => ctx.db.query("incidents").collect());

    await admin.mutation(api.permissions.setRolePermissions, {
      role: "manager",
      grants: { ...DEFAULT_GRANTS.manager, manageIncidents: false },
    });

    await expectConvexError(
      manager.mutation(api.incidents.assign, {
        incidentId: incident._id,
        assigneeId: techId,
      }),
      "No tienes permisos para asignar incidencias",
    );
    await expectConvexError(
      manager.query(api.members.listAssignable, {}),
      "Solo el coordinador puede asignar incidencias",
    );
  });

  test("quitada «ver la cola de incidencias», el técnico no puede autoasignarse una pendiente", async () => {
    const { admin, manager, tech, t } = await setup();

    const report = {
      reporterName: "Laura Peña",
      equipmentKind: "Cámara de estudio",
      model: "HDC-3500",
      description: "La cámara se apaga sola en directo cuando se mueve el cable.",
      reportedAt: Date.now() - 60 * 60 * 1000,
    };
    await t.mutation(api.incidents.report, report);
    await t.mutation(api.incidents.report, report);
    const [first, second] = await t.run((ctx) =>
      ctx.db.query("incidents").collect(),
    );

    // Con los permisos por defecto el técnico se lleva la primera pendiente.
    await tech.mutation(api.incidents.selfAssign, { incidentId: first._id });

    // Sin la cola de incidencias ya no puede llevarse la segunda…
    await admin.mutation(api.permissions.setRolePermissions, {
      role: "technician",
      grants: { ...DEFAULT_GRANTS.technician, viewIncidents: false },
    });
    await expectConvexError(
      tech.mutation(api.incidents.selfAssign, { incidentId: second._id }),
      "Solo quien ve la cola de incidencias",
    );

    // …y la pendiente sigue libre para quien coordina (manageIncidents basta).
    await manager.mutation(api.incidents.selfAssign, {
      incidentId: second._id,
    });
    const stored = await t.run((ctx) => ctx.db.get(second._id));
    expect(stored?.assigneeName).toBe("Elena Vidal");
  });

  test("quitada la mensajería, el técnico no puede escribir pero sí leer", async () => {
    const { admin, tech, managerId } = await setup();

    await admin.mutation(api.permissions.setRolePermissions, {
      role: "technician",
      grants: { ...DEFAULT_GRANTS.technician, sendMessages: false },
    });

    await expectConvexError(
      tech.mutation(api.messages.send, {
        recipientId: managerId,
        text: "¿Me pasas el cable SDI?",
      }),
      "No tienes permisos para enviar mensajes",
    );
    expect(await tech.query(api.messages.list, {})).toEqual([]);
    expect(await tech.query(api.messages.contacts, {})).toHaveLength(2);
  });

  test("restaurar los defaults recupera el comportamiento original", async () => {
    const { admin, tech } = await setup();

    await admin.mutation(api.permissions.setRolePermissions, {
      role: "technician",
      grants: {
        ...DEFAULT_GRANTS.technician,
        viewIncidents: false,
        viewRequests: false,
        sendMessages: false,
      },
    });
    let perms = await tech.query(api.permissions.myPermissions, {});
    expect(perms.grants.viewIncidents).toBe(false);
    expect(perms.grants.sendMessages).toBe(false);

    await admin.mutation(api.permissions.setRolePermissions, {
      role: "technician",
      grants: DEFAULT_GRANTS.technician,
    });
    perms = await tech.query(api.permissions.myPermissions, {});
    expect(perms.grants).toEqual(DEFAULT_GRANTS.technician);
  });
});

describe("lectura del catálogo (la usan también las peticiones)", () => {
  /** Equipo mínimo para comprobar la lista de inventario. */
  async function insertEquipment(t: ReturnType<typeof convexTest>) {
    return await t.run((ctx) =>
      ctx.db.insert("equipment", {
        name: "Cámara de estudio",
        model: "HDX-1",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );
  }

  test("el técnico sigue consultando el catálogo aunque no vea el módulo", async () => {
    const { tech, t } = await setup();
    await insertPart(t);
    await insertEquipment(t);

    const perms = await tech.query(api.permissions.myPermissions, {});
    expect(perms.grants.viewInventory).toBe(false); // el módulo sigue oculto
    expect(perms.grants.viewEquipment).toBe(false);
    expect(perms.grants.lookupCatalog).toBe(true); // pero puede consultarlo al pedir
    expect(perms.grants.lookupEquipment).toBe(false); // y no entra en incidencias

    // La capacidad se puede configurar desde la matriz
    const items = await tech.query(api.permissions.capabilities, {});
    expect(items.some((item) => item.id === "lookupCatalog")).toBe(true);

    // Y con ella las dos listas siguen llegando al formulario de peticiones
    expect(await tech.query(api.spareParts.list, {})).toHaveLength(1);
    expect(await tech.query(api.equipment.list, {})).toHaveLength(1);
  });

  test("sin ver el módulo ni poder consultar, el catálogo llega vacío y sin error", async () => {
    const { admin, tech, t, techId } = await setup();
    await insertPart(t);
    await insertEquipment(t);

    const key = await admin.mutation(api.permissions.createRole, {
      label: "Sin catálogo",
      templateKey: "technician",
    });
    await admin.mutation(api.permissions.setRolePermissions, {
      role: key,
      grants: {
        ...DEFAULT_GRANTS.technician,
        viewInventory: false,
        viewEquipment: false,
        lookupCatalog: false,
      },
    });
    await admin.mutation(api.members.setRole, { userId: techId, role: key });

    expect(await tech.query(api.spareParts.list, {})).toEqual([]);
    expect(await tech.query(api.equipment.list, {})).toEqual([]);

    // Puede seguir pidiendo material describiéndolo a mano
    const reference = await tech.mutation(api.partRequests.create, {
      requesterName: "Iván Torres",
      priority: "normal",
      description: "Necesitamos cable SDI de 5 m para el plató 2",
    });
    expect(reference).toBe("PET-0001");
  });

  test("conceder «ver el catálogo de repuestos» devuelve la lista sin más cambios", async () => {
    const { admin, tech, t, techId } = await setup();
    await insertPart(t);
    await insertEquipment(t);

    const key = await admin.mutation(api.permissions.createRole, {
      label: "Almacén",
      templateKey: "technician",
    });
    await admin.mutation(api.permissions.setRolePermissions, {
      role: key,
      grants: {
        ...DEFAULT_GRANTS.technician,
        viewInventory: true,
        lookupCatalog: false,
      },
    });
    await admin.mutation(api.members.setRole, { userId: techId, role: key });

    expect(await tech.query(api.spareParts.list, {})).toHaveLength(1);
    // El inventario de equipos sigue cerrado: no tiene esa capacidad
    expect(await tech.query(api.equipment.list, {})).toEqual([]);
  });

  test("«consultar el inventario» devuelve los equipos al verificar incidencias sin abrir el módulo", async () => {
    const { admin, tech, t, techId } = await setup();
    await insertEquipment(t);

    // Rol que gestiona incidencias sin ver el módulo de equipos ni el catálogo.
    const key = await admin.mutation(api.permissions.createRole, {
      label: "Supervisor",
      templateKey: "technician",
    });
    await admin.mutation(api.permissions.setRolePermissions, {
      role: key,
      grants: {
        ...DEFAULT_GRANTS.technician,
        manageIncidents: true,
        viewEquipment: false,
        lookupCatalog: false,
      },
    });
    await admin.mutation(api.members.setRole, { userId: techId, role: key });

    // Sin la capacidad el diálogo de incidencias se queda sin equipos…
    expect(await tech.query(api.equipment.list, {})).toEqual([]);

    // …y con ella vuelve, sin abrir el módulo (sigue sin `viewEquipment` ni
    // `lookupCatalog`: la lista solo llega por la capacidad nueva).
    await admin.mutation(api.permissions.setRolePermissions, {
      role: key,
      grants: {
        ...DEFAULT_GRANTS.technician,
        manageIncidents: true,
        viewEquipment: false,
        lookupCatalog: false,
        lookupEquipment: true,
      },
    });
    const perms = await tech.query(api.permissions.myPermissions, {});
    expect(perms.grants.viewEquipment).toBe(false);
    expect(perms.grants.lookupEquipment).toBe(true);
    expect(await tech.query(api.equipment.list, {})).toHaveLength(1);

    // Y la capacidad sale en la matriz para poder concederla.
    const items = await tech.query(api.permissions.capabilities, {});
    expect(items.some((item) => item.id === "lookupEquipment")).toBe(true);
  });
});
