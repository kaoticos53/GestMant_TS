import { describe, expect, it } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import type { RequestDoc, RequestLine } from "@/pages/dashboard/incidents/components/detail/partRequests/types";
import {
  MATERIAL_STATE_LABEL,
  getLineProgress,
  resolveRequestDeliveryMeta,
  untouchedLineLabel,
} from "@/pages/dashboard/incidents/components/detail/partRequests/helpers";

describe("incidentPartRequestsCardHelpers", () => {
  describe("untouchedLineLabel", () => {
    it("etiqueta como 'sin entregar' si el material está en partial, delivered o pending", () => {
      expect(untouchedLineLabel("partial")).toBe(MATERIAL_STATE_LABEL.pending);
      expect(untouchedLineLabel("delivered")).toBe(MATERIAL_STATE_LABEL.pending);
      expect(untouchedLineLabel("pending")).toBe(MATERIAL_STATE_LABEL.pending);
    });

    it("respeta la etiqueta original para returned y dropped", () => {
      expect(untouchedLineLabel("returned")).toBe("devuelto");
      expect(untouchedLineLabel("dropped")).toBe("no se sirvió");
    });
  });

  describe("resolveRequestDeliveryMeta", () => {
    const baseRequest: RequestDoc = {
      _id: "req1" as Id<"partRequests">,
      _creationTime: 1000,
      reference: "PET-001",
      requesterId: "u1" as Id<"users">,
      requesterName: "Técnico Juan",
      priority: "normal",
      status: "issued",
      lines: [
        {
          sparePartId: "sp1" as Id<"spareParts">,
          code: "REP-101",
          name: "Rodamiento",
          quantity: 2,
          deliveredQuantity: 2,
        },
      ],
      description: "Petición urgente para motor",
      createdAt: 2000,
      issuedAt: 3000,
    } as unknown as RequestDoc;

    it("resuelve entrega completa con fecha de expedición", () => {
      const meta = resolveRequestDeliveryMeta(baseRequest);
      expect(meta.archived).toBe(false);
      expect(meta.material).toBe("delivered");
      expect(meta.deliveredAt).toBe(3000);
      expect(meta.described).toBe("Petición urgente para motor");
      expect(meta.statusMeta).toBeDefined();
    });

    it("identifica elemento archivado y fecha de retorno cuando procede", () => {
      const returnedRequest: RequestDoc = {
        ...baseRequest,
        status: "returned",
        archivedAt: 5000,
        returnedAt: 4500,
      } as unknown as RequestDoc;

      const meta = resolveRequestDeliveryMeta(returnedRequest);
      expect(meta.archived).toBe(true);
      expect(meta.material).toBe("returned");
      expect(meta.deliveredAt).toBe(4500);
    });
  });

  describe("getLineProgress", () => {
    const line: RequestLine = {
      sparePartId: "sp2" as Id<"spareParts">,
      code: "FUS-10",
      name: "Fusible 10A",
      quantity: 5,
      deliveredQuantity: 2,
    };

    it("calcula cantidades entregadas y pendientes", () => {
      const progress = getLineProgress(line, "approved");
      expect(progress.delivered).toBe(2);
      expect(progress.remaining).toBe(3);
    });
  });
});
