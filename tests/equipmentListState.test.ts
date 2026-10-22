import { describe, expect, it } from "vitest";
import { filterEquipment } from "@/pages/dashboard/equipment/hooks/useEquipmentListState";
import type { EquipmentDoc } from "@/pages/dashboard/equipment/types";

describe("useEquipmentListState & filterEquipment", () => {
  const sampleEquipment: EquipmentDoc[] = [
    {
      _id: "eq_1" as never,
      _creationTime: 1000,
      code: "EQ-001",
      model: "FX6",
      brand: "Sony",
      name: "Cámara Plató",
      location: "Plató 1",
      serialNumber: "SN-9988",
      supplier: "Sony Broadcast",
    },
    {
      _id: "eq_2" as never,
      _creationTime: 2000,
      code: "EQ-002",
      model: "C300 Mark III",
      brand: "Canon",
      name: "Cámara Exterior",
      location: "Unidad Móvil",
      serialNumber: "CAN-4411",
      supplier: "Canon Pro",
    },
    {
      _id: "eq_3" as never,
      _creationTime: 3000,
      code: "EQ-003",
      model: "Wireless Pro",
      brand: "Rode",
      name: "Micrófono inalámbrico",
      location: "Control Sonido",
      serialNumber: "RODE-1122",
      supplier: "Audio Visual SL",
    },
  ];

  it("devuelve toda la lista si la búsqueda está vacía o son solo espacios", () => {
    expect(filterEquipment(sampleEquipment, "")).toHaveLength(3);
    expect(filterEquipment(sampleEquipment, "   ")).toHaveLength(3);
  });

  it("encuentra equipos por código (insensible a mayúsculas)", () => {
    const results = filterEquipment(sampleEquipment, "eq-002");
    expect(results).toHaveLength(1);
    expect(results[0].code).toBe("EQ-002");
  });

  it("encuentra equipos por marca", () => {
    const results = filterEquipment(sampleEquipment, "sony");
    expect(results).toHaveLength(1);
    expect(results[0].brand).toBe("Sony");
  });

  it("encuentra equipos por modelo", () => {
    const results = filterEquipment(sampleEquipment, "c300");
    expect(results).toHaveLength(1);
    expect(results[0].model).toBe("C300 Mark III");
  });

  it("encuentra equipos por nombre", () => {
    const results = filterEquipment(sampleEquipment, "micrófono");
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Micrófono inalámbrico");
  });

  it("encuentra equipos por ubicación", () => {
    const results = filterEquipment(sampleEquipment, "móvil");
    expect(results).toHaveLength(1);
    expect(results[0].location).toBe("Unidad Móvil");
  });

  it("encuentra equipos por número de serie", () => {
    const results = filterEquipment(sampleEquipment, "9988");
    expect(results).toHaveLength(1);
    expect(results[0].serialNumber).toBe("SN-9988");
  });

  it("encuentra equipos por proveedor", () => {
    const results = filterEquipment(sampleEquipment, "Audio Visual");
    expect(results).toHaveLength(1);
    expect(results[0].supplier).toBe("Audio Visual SL");
  });

  it("devuelve un array vacío si no hay coincidencias", () => {
    const results = filterEquipment(sampleEquipment, "panasonic xyz");
    expect(results).toHaveLength(0);
  });
});
