import { describe, expect, it } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import {
  formatExternalRepairCost,
  formatSatContact,
  getEquipmentInventoryInfo,
  getExternalRepairBadge,
} from "@/pages/dashboard/incidents/components/detail/equipment/helpers";
import type { EquipmentDoc } from "@/pages/dashboard/incidents/types";

describe("incidentEquipmentCardHelpers", () => {
  describe("formatExternalRepairCost", () => {
    it("devuelve cadena vacía si el coste es undefined o null", () => {
      expect(formatExternalRepairCost(undefined)).toBe("");
      expect(formatExternalRepairCost(null as unknown as undefined)).toBe("");
    });

    it("formatea 0 euros correctamente", () => {
      const formatted = formatExternalRepairCost(0);
      expect(formatted).toContain("0,00");
      expect(formatted).toContain("€");
    });

    it("formatea un importe positivo en euros", () => {
      const formatted = formatExternalRepairCost(1250.75);
      expect(formatted).toContain("1250,75");
      expect(formatted).toContain("€");
    });
  });

  describe("getExternalRepairBadge", () => {
    it("identifica estado de reparación externa en curso", () => {
      const badge = getExternalRepairBadge("externalRepair");
      expect(badge.isUnderRepair).toBe(true);
      expect(badge.label).toBe("En curso en el SAT externo");
    });

    it("identifica estado de retorno al taller para otros estados", () => {
      const badge = getExternalRepairBadge("workshop");
      expect(badge.isUnderRepair).toBe(false);
      expect(badge.label).toBe("Retornada al taller");

      const badgeResolved = getExternalRepairBadge("resolved");
      expect(badgeResolved.isUnderRepair).toBe(false);
      expect(badgeResolved.label).toBe("Retornada al taller");
    });
  });

  describe("formatSatContact", () => {
    it("devuelve null si no hay nombre ni teléfono", () => {
      expect(formatSatContact(undefined, undefined)).toBeNull();
      expect(formatSatContact("", "")).toBeNull();
      expect(formatSatContact("   ", "   ")).toBeNull();
    });

    it("formatea contacto completo con nombre y teléfono", () => {
      const result = formatSatContact("Carlos Martínez", "912345678");
      expect(result).not.toBeNull();
      expect(result?.fullText).toBe("Carlos Martínez (912345678)");
      expect(result?.name).toBe("Carlos Martínez");
      expect(result?.phone).toBe("912345678");
    });

    it("formatea contacto cuando solo se dispone del nombre", () => {
      const result = formatSatContact("SAT Oficial Bosch", null);
      expect(result).not.toBeNull();
      expect(result?.fullText).toBe("SAT Oficial Bosch");
      expect(result?.name).toBe("SAT Oficial Bosch");
      expect(result?.phone).toBeUndefined();
    });

    it("formatea contacto cuando solo se dispone del teléfono", () => {
      const result = formatSatContact(null, "654987321");
      expect(result).not.toBeNull();
      expect(result?.fullText).toBe("654987321");
      expect(result?.name).toBeUndefined();
      expect(result?.phone).toBe("654987321");
    });
  });

  describe("getEquipmentInventoryInfo", () => {
    it("indica equipo no inventariado si linkedEquipment es null", () => {
      const info = getEquipmentInventoryInfo(null);
      expect(info.isLinked).toBe(false);
      expect(info.label).toBe("Equipo no inventariado");
      expect(info.serialNumber).toBeUndefined();
    });

    it("extrae la información del equipo inventariado con número de serie", () => {
      const mockEquipment = {
        _id: "eq1" as Id<"equipment">,
        _creationTime: 1000,
        name: "Torno CNC",
        brand: "Haas",
        model: "ST-10",
        serialNumber: "SN-9988",
        status: "active",
      } as unknown as EquipmentDoc;

      const info = getEquipmentInventoryInfo(mockEquipment);
      expect(info.isLinked).toBe(true);
      expect(info.label).toBe("Torno CNC ST-10");
      expect(info.serialNumber).toBe("SN-9988");
    });

    it("maneja equipo inventariado sin número de serie", () => {
      const mockEquipment = {
        _id: "eq2" as Id<"equipment">,
        _creationTime: 1000,
        name: "Fresadora Universal",
        model: "FU-1",
        status: "active",
      } as unknown as EquipmentDoc;

      const info = getEquipmentInventoryInfo(mockEquipment);
      expect(info.isLinked).toBe(true);
      expect(info.label).toBe("Fresadora Universal FU-1");
      expect(info.serialNumber).toBeUndefined();
    });
  });
});
