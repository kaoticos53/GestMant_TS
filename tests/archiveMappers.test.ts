import { describe, expect, it } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  incidentToArchiveEntry,
  requestToArchiveEntry,
  getRequestStatusContext,
} from "@/pages/dashboard/archive/helpers/archiveMappers";

describe("archiveMappers", () => {
  it("mapea un documento de incidencia a ArchiveEntry con campos de búsqueda correctos", () => {
    const mockIncident: Doc<"incidents"> = {
      _id: "inc_123" as Id<"incidents">,
      _creationTime: 1000,
      reference: "INC-0042",
      status: "resolved",
      priority: "high",
      reportedAt: 2000,
      closedAt: 3000,
      archivedAt: 4000,
      archivedBy: "Juan Pérez",
      equipmentKind: "Cámara",
      model: "Sony FX6",
      serialNumber: "SN-9988",
      location: "Plató 1",
      reporterName: "Carlos Alumno",
      assigneeName: "Ana Técnica",
      description: "Sensor con motas de polvo",
      notes: "Limpieza realizada con éxito",
    };

    const entry = incidentToArchiveEntry(mockIncident);

    expect(entry.id).toBe("inc_123");
    expect(entry.kind).toBe("incident");
    expect(entry.reference).toBe("INC-0042");
    expect(entry.title).toBe("Cámara · Sony FX6");
    expect(entry.subtitle).toBe("Sensor con motas de polvo");
    expect(entry.date).toBe(4000);
    expect(entry.archivedBy).toBe("Juan Pérez");
    expect(entry.fields).toContain("INC-0042");
    expect(entry.fields).toContain("Sony FX6");
    expect(entry.fields).toContain("Carlos Alumno");
    expect(entry.fields).toContain("Ana Técnica");
  });

  it("mapea un documento de petición a ArchiveEntry con contexto de estado adecuado", () => {
    const mockRequest: Doc<"partRequests"> = {
      _id: "req_456" as Id<"partRequests">,
      _creationTime: 1000,
      reference: "PET-0007",
      status: "issued",
      createdAt: 2000,
      issuedAt: 3500,
      archivedAt: 5000,
      archivedBy: "Marta Admin",
      requesterName: "Luis Alumno",
      requesterTeam: "Realización",
      equipment: "Trípode Sachtler",
      description: "Tornillo de zapata perdido",
      lines: [
        {
          partId: "part_1" as Id<"spareParts">,
          code: "REP-01",
          name: "Tornillo 1/4",
          quantity: 2,
        },
      ],
    };

    const entry = requestToArchiveEntry(mockRequest);

    expect(entry.id).toBe("req_456");
    expect(entry.kind).toBe("request");
    expect(entry.reference).toBe("PET-0007");
    expect(entry.title).toContain("REP-01 Tornillo 1/4");
    expect(entry.subtitle).toBe("Luis Alumno · Realización · Trípode Sachtler");
    expect(entry.statusLabel).toContain("Entregada");
    expect(entry.date).toBe(5000);
    expect(entry.archivedBy).toBe("Marta Admin");
    expect(entry.fields).toContain("PET-0007");
    expect(entry.fields).toContain("Luis Alumno");
    expect(entry.fields).toContain("REP-01 Tornillo 1/4");
  });

  it("calcula getRequestStatusContext para distintos estados de petición", () => {
    const baseRequest: Doc<"partRequests"> = {
      _id: "req_test" as Id<"partRequests">,
      _creationTime: 1000,
      reference: "PET-0001",
      status: "onHold",
      createdAt: 2000,
      holdSinceAt: 3000,
      lines: [],
    };

    expect(getRequestStatusContext(baseRequest)).toContain("En espera");

    baseRequest.status = "returned";
    baseRequest.returnedAt = 4000;
    expect(getRequestStatusContext(baseRequest)).toContain("Devuelta");

    baseRequest.status = "cancelled";
    baseRequest.cancelledAt = 5000;
    expect(getRequestStatusContext(baseRequest)).toContain("Cancelada");
  });
});
