import { describe, expect, it } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import {
  filterSearchGroups,
  includesQuery,
  normalize,
} from "@/pages/dashboard/search/helpers";
import type {
  EquipmentDoc,
  IncidentDoc,
  PartDoc,
  RequestDoc,
} from "@/pages/dashboard/search/types";

describe("globalSearch helpers", () => {
  describe("normalize & includesQuery", () => {
    it("elimina acentos y pasa a minúsculas", () => {
      expect(normalize("Estación ÓPTICA")).toBe("estacion optica");
      expect(normalize("Cámara 4K")).toBe("camara 4k");
    });

    it("evalúa inclusión insensible a acentos y mayúsculas", () => {
      expect(includesQuery("Monitor de Grabación", "grabacion")).toBe(true);
      expect(includesQuery("Estación SDI", "estacion")).toBe(true);
      expect(includesQuery("Cables XLR", "hdmi")).toBe(false);
    });
  });

  describe("filterSearchGroups", () => {
    const mockIncidents: IncidentDoc[] = [
      {
        _id: "inc1" as Id<"incidents">,
        _creationTime: 100,
        reference: "INC-0004",
        status: "open",
        description: "Fallo en monitor de estudio",
        reporterName: "Carlos Pérez",
        equipmentKind: "Monitor",
        model: "Sony PVM",
        location: "Estudio A",
      } as unknown as IncidentDoc,
      {
        _id: "inc2" as Id<"incidents">,
        _creationTime: 200,
        reference: "INC-0010",
        status: "closed",
        description: "Cable de red dañado",
        reporterName: "Ana Gómez",
        archivedAt: 1700000000,
      } as unknown as IncidentDoc,
    ];

    const mockRequests: RequestDoc[] = [
      {
        _id: "req1" as Id<"partRequests">,
        _creationTime: 300,
        reference: "PET-0001",
        status: "pending",
        requesterName: "Luis Díaz",
        description: "Conectores BNC urgentes",
        lines: [{ code: "CON-01", name: "Conector BNC macho", quantity: 5 }],
      } as unknown as RequestDoc,
      {
        _id: "req2" as Id<"partRequests">,
        _creationTime: 400,
        reference: "PET-0002",
        status: "delivered",
        requesterName: "Marta Ruiz",
        description: "Repuesto archivado",
        archivedAt: 1700000000,
      } as unknown as RequestDoc,
    ];

    const mockParts: PartDoc[] = [
      {
        _id: "part1" as Id<"spareParts">,
        _creationTime: 500,
        code: "CON-01",
        name: "Conector BNC macho",
        category: "Conectividad",
        stock: 12,
        location: "C-01",
      } as unknown as PartDoc,
    ];

    const mockEquipment: EquipmentDoc[] = [
      {
        _id: "eq1" as Id<"equipment">,
        _creationTime: 600,
        code: "EQ-100",
        name: "Cámara Estudio 1",
        model: "HDC-3500",
        brand: "Sony",
        location: "Plató 1",
      } as unknown as EquipmentDoc,
    ];

    it("retorna lista vacía si el texto está en blanco", () => {
      const groups = filterSearchGroups({
        query: "   ",
        incidents: mockIncidents,
        requests: mockRequests,
        parts: mockParts,
        equipment: mockEquipment,
        canSearchCatalog: true,
      });
      expect(groups).toEqual([]);
    });

    it("encuentra incidencias por número de referencia flexible (4 -> INC-0004)", () => {
      const groups = filterSearchGroups({
        query: "4",
        incidents: mockIncidents,
        requests: mockRequests,
        parts: mockParts,
        equipment: mockEquipment,
        canSearchCatalog: false,
      });
      const incidentGroup = groups.find((g) => g.kind === "incident");
      expect(incidentGroup).toBeDefined();
      expect(incidentGroup?.hits[0]?.id).toBe("inc1");
      expect(incidentGroup?.hits[0]?.title).toBe("INC-0004");
    });

    it("encuentra incidencias por texto descriptivo ignorando mayúsculas y acentos", () => {
      const groups = filterSearchGroups({
        query: "perez",
        incidents: mockIncidents,
        requests: mockRequests,
        parts: mockParts,
        equipment: mockEquipment,
        canSearchCatalog: false,
      });
      const incidentGroup = groups.find((g) => g.kind === "incident");
      expect(incidentGroup).toBeDefined();
      expect(incidentGroup?.hits[0]?.id).toBe("inc1");
    });

    it("agrupa elementos archivados en el bloque 'archive'", () => {
      const groups = filterSearchGroups({
        query: "dañado",
        incidents: mockIncidents,
        requests: mockRequests,
        parts: mockParts,
        equipment: mockEquipment,
        canSearchCatalog: false,
      });
      const archiveGroup = groups.find((g) => g.kind === "archive");
      expect(archiveGroup).toBeDefined();
      expect(archiveGroup?.hits[0]?.id).toBe("inc2");
      expect(archiveGroup?.hits[0]?.archived).toBe(true);
    });

    it("busca y encuentra peticiones de material", () => {
      const groups = filterSearchGroups({
        query: "bnc",
        incidents: mockIncidents,
        requests: mockRequests,
        parts: mockParts,
        equipment: mockEquipment,
        canSearchCatalog: false,
      });
      const requestGroup = groups.find((g) => g.kind === "request");
      expect(requestGroup).toBeDefined();
      expect(requestGroup?.hits[0]?.id).toBe("req1");
    });

    it("omite repuestos y equipos si canSearchCatalog es false", () => {
      const groups = filterSearchGroups({
        query: "hdc-3500",
        incidents: mockIncidents,
        requests: mockRequests,
        parts: mockParts,
        equipment: mockEquipment,
        canSearchCatalog: false,
      });
      expect(groups.some((g) => g.kind === "equipment")).toBe(false);
      expect(groups.some((g) => g.kind === "part")).toBe(false);
    });

    it("incluye repuestos y equipos si canSearchCatalog es true", () => {
      const groups = filterSearchGroups({
        query: "hdc-3500",
        incidents: mockIncidents,
        requests: mockRequests,
        parts: mockParts,
        equipment: mockEquipment,
        canSearchCatalog: true,
      });
      const eqGroup = groups.find((g) => g.kind === "equipment");
      expect(eqGroup).toBeDefined();
      expect(eqGroup?.hits[0]?.id).toBe("eq1");
    });

    it("respeta el límite de MAX_PER_GROUP (5 elementos por categoría)", () => {
      const manyIncidents: IncidentDoc[] = Array.from({ length: 10 }, (_, i) => ({
        _id: `inc-many-${i}` as Id<"incidents">,
        _creationTime: 1000 + i,
        reference: `INC-${1000 + i}`,
        status: "open",
        description: "Error de prueba masivo",
        reporterName: "Test User",
      } as unknown as IncidentDoc));

      const groups = filterSearchGroups({
        query: "masivo",
        incidents: manyIncidents,
        requests: [],
        parts: [],
        equipment: [],
        canSearchCatalog: false,
      });

      const incidentGroup = groups.find((g) => g.kind === "incident");
      expect(incidentGroup?.hits.length).toBe(5);
    });
  });
});
