// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import type { PurchaseOrderDoc } from "@/lib/purchasing";
import type { ReceptionDoc } from "@/pages/dashboard/purchasing/types";
import { useHistoryFilters } from "@/pages/dashboard/purchasing/hooks/useHistoryFilters";

const sampleOrders: PurchaseOrderDoc[] = [
  {
    _id: "order-1" as Id<"purchaseOrders">,
    _creationTime: 1000,
    reference: "OC-0001",
    supplier: "SKF Rodamientos",
    status: "partial",
    orderedAt: 1715328000000,
    solicitudeCode: "SOL-101",
    lines: [
      {
        purchaseRequestId: "req-1" as Id<"purchaseRequests">,
        code: "ROD-6204",
        name: "Rodamiento 6204",
        quantity: 10,
        receivedQuantity: 5,
      },
    ],
  },
  {
    _id: "order-2" as Id<"purchaseOrders">,
    _creationTime: 2000,
    reference: "OC-0002",
    supplier: "Festo España",
    status: "completed",
    orderedAt: 1715500800000,
    solicitudeCode: "SOL-102",
    lines: [
      {
        purchaseRequestId: "req-2" as Id<"purchaseRequests">,
        code: "VAL-32",
        name: "Válvula neumática",
        quantity: 2,
        receivedQuantity: 2,
      },
    ],
  },
];

const sampleReceptions: ReceptionDoc[] = [
  {
    _id: "rec-1" as Id<"receptions">,
    _creationTime: 1500,
    orderId: "order-1" as Id<"purchaseOrders">,
    receivedAt: 1715587200000,
    deliveryNoteReference: "ALB-001",
    deliveryNoteUrl: null,
    lines: [
      {
        sparePartId: "sp-1" as Id<"spareParts">,
        purchaseRequestId: "req-1" as Id<"purchaseRequests">,
        quantity: 5,
      },
    ],
  },
];

let roots: Root[] = [];

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  document.body.innerHTML = "";
  roots = [];
});

afterEach(async () => {
  await act(async () => {
    for (const root of roots) root.unmount();
  });
  roots = [];
  document.body.innerHTML = "";
});

describe("useHistoryFilters", () => {
  it("inicia con filtros por defecto y extrae proveedores únicos", () => {
    let api!: ReturnType<typeof useHistoryFilters>;
    function TestComp() {
      api = useHistoryFilters(sampleOrders, sampleReceptions);
      return null;
    }

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    act(() => {
      root.render(<TestComp />);
    });

    expect(api.filtrosActivosCount).toBe(0);
    expect(api.advancedOpen).toBe(false);
    expect(api.allRows.length).toBe(2);
    expect(api.proveedores).toEqual(["Festo España", "SKF Rodamientos"]);
    expect(api.filteredAndSortedRows.length).toBe(2);
  });

  it("calcula filtrosActivosCount y permite limpiarFiltros", () => {
    let api!: ReturnType<typeof useHistoryFilters>;
    function TestComp() {
      api = useHistoryFilters(sampleOrders, sampleReceptions);
      return null;
    }

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    act(() => {
      root.render(<TestComp />);
    });

    act(() => {
      api.setFilters((prev) => ({
        ...prev,
        pedido: "OC-0001",
        proveedor: "SKF Rodamientos",
        fechaDesde: "2024-05-01",
      }));
    });

    expect(api.filtrosActivosCount).toBe(3);
    expect(api.filteredAndSortedRows.length).toBe(1);
    expect(api.filteredAndSortedRows[0].orderReference).toBe("OC-0001");

    // Limpiar filtros
    act(() => {
      api.limpiarFiltros();
    });

    expect(api.filtrosActivosCount).toBe(0);
    expect(api.filteredAndSortedRows.length).toBe(2);
  });

  it("alterna el estado de filtros avanzados con toggleAdvancedOpen", () => {
    let api!: ReturnType<typeof useHistoryFilters>;
    function TestComp() {
      api = useHistoryFilters(sampleOrders, sampleReceptions);
      return null;
    }

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    act(() => {
      root.render(<TestComp />);
    });

    expect(api.advancedOpen).toBe(false);

    act(() => {
      api.toggleAdvancedOpen();
    });

    expect(api.advancedOpen).toBe(true);
  });
});
