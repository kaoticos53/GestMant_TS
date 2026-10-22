import { describe, expect, it } from "vitest";
import { DEFAULT_GRANTS } from "@/lib/permissions";
import {
  ADMIN_KEY,
  canRestoreDefaults,
  dropRole,
  editableGrants,
  isDirty,
  mergeDraft,
  pendingChanges,
  restoreSystemDefaults,
  toggleGrant,
} from "@/lib/permissionsDraft";
import type { RoleInfo } from "@/pages/dashboard/permissions/types";

describe("Gestión del borrador de la matriz de permisos (PermissionsMatrix)", () => {
  const dummyRoles: RoleInfo[] = [
    {
      key: ADMIN_KEY,
      label: "Administrador",
      description: "Control total",
      kind: "system",
      grants: { ...DEFAULT_GRANTS.admin },
      userCount: 1,
    },
    {
      key: "manager",
      label: "Responsable",
      description: "Gestión de taller",
      kind: "system",
      grants: { ...DEFAULT_GRANTS.manager },
      userCount: 2,
    },
    {
      key: "technician",
      label: "Técnico",
      description: "Operaciones de mantenimiento",
      kind: "system",
      grants: { ...DEFAULT_GRANTS.technician },
      userCount: 5,
    },
    {
      key: "almacen",
      label: "Almacenero",
      description: "Gestión de repuestos",
      kind: "custom",
      grants: { ...DEFAULT_GRANTS.technician, manageInventory: true },
      userCount: 1,
    },
  ];

  it("excluye al administrador de los roles editables", () => {
    const saved = editableGrants(dummyRoles);
    expect(Object.keys(saved)).toEqual(["manager", "technician", "almacen"]);
    expect(saved[ADMIN_KEY]).toBeUndefined();
  });

  it("detecta que no hay cambios (dirty === false) cuando el draft es idéntico a lo guardado", () => {
    const saved = editableGrants(dummyRoles);
    expect(isDirty({ ...saved }, saved)).toBe(false);
  });

  it("detecta cambios pendientes (dirty === true) tras conmutar un permiso", () => {
    const saved = editableGrants(dummyRoles);
    const toggled = toggleGrant(saved, "technician", "manageInventory");
    expect(isDirty(toggled, saved)).toBe(true);

    const changes = pendingChanges(toggled, saved);
    expect(changes.length).toBe(1);
    expect(changes[0].key).toBe("technician");
    expect(changes[0].grants.manageInventory).toBe(!saved.technician.manageInventory);
  });

  it("fusiona el borrador con lo guardado descartando roles que hayan sido borrados en backend", () => {
    const saved = editableGrants(dummyRoles); // manager, technician, almacen
    const draft = {
      technician: { ...saved.technician, sendMessages: false },
      rolInexistente: { ...saved.technician },
    };

    const merged = mergeDraft(saved, draft);
    expect(merged.technician.sendMessages).toBe(false);
    expect(merged.rolInexistente).toBeUndefined();
    expect(merged.manager).toEqual(saved.manager);
  });

  it("comprueba la restauración a valores por defecto del sistema", () => {
    const saved = editableGrants(dummyRoles);
    expect(canRestoreDefaults(saved)).toBe(false);

    // Modificamos un rol de sistema
    const modified = toggleGrant(saved, "technician", "sendMessages");
    expect(canRestoreDefaults(modified)).toBe(true);

    // Restauramos
    const restored = restoreSystemDefaults(modified);
    expect(canRestoreDefaults(restored)).toBe(false);
    expect(restored.technician.sendMessages).toBe(DEFAULT_GRANTS.technician.sendMessages);
    // Preserva los permisos de roles personalizados
    expect(restored.almacen).toEqual(saved.almacen);
  });

  it("elimina un rol del borrador correctamente con dropRole", () => {
    const saved = editableGrants(dummyRoles);
    const afterDrop = dropRole(saved, "almacen");
    expect(afterDrop.almacen).toBeUndefined();
    expect(afterDrop.technician).toBeDefined();
    expect(afterDrop.manager).toBeDefined();
  });
});
