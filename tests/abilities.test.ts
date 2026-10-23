import { describe, expect, it } from "vitest";
import {
  allowsOn,
  defineAbilityFor,
  emptyAbility,
  type AbilityActor,
} from "@/lib/abilities";
import type { Capability } from "@/lib/permissions";

const tecnico: AbilityActor = {
  id: "user-tecnico",
  role: "technician",
};

/** Las mismas casillas que marca la pantalla de permisos. */
const todasLasCapacidades: Partial<Record<Capability, boolean>> = {
  viewIncidents: true,
  manageIncidents: true,
  viewRequests: true,
  createRequests: true,
  decideRequests: true,
  viewInventory: true,
  manageInventory: true,
  viewEquipment: true,
  manageEquipment: true,
  viewManuals: true,
  manageManuals: true,
  viewAudit: true,
};

function incidencia(extra: Record<string, unknown> = {}) {
  return { status: "in_progress", assigneeId: "otro-tecnico", ...extra };
}

describe("defineAbilityFor", () => {
  it("no concede nada a una sesión invitada ni a una cuenta dada de baja", () => {
    expect(allowsOn(emptyAbility(), "view", "Incident", incidencia())).toBe(
      false,
    );

    const deBaja = defineAbilityFor(
      { ...tecnico, active: false },
      todasLasCapacidades,
    );
    expect(allowsOn(deBaja, "update", "Incident", incidencia())).toBe(false);

    const anonimo = defineAbilityFor(
      { ...tecnico, isAnonymous: true },
      todasLasCapacidades,
    );
    expect(allowsOn(anonimo, "view", "InventoryItem", {})).toBe(false);
  });

  it("deja al técnico trabajar la incidencia que tiene asignada", () => {
    const ability = defineAbilityFor(tecnico);

    expect(
      allowsOn(
        ability,
        "update",
        "Incident",
        incidencia({ assigneeId: tecnico.id }),
      ),
    ).toBe(true);
    expect(
      allowsOn(
        ability,
        "close",
        "Incident",
        incidencia({ workshopAssigneeId: tecnico.id }),
      ),
    ).toBe(true);
  });

  it("no deja al técnico tocar la incidencia de otro sin la capacidad", () => {
    const ability = defineAbilityFor(tecnico);

    expect(allowsOn(ability, "update", "Incident", incidencia())).toBe(false);
    expect(allowsOn(ability, "close", "Incident", incidencia())).toBe(false);
  });

  it("con «manageIncidents» el técnico coordina cualquier incidencia abierta", () => {
    const ability = defineAbilityFor(tecnico, { manageIncidents: true });

    expect(allowsOn(ability, "update", "Incident", incidencia())).toBe(true);
    expect(allowsOn(ability, "assign", "Incident", incidencia())).toBe(true);
  });

  it("lo cerrado no se retoca aunque se tenga la capacidad", () => {
    const ability = defineAbilityFor(tecnico, todasLasCapacidades);

    for (const status of ["resolved", "unresolved"]) {
      expect(
        allowsOn(ability, "update", "Incident", incidencia({ status })),
      ).toBe(false);
      expect(
        allowsOn(ability, "close", "Incident", incidencia({ status })),
      ).toBe(false);
    }
    // La consulta sí sigue permitida: se lee el histórico, no se reabre.
    expect(
      allowsOn(ability, "view", "Incident", incidencia({ status: "resolved" })),
    ).toBe(true);
  });

  it("el administrador puede con todo salvo la traza de seguridad", () => {
    const admin = defineAbilityFor({ id: "user-admin", role: "admin" });

    expect(allowsOn(admin, "manage", "Equipment", {})).toBe(true);
    expect(allowsOn(admin, "update", "Incident", incidencia())).toBe(true);
    expect(allowsOn(admin, "delete", "Audit", {})).toBe(false);
  });

  it("solo decide peticiones quien tiene la capacidad y mientras esperan", () => {
    const gestor = defineAbilityFor(tecnico, { decideRequests: true });

    expect(allowsOn(gestor, "decide", "Request", { status: "pending" })).toBe(
      true,
    );
    expect(allowsOn(gestor, "decide", "Request", { status: "delivered" })).toBe(
      false,
    );
    expect(
      allowsOn(defineAbilityFor(tecnico), "decide", "Request", {
        status: "pending",
      }),
    ).toBe(false);
  });

  it("las casillas de cada módulo son independientes", () => {
    const ability = defineAbilityFor(tecnico, {
      viewInventory: true,
      viewManuals: true,
    });

    expect(allowsOn(ability, "view", "InventoryItem", {})).toBe(true);
    expect(allowsOn(ability, "update", "InventoryItem", {})).toBe(false);
    expect(allowsOn(ability, "view", "Manual", {})).toBe(true);
    expect(allowsOn(ability, "view", "Audit", {})).toBe(false);
  });
});
