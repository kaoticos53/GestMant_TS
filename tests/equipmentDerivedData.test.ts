import { describe, expect, it } from "vitest";
import { nextReview, requestMatchesEquipment } from "@/lib/workshop";
import type { EquipmentDoc, RecordDoc } from "@/pages/dashboard/equipment/types";
import type { Doc } from "@/convex/_generated/dataModel";

describe("Equipment Derived Data & Domain Logic", () => {
  const baseEquipment: EquipmentDoc = {
    _id: "eq_1" as never,
    _creationTime: 1000,
    code: "EQ-001",
    model: "Sony FX6",
    brand: "Sony",
    name: "Cámara Plató 1",
    location: "Plató 1",
    serialNumber: "SN12345",
    supplier: "Sony Broadcast",
    purchaseDate: 1700000000000,
    warrantyEndDate: 1750000000000,
    maintenanceIntervalDays: 90,
    description: "Cámara principal de producción",
  };

  describe("requestMatchesEquipment", () => {
    it("coincide cuando la petición tiene el equipmentId explícito", () => {
      const request = {
        _id: "req_1",
        equipmentId: "eq_1",
        equipment: "Cualquier texto",
      } as unknown as Doc<"partRequests">;

      expect(requestMatchesEquipment(request, baseEquipment)).toBe(true);
    });

    it("coincide por modelo cuando no hay equipmentId pero el texto del equipo coincide", () => {
      const request = {
        _id: "req_2",
        equipmentId: undefined,
        equipment: "Sony FX6",
      } as unknown as Doc<"partRequests">;

      expect(requestMatchesEquipment(request, baseEquipment)).toBe(true);
    });

    it("ignora peticiones de otros equipos o modelos", () => {
      const request = {
        _id: "req_3",
        equipmentId: "eq_other",
        equipment: "Canon C300",
      } as unknown as Doc<"partRequests">;

      expect(requestMatchesEquipment(request, baseEquipment)).toBe(false);
    });
  });

  describe("nextReview", () => {
    it("calcula estado ok cuando la última revisión es reciente", () => {
      const now = Date.now();
      const recentIntervention: RecordDoc = {
        _id: "rec_1" as never,
        _creationTime: now,
        equipmentId: "eq_1" as never,
        kind: "preventive",
        title: "Revisión trimestral",
        performedAt: now - 10 * 86400000, // Hace 10 días
        technician: "Mario",
      };

      const result = nextReview([recentIntervention], 90, baseEquipment.purchaseDate);
      expect(result.state).toBe("ok");
      expect(result.dueAt).toBeGreaterThan(now);
    });

    it("calcula estado overdue cuando la última revisión superó el intervalo", () => {
      const now = Date.now();
      const oldIntervention: RecordDoc = {
        _id: "rec_2" as never,
        _creationTime: now,
        equipmentId: "eq_1" as never,
        kind: "preventive",
        title: "Revisión antigua",
        performedAt: now - 120 * 86400000, // Hace 120 días (plan de 90)
        technician: "Mario",
      };

      const result = nextReview([oldIntervention], 90, baseEquipment.purchaseDate);
      expect(result.state).toBe("overdue");
      expect(result.dueAt).toBeLessThan(now);
    });

    it("indica sin plan cuando maintenanceIntervalDays es undefined", () => {
      const result = nextReview([], undefined, baseEquipment.purchaseDate);
      expect(result.state).toBe("none");
    });
  });

  describe("compatible parts filtering", () => {
    it("filtra piezas compatibles según el modelId resuelto", () => {
      const modelId = "model_sony_fx6" as never;
      const parts = [
        {
          _id: "p_1" as never,
          code: "REP-01",
          name: "Batería BPU-60",
          compatibleModels: ["model_sony_fx6"],
        },
        {
          _id: "p_2" as never,
          code: "REP-02",
          name: "Correa Canon",
          compatibleModels: ["model_canon_c300"],
        },
      ] as Doc<"spareParts">[];

      const compatible = parts.filter((part) =>
        Boolean(modelId && part.compatibleModels?.includes(modelId)),
      );

      expect(compatible).toHaveLength(1);
      expect(compatible[0].name).toBe("Batería BPU-60");
    });
  });
});
