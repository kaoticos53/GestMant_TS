import { describe, expect, it } from "vitest";
import {
  allowsOn,
  asPurchaseOrder,
  asPurchaseRequest,
  asRequest,
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

  it("solo tramita peticiones quien tiene la capacidad, sea cual sea su estado", () => {
    const gestor = defineAbilityFor(tecnico, { decideRequests: true });

    expect(allowsOn(gestor, "decide", "Request", { status: "pending" })).toBe(
      true,
    );
    // Qué estados admiten cada paso lo dice `requestFlow`, no CASL: si la regla
    // lo repitiera, la ficha ofrecería pasos que la máquina no deja.
    expect(
      allowsOn(gestor, "decide", "Request", { status: "materialReceived" }),
    ).toBe(true);
    expect(allowsOn(gestor, "archive", "Request", { status: "issued" })).toBe(
      true,
    );
    expect(allowsOn(gestor, "delete", "Request", {})).toBe(true);
    expect(
      allowsOn(defineAbilityFor(tecnico), "decide", "Request", {
        status: "pending",
      }),
    ).toBe(false);
  });

  it("la ficha de la petición se marca para preguntar por ella", () => {
    const gestor = defineAbilityFor(tecnico, { decideRequests: true });

    // `subject()` es lo que hace que CASL sepa qué ficha tiene delante.
    expect(gestor.can("decide", asRequest({ status: "pending" }))).toBe(true);
  });

  it("recepcionar y anular una orden es de quien gestiona las compras", () => {
    const comprador = defineAbilityFor(tecnico, { managePurchasing: true });
    const orden = asPurchaseOrder({ status: "partial" });

    expect(comprador.can("receive", orden)).toBe(true);
    expect(comprador.can("cancel", orden)).toBe(true);

    const sinCompras = defineAbilityFor(tecnico, { viewPurchasing: true });
    expect(sinCompras.can("view", "PurchaseOrder")).toBe(true);
    expect(sinCompras.can("receive", orden)).toBe(false);
    expect(sinCompras.can("cancel", orden)).toBe(false);
  });

  it("la cola de compras se toca con la capacidad de compras", () => {
    const comprador = defineAbilityFor(tecnico, { managePurchasing: true });
    const fila = asPurchaseRequest({ status: "pending" });

    expect(comprador.can("update", fila)).toBe(true);
    expect(comprador.can("cancel", fila)).toBe(true);
    expect(comprador.can("create", "PurchaseOrder")).toBe(true);

    const sinCompras = defineAbilityFor(tecnico, { viewPurchasing: true });
    expect(sinCompras.can("view", fila)).toBe(true);
    expect(sinCompras.can("update", fila)).toBe(false);
    expect(sinCompras.can("cancel", fila)).toBe(false);
    expect(sinCompras.can("create", "PurchaseOrder")).toBe(false);
  });

  it("apartar material sin existencias es de compras y pesa sobre la petición", () => {
    // Apartar nace en una petición de repuesto: el sujeto es esa ficha.
    const comprador = defineAbilityFor(tecnico, { managePurchasing: true });
    expect(comprador.can("reserve", "Request")).toBe(true);

    const taller = defineAbilityFor(tecnico, {
      viewRequests: true,
      decideRequests: true,
    });
    expect(taller.can("reserve", "Request")).toBe(false);
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
