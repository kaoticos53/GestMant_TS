import { describe, expect, test } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import {
  filterAuditEntries,
  sortAuditEntries,
} from "@/pages/dashboard/audit/hooks/useAuditEntries";
import type { AuditEntry } from "@/pages/dashboard/audit/types";

const mockEntries: AuditEntry[] = [
  {
    _id: "log_1",
    incidentId: "inc_1" as Id<"incidents">,
    reference: "INC-001",
    title: "Bomba hidráulica rota",
    action: "attached",
    name: "factura_reparacion.pdf",
    by: "Carlos Mecánico",
    byId: "user_carlos",
    at: 1700000000000,
    status: "diagnosing",
    archived: false,
  },
  {
    _id: "log_2",
    incidentId: "inc_2" as Id<"incidents">,
    reference: "INC-002",
    title: "Cambio de rodamientos",
    action: "removed",
    name: "manual_obsoleto.pdf",
    by: "Laura Ingeniera",
    byId: "user_laura",
    at: 1700003600000,
    status: "resolved",
    archived: true,
  },
  {
    _id: "log_3",
    incidentId: "inc_1" as Id<"incidents">,
    reference: "INC-001",
    title: "Bomba hidráulica rota",
    action: "edited",
    name: "esquema_hidraulico_v2.pdf",
    previousName: "esquema_hidraulico_v1.pdf",
    by: "Carlos Mecánico",
    byId: "user_carlos",
    at: 1700007200000,
    status: "diagnosing",
    archived: false,
  },
];

describe("auditEntriesLogic", () => {
  describe("filterAuditEntries", () => {
    test("devuelve todas las entradas cuando la búsqueda está vacía", () => {
      const result = filterAuditEntries(mockEntries, "");
      expect(result).toHaveLength(3);
    });

    test("filtra por referencia de incidencia", () => {
      const result = filterAuditEntries(mockEntries, "INC-002");
      expect(result).toHaveLength(1);
      expect(result[0]._id).toBe("log_2");
    });

    test("filtra por nombre del autor", () => {
      const result = filterAuditEntries(mockEntries, "Carlos");
      expect(result).toHaveLength(2);
      expect(result.map((e) => e._id)).toEqual(["log_1", "log_3"]);
    });

    test("filtra por nombre del archivo del documento", () => {
      const result = filterAuditEntries(mockEntries, "factura");
      expect(result).toHaveLength(1);
      expect(result[0]._id).toBe("log_1");
    });

    test("filtra por texto del rastro documental ('quitó')", () => {
      const result = filterAuditEntries(mockEntries, "quitó");
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0]._id).toBe("log_2");
    });
  });

  describe("sortAuditEntries", () => {
    test("ordena de más reciente a más antiguo ('recent')", () => {
      const result = sortAuditEntries(mockEntries, "recent");
      expect(result.map((e) => e._id)).toEqual(["log_3", "log_2", "log_1"]);
    });

    test("ordena de más antiguo a más reciente ('oldest')", () => {
      const result = sortAuditEntries(mockEntries, "oldest");
      expect(result.map((e) => e._id)).toEqual(["log_1", "log_2", "log_3"]);
    });
  });
});
