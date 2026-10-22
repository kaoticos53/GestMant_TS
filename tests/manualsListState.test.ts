import { describe, expect, it } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import {
  NO_EQUIPMENT_FILTER,
  filterManualsWithSpecialRules,
} from "@/pages/dashboard/manuals/hooks/useManualsListState";
import {
  MANUALS_CSV_HEADER,
  buildManualsCsvRows,
} from "@/pages/dashboard/manuals/hooks/useManualExport";
import type { EquipmentDoc, ManualDoc } from "@/pages/dashboard/manuals/types";

describe("Filtrado de Manuales (filterManualsWithSpecialRules)", () => {
  const dummyManuals: ManualDoc[] = [
    {
      _id: "man-1" as Id<"manuals">,
      _creationTime: 1000,
      title: "Manual de Operación HDC-3500",
      kind: "file",
      type: "service",
      brand: "Sony",
      model: "HDC-3500",
      equipmentId: "eq-1" as Id<"equipment">,
      size: 1024 * 1024,
      fileName: "sony_hdc3500.pdf",
      author: "Sony Corp",
      updatedAt: 1600000000000,
      notes: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Nota cámara" }] }] },
      url: "https://example.com/sony.pdf",
      history: [],
    },
    {
      _id: "man-2" as Id<"manuals">,
      _creationTime: 1001,
      title: "Guía Rápida de Audio QL5",
      kind: "note",
      type: "user",
      brand: "Yamaha",
      model: "QL5",
      author: "Carlos Técnico",
      updatedAt: 1610000000000,
      notes: "Ajuste de ganancia para previos",
      url: null,
      history: [],
    },
    {
      _id: "man-3" as Id<"manuals">,
      _creationTime: 1002,
      title: "Esquema Eléctrico Monitor",
      kind: "file",
      type: "schematic",
      brand: "Sony",
      model: "PVM-A170",
      size: 512 * 1024,
      fileName: "pvm_schematic.pdf",
      updatedAt: 1620000000000,
      url: "https://example.com/pvm.pdf",
      history: [],
    },
  ];

  const defaultFilters = {
    query: "",
    type: "all",
    brand: "all",
    model: "all",
    equipmentFilter: "all",
  };

  it("devuelve todos los manuales con filtros por defecto", () => {
    const result = filterManualsWithSpecialRules(dummyManuals, defaultFilters);
    expect(result.length).toBe(3);
  });

  it("filtra por texto de búsqueda en título o notas", () => {
    const result = filterManualsWithSpecialRules(dummyManuals, {
      ...defaultFilters,
      query: "ganancia",
    });
    expect(result.map((m) => m._id)).toEqual(["man-2"]);
  });

  it("filtra por tipo de manual", () => {
    const result = filterManualsWithSpecialRules(dummyManuals, {
      ...defaultFilters,
      type: "service",
    });
    expect(result.map((m) => m._id)).toEqual(["man-1"]);
  });

  it("filtra por marca", () => {
    const result = filterManualsWithSpecialRules(dummyManuals, {
      ...defaultFilters,
      brand: "Sony",
    });
    expect(result.length).toBe(2);
  });

  it("filtra por marca y modelo específico", () => {
    const result = filterManualsWithSpecialRules(dummyManuals, {
      ...defaultFilters,
      brand: "Sony",
      model: "PVM-A170",
    });
    expect(result.map((m) => m._id)).toEqual(["man-3"]);
  });

  it("filtra por equipo asignado concreto", () => {
    const result = filterManualsWithSpecialRules(dummyManuals, {
      ...defaultFilters,
      equipmentFilter: "eq-1",
    });
    expect(result.map((m) => m._id)).toEqual(["man-1"]);
  });

  it("filtra por manuales huérfanos sin equipo asignado (__none__)", () => {
    const result = filterManualsWithSpecialRules(dummyManuals, {
      ...defaultFilters,
      equipmentFilter: NO_EQUIPMENT_FILTER,
    });
    // man-2 y man-3 no tienen equipmentId
    expect(result.map((m) => m._id)).toEqual(["man-2", "man-3"]);
  });
});

describe("Construcción de CSV (buildManualsCsvRows)", () => {
  const dummyEquipment: EquipmentDoc[] = [
    {
      _id: "eq-1" as Id<"equipment">,
      _creationTime: 1000,
      name: "Cámara Plató",
      model: "HDC-3500",
      type: "ENG",
      status: "operational",
    },
  ];

  const dummyManual: ManualDoc = {
    _id: "man-1" as Id<"manuals">,
    _creationTime: 1000,
    title: "Manual de Operación",
    kind: "file",
    type: "service",
    brand: "Sony",
    model: "HDC-3500",
    equipmentId: "eq-1" as Id<"equipment">,
    size: 1024 * 1024,
    fileName: "manual.pdf",
    author: "Sony Corp",
    updatedAt: 1600000000000,
    notes: "Ajuste básico",
    url: "https://example.com/manual.pdf",
    history: [],
  };

  it("mapea los campos correctamente con la cabecera estándar", () => {
    expect(MANUALS_CSV_HEADER).toContain("Título");
    expect(MANUALS_CSV_HEADER).toContain("Equipo");
    expect(MANUALS_CSV_HEADER).toContain("Tamaño");

    const equipmentMap = new Map(dummyEquipment.map((e) => [e._id, e]));
    const rows = buildManualsCsvRows([dummyManual], (m) =>
      m.equipmentId ? equipmentMap.get(m.equipmentId) : undefined,
    );

    expect(rows.length).toBe(1);
    const row = rows[0];
    expect(row[0]).toBe("Manual de Operación"); // Título
    expect(row[1]).toBe("Archivo"); // Forma
    expect(row[2]).toBe("service"); // Tipo
    expect(row[3]).toBe("Sony"); // Marca
    expect(row[4]).toBe("HDC-3500"); // Modelo
    expect(row[5]).toBe("Cámara Plató HDC-3500"); // Equipo (equipmentLabel)
    expect(row[6]).toBe("manual.pdf"); // Archivo
    expect(row[8]).toBe("Sony Corp"); // Autor
  });
});
