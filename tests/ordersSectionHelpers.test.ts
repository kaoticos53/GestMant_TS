import { describe, expect, it } from "vitest";
import {
  formatCancelSuccessDescription,
  formatOrderRequestRefs,
  formatOrderSubtitle,
} from "../src/pages/dashboard/purchasing/components/orders/helpers";
import type { Id } from "@/convex/_generated/dataModel";
import type { PurchaseOrderDoc } from "@/lib/purchasing";

describe("ordersSectionHelpers", () => {
  const mockOrder: PurchaseOrderDoc = {
    _id: "ord_1" as Id<"purchaseOrders">,
    _creationTime: 1000,
    reference: "OC-2026-001",
    supplier: "Rodamientos del Norte",
    orderedAt: 1774000000000,
    status: "ordered",
    lines: [
      {
        partId: "p_1" as Id<"spareParts">,
        partName: "Rodamiento 6204-2RS",
        quantity: 4,
        receivedQuantity: 2,
      },
    ],
    requestRefs: [
      {
        requestId: "req_1" as Id<"requests">,
        reference: "PET-001",
        requestedAt: 1773900000000,
      },
    ],
  } as unknown as PurchaseOrderDoc;

  describe("formatOrderSubtitle", () => {
    it("formatea correctamente con 1 artículo (singular)", () => {
      const subtitle = formatOrderSubtitle(mockOrder, 2, 4);
      expect(subtitle).toContain("Rodamientos del Norte");
      expect(subtitle).toContain("1 artículo · 2/4 ud recibidas");
    });

    it("formatea correctamente con varios artículos (plural)", () => {
      const multiOrder: PurchaseOrderDoc = {
        ...mockOrder,
        lines: [
          ...mockOrder.lines,
          {
            partId: "p_2" as Id<"spareParts">,
            partName: "Retén 20x35x7",
            quantity: 2,
            receivedQuantity: 2,
          },
        ],
      } as unknown as PurchaseOrderDoc;
      const subtitle = formatOrderSubtitle(multiOrder, 4, 6);
      expect(subtitle).toContain("2 artículos · 4/6 ud recibidas");
    });
  });

  describe("formatOrderRequestRefs", () => {
    it("devuelve cadena vacía si no hay referencias de peticiones", () => {
      expect(formatOrderRequestRefs([])).toBe("");
    });

    it("formatea una referencia con su fecha", () => {
      const refs = formatOrderRequestRefs(mockOrder.requestRefs);
      expect(refs).toContain("PET-001");
      expect(refs).toContain("(");
    });

    it("concatena múltiples referencias con separador", () => {
      const multipleRefs = [
        ...mockOrder.requestRefs,
        {
          requestId: "req_2" as Id<"requests">,
          reference: "PET-002",
          requestedAt: 1773950000000,
        },
      ];
      const refs = formatOrderRequestRefs(multipleRefs);
      expect(refs).toContain("PET-001");
      expect(refs).toContain("PET-002");
      expect(refs).toContain(" · ");
    });
  });

  describe("formatCancelSuccessDescription", () => {
    it("informa que no había nada por devolver si returned es 0", () => {
      expect(formatCancelSuccessDescription(0)).toBe(
        "No había nada por devolver: lo recibido se queda."
      );
    });

    it("informa en singular si returned es 1", () => {
      expect(formatCancelSuccessDescription(1)).toBe(
        "1 petición de compra vuelve a la cola."
      );
    });

    it("informa en plural si returned es mayor que 1", () => {
      expect(formatCancelSuccessDescription(3)).toBe(
        "3 peticiones de compra vuelven a la cola."
      );
    });
  });
});
