import { describe, expect, it } from "vitest";
import type { WithdrawnIncidentItem } from "@/convex/incidents";
import type { WithdrawnRequestItem } from "@/convex/partRequests";
import {
  buildTrashedIncidentRows,
  buildTrashedRequestRows,
  partitionByArchived,
} from "@/pages/dashboard/archive/helpers/trashRows";

describe("archiveDataHelpers", () => {
  describe("buildTrashedIncidentRows", () => {
    const mockItems = [
      { id: "inc1", reference: "INC-001" },
      { id: "inc2", reference: "INC-002" },
    ] as unknown as WithdrawnIncidentItem[];

    it("retorna un array vacío si no tiene permisos para archivar incidencias", () => {
      expect(buildTrashedIncidentRows(mockItems, false)).toEqual([]);
    });

    it("mapea los items a filas de papelera con kind: 'incident' cuando tiene permisos", () => {
      const rows = buildTrashedIncidentRows(mockItems, true);
      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({ kind: "incident", item: mockItems[0] });
      expect(rows[1]).toEqual({ kind: "incident", item: mockItems[1] });
    });
  });

  describe("buildTrashedRequestRows", () => {
    const mockItems = [
      { id: "req1", reference: "PET-001" },
    ] as unknown as WithdrawnRequestItem[];

    it("retorna un array vacío si no tiene permisos para archivar peticiones", () => {
      expect(buildTrashedRequestRows(mockItems, false)).toEqual([]);
    });

    it("mapea los items a filas de papelera con kind: 'request' cuando tiene permisos", () => {
      const rows = buildTrashedRequestRows(mockItems, true);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual({ kind: "request", item: mockItems[0] });
    });
  });

  describe("partitionByArchived", () => {
    it("devuelve colecciones vacías si la lista de entrada está vacía", () => {
      const result = partitionByArchived([]);
      expect(result.archived).toEqual([]);
      expect(result.active).toEqual([]);
    });

    it("clasifica correctamente elementos activos y archivados", () => {
      const items = [
        { id: 1, title: "Activo 1" },
        { id: 2, title: "Archivado 1", archivedAt: 1700000000 },
        { id: 3, title: "Activo 2", archivedAt: undefined },
        { id: 4, title: "Archivado 2", archivedAt: 1700050000 },
      ];

      const { archived, active } = partitionByArchived(items);

      expect(archived).toHaveLength(2);
      expect(archived.map((x) => x.id)).toEqual([2, 4]);

      expect(active).toHaveLength(2);
      expect(active.map((x) => x.id)).toEqual([1, 3]);
    });
  });
});
