import { describe, expect, test } from "vitest";
import { DEFAULT_GRANTS } from "../src/lib/permissions";
import {
  ADMIN_KEY,
  canRestoreDefaults,
  dropRole,
  editableGrants,
  isDirty,
  mergeDraft,
  pendingChanges,
  restoreSystemDefaults,
  sameGrants,
  systemDefaults,
  toggleGrant,
  type Grants,
} from "../src/lib/permissionsDraft";

/** Copia de los permisos por defecto del técnico (rol de partida habitual). */
function technician(): Grants {
  return { ...DEFAULT_GRANTS.technician };
}

/** Fila mínima de un rol, como la que se pasa a la matriz. */
function role(key: string, grants: Grants = technician()) {
  return { key, grants };
}

describe("permisos editables y defaults de código", () => {
  test("el administrador se queda fuera de la matriz", () => {
    const draft = editableGrants([role(ADMIN_KEY), role("manager")]);
    expect(Object.keys(draft)).toEqual(["manager"]);
  });

  test("solo los roles del sistema tienen defaults en el código", () => {
    expect(systemDefaults("manager")).toEqual(DEFAULT_GRANTS.manager);
    expect(systemDefaults("technician")).toEqual(DEFAULT_GRANTS.technician);
    expect(systemDefaults("auxiliar-de-almacen")).toBeNull();
  });

  test("los defaults se devuelven como copia, sin tocar el catálogo", () => {
    const defaults = systemDefaults("technician")!;
    defaults.sendMessages = false;
    expect(DEFAULT_GRANTS.technician.sendMessages).toBe(true);
  });
});

describe("mergeDraft — la matriz no se queda atrás", () => {
  test("sin cambios locales, la matriz es exactamente lo guardado", () => {
    const saved = { technician: technician() };
    expect(mergeDraft(saved, null)).toBe(saved);
  });

  test("un rol borrado en otra pestaña no vuelve al borrador", () => {
    // El borrador guarda «extra», pero ya no está entre los roles guardados.
    const draft = {
      technician: { ...technician(), sendMessages: false },
      extra: { ...technician(), manageInventory: true },
      admin: { ...technician() },
    };
    const saved = { technician: technician() };

    const merged = mergeDraft(saved, draft);
    expect(Object.keys(merged)).toEqual(["technician"]);

    // Y el siguiente cambio tampoco lo reintroduce en el borrador.
    const next = toggleGrant(merged, "technician", "viewRequests");
    expect(Object.keys(next)).toEqual(["technician"]);
  });

  test("un rol creado con cambios sin guardar entra con sus permisos reales", () => {
    // El borrador se tomó antes de crear «nuevo»: no lo conoce.
    const draft = { technician: { ...technician(), manageInventory: true } };
    const saved = {
      technician: technician(),
      nuevo: { ...technician(), viewInventory: true },
    };

    const merged = mergeDraft(saved, draft);
    expect(merged.nuevo).toEqual(saved.nuevo);
    // El cambio local del técnico sigue mandando sobre lo guardado.
    expect(merged.technician.manageInventory).toBe(true);
  });
});

describe("toggleGrant — el interruptor nunca rompe", () => {
  test("invierte una sola capacidad y no muta el borrador que recibe", () => {
    const current = mergeDraft(
      { technician: technician(), nuevo: technician() },
      { technician: { ...technician(), manageInventory: true } },
    );

    const next = toggleGrant(current, "nuevo", "manageInventory");
    expect(next.nuevo.manageInventory).toBe(true);
    expect(next.technician).toEqual(current.technician);
    expect(current.nuevo.manageInventory).toBe(false);
  });

  test("un rol que no está en la matriz se deja igual", () => {
    const current = { technician: technician() };
    expect(toggleGrant(current, "rol-fantasma", "sendMessages")).toBe(current);
    expect(toggleGrant(current, "rol-fantasma", "sendMessages")).toEqual({
      technician: technician(),
    });
  });
});

describe("pendingChanges / isDirty — qué se guarda de verdad", () => {
  test("un rol creado mientras había cambios pendientes no se guarda", () => {
    // Antes: la comparación con JSON.stringify mandaba el rol nuevo con
    // `grants: undefined` y el guardado entero fallaba.
    const draft = { technician: technician() };
    const saved = { technician: technician(), nuevo: technician() };

    expect(pendingChanges(draft, saved)).toEqual([]);
    expect(isDirty(draft, saved)).toBe(false);
  });

  test("solo entran los roles modificados, no el creado después", () => {
    // Borrador tomado antes de crear «nuevo»: no lo conoce y no debe viajar
    // como `grants: undefined` (antes rompía el guardado entero).
    const saved = {
      technician: technician(),
      manager: { ...DEFAULT_GRANTS.manager },
      nuevo: { ...technician(), viewInventory: true },
    };
    const draft = {
      technician: { ...technician(), sendMessages: false },
      manager: { ...DEFAULT_GRANTS.manager },
    };

    expect(pendingChanges(draft, saved)).toEqual([
      { key: "technician", grants: draft.technician },
    ]);
    expect(isDirty(draft, saved)).toBe(true);
  });

  test("un rol borrado con el borrador abierto no deja la pantalla sucia", () => {
    const draft = { technician: technician(), extra: technician() };
    const saved = { technician: technician() };

    expect(pendingChanges(draft, saved)).toEqual([]);
    expect(isDirty(draft, saved)).toBe(false);
  });

  test("los permisos del administrador nunca se guardan", () => {
    const saved = { [ADMIN_KEY]: technician(), technician: technician() };
    const draft = {
      ...saved,
      [ADMIN_KEY]: { ...technician(), sendMessages: false },
    };

    expect(pendingChanges(draft, saved)).toEqual([]);
    expect(isDirty(draft, saved)).toBe(false);
  });
});

describe("restaurar los permisos del sistema", () => {
  test("devuelve los roles del sistema a sus defaults y respeta los personalizados", () => {
    const current = {
      manager: { ...DEFAULT_GRANTS.manager, decideRequests: false },
      technician: technician(),
      "auxiliar-de-almacen": { ...technician(), manageInventory: true },
    };

    const next = restoreSystemDefaults(current);
    expect(next.manager).toEqual(DEFAULT_GRANTS.manager);
    expect(next["auxiliar-de-almacen"].manageInventory).toBe(true);
    expect(current.manager.decideRequests).toBe(false); // no muta la entrada
  });

  test("solo se puede restaurar si un rol del sistema difiere del código", () => {
    expect(
      canRestoreDefaults({
        technician: technician(),
        "auxiliar-de-almacen": { ...technician(), manageInventory: true },
      }),
    ).toBe(false);

    expect(
      canRestoreDefaults({
        technician: technician(),
        manager: { ...DEFAULT_GRANTS.manager, decideRequests: false },
      }),
    ).toBe(true);
  });
});

describe("dropRole — el borrador suelta el rol borrado", () => {
  test("quita la clave y no muta el borrador original", () => {
    const draft = { technician: technician(), extra: technician() };
    const next = dropRole(draft, "extra");
    expect(next).not.toBeNull();
    expect(Object.keys(next!)).toEqual(["technician"]);
    expect(Object.keys(draft)).toEqual(["technician", "extra"]);
  });

  test("sin cambios devuelve el mismo borrador y vacío devuelve null", () => {
    const draft = { technician: technician() };
    expect(dropRole(draft, "otro")).toBe(draft);
    expect(dropRole(draft, "technician")).toBeNull();
  });
});

describe("sameGrants — comparación por capacidad", () => {
  test("el orden de las claves no cambia el resultado", () => {
    const a = { ...DEFAULT_GRANTS.technician };
    const b = Object.fromEntries(
      Object.entries(DEFAULT_GRANTS.technician).reverse(),
    ) as Grants;

    expect(Object.keys(a)).not.toEqual(Object.keys(b));
    expect(sameGrants(a, b)).toBe(true);
  });

  test("una sola capacidad distinta ya cuenta como cambio", () => {
    expect(
      sameGrants(technician(), { ...technician(), decideRequests: true }),
    ).toBe(false);
  });
});
