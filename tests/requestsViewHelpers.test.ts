import { describe, expect, it } from "vitest";
import type { Id } from "../src/convex/_generated/dataModel";
import {
  buildRequestsCsvData,
  countByStatus,
  REQUESTS_CSV_HEADER,
  stepReason,
} from "../src/pages/dashboard/requests/helpers";
import type { RequestDoc } from "../src/pages/dashboard/requests/types";

describe("requestsView helpers", () => {
  const dummyRequest: RequestDoc = {
    _id: "req_1" as Id<"partRequests">,
    _creationTime: 1700000000,
    reference: "PET-2026-0001",
    status: "approved",
    priority: "urgent",
    requesterName: "Carlos Gómez",
    requesterTeam: "Mantenimiento",
    equipment: "Cámara Sony HDC-3500",
    description: "Ventilador principal emitiendo ruido excesivo",
    notes: "Revisado en turno de mañana",
    decisionNote: "Aprobada para cambio inmediato",
    decidedBy: "Laura Sánchez",
    createdAt: 1700000000000,
    decidedAt: 1700003600000,
    attachments: [],
    lines: [
      {
        partId: "part_1" as Id<"spareParts">,
        code: "FAN-001",
        name: "Ventilador 12V 80mm",
        quantity: 2,
      },
      {
        partId: "part_2" as Id<"spareParts">,
        code: "THP-002",
        name: "Pasta térmica 5g",
        quantity: 1,
      },
    ],
  };

  describe("REQUESTS_CSV_HEADER", () => {
    it("contiene los encabezados esperados en orden", () => {
      expect(REQUESTS_CSV_HEADER).toEqual([
        "Referencia",
        "Estado",
        "Prioridad",
        "Solicitante",
        "Área",
        "Equipo",
        "Líneas",
        "Descripción",
        "Notas",
        "Decisión",
        "Motivo",
        "Decidido por",
        "Creada",
        "Decidida",
        "Entregada",
      ]);
    });
  });

  describe("buildRequestsCsvData", () => {
    it("devuelve array vacío de filas si no hay peticiones", () => {
      const result = buildRequestsCsvData([]);
      expect(result.header).toBe(REQUESTS_CSV_HEADER);
      expect(result.rows).toHaveLength(0);
    });

    it("mapea correctamente los campos de la petición a fila CSV", () => {
      const result = buildRequestsCsvData([dummyRequest]);
      expect(result.rows).toHaveLength(1);

      const [row] = result.rows;
      expect(row[0]).toBe("PET-2026-0001");
      expect(row[1]).toBe("Aprobada");
      expect(row[2]).toBe("Urgente");
      expect(row[3]).toBe("Carlos Gómez");
      expect(row[4]).toBe("Mantenimiento");
      expect(row[5]).toBe("Cámara Sony HDC-3500");
      expect(row[6]).toBe("FAN-001 Ventilador 12V 80mm x2 | THP-002 Pasta térmica 5g x1");
      expect(row[7]).toBe("Ventilador principal emitiendo ruido excesivo");
      expect(row[8]).toBe("Revisado en turno de mañana");
      expect(row[9]).toBe("Aprobada para cambio inmediato");
      expect(row[11]).toBe("Laura Sánchez");
    });

    it("gestiona campos opcionales nulos o ausentes de forma segura", () => {
      const minimalRequest: RequestDoc = {
        _id: "req_2" as Id<"partRequests">,
        _creationTime: 1700000000,
        reference: "PET-2026-0002",
        status: "pending",
        priority: "normal",
        requesterName: "Marta Ruiz",
        createdAt: 1700000000000,
        attachments: [],
        lines: [],
      };

      const result = buildRequestsCsvData([minimalRequest]);
      expect(result.rows).toHaveLength(1);

      const [row] = result.rows;
      expect(row[0]).toBe("PET-2026-0002");
      expect(row[1]).toBe("Pendiente");
      expect(row[2]).toBe("Normal");
      expect(row[4]).toBe(""); // requesterTeam
      expect(row[5]).toBe(""); // equipment
      expect(row[6]).toBe(""); // lines
      expect(row[7]).toBe(""); // description
      expect(row[8]).toBe(""); // notes
      expect(row[9]).toBe(""); // decisionNote
      expect(row[10]).toBe(""); // stepReason
      expect(row[11]).toBe(""); // decidedBy
      expect(row[13]).toBe(""); // decidedAt
      expect(row[14]).toBe(""); // issuedAt
    });
  });

  describe("stepReason", () => {
    it("devuelve la nota adecuada según el estado del ciclo de vida", () => {
      expect(stepReason({ ...dummyRequest, status: "issued", issueNote: "Entregado en mano" })).toBe(
        "Entregado en mano",
      );
      expect(stepReason({ ...dummyRequest, status: "onHold", holdNote: "Esperando repuesto" })).toBe(
        "Esperando repuesto",
      );
      expect(stepReason({ ...dummyRequest, status: "returned", returnNote: "Devuelto por sobrante" })).toBe(
        "Devuelto por sobrante",
      );
      expect(stepReason({ ...dummyRequest, status: "cancelled", cancelNote: "Cancelado por error" })).toBe(
        "Cancelado por error",
      );
      expect(stepReason({ ...dummyRequest, status: "approved" })).toBe("");
    });
  });

  describe("countByStatus", () => {
    it("cuenta correctamente las peticiones por cada estado", () => {
      const requests: RequestDoc[] = [
        { ...dummyRequest, status: "pending" },
        { ...dummyRequest, status: "pending" },
        { ...dummyRequest, status: "approved" },
        { ...dummyRequest, status: "issued" },
      ];

      const counts = countByStatus(requests);
      expect(counts.all).toBe(4);
      expect(counts.pending).toBe(2);
      expect(counts.approved).toBe(1);
      expect(counts.issued).toBe(1);
      expect(counts.rejected).toBe(0);
    });
  });
});
