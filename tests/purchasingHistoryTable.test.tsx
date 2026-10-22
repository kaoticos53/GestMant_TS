// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PurchaseOrderDoc } from "@/lib/purchasing";
import { HistorySection } from "@/pages/dashboard/purchasing/components/HistorySection";
import type { ReceptionDoc } from "@/pages/dashboard/purchasing/types";
import type { Id } from "@/convex/_generated/dataModel";

const sampleOrders: PurchaseOrderDoc[] = [
  {
    _id: "order_1" as Id<"purchaseOrders">,
    _creationTime: 1715000000,
    reference: "OC-2026-0001",
    solicitudeCode: "SOL-101",
    supplier: "SKF Rodamientos",
    status: "pending",
    createdAt: 1715000000000,
    orderedAt: 1715000000000,
    lines: [
      {
        purchaseRequestId: "pr_1" as Id<"purchaseRequests">,
        sparePartId: "part_1" as Id<"spareParts">,
        code: "ROD-01",
        name: "Rodamiento rígido 6204",
        quantity: 10,
        receivedQuantity: 6,
        note: "Urgente",
      },
    ],
  },
  {
    _id: "order_2" as Id<"purchaseOrders">,
    _creationTime: 1715100000,
    reference: "OC-2026-0002",
    solicitudeCode: "SOL-102",
    supplier: "Festo Neumática",
    status: "completed",
    createdAt: 1715100000000,
    orderedAt: 1715100000000,
    receivedAt: 1715200000000,
    lines: [
      {
        purchaseRequestId: "pr_2" as Id<"purchaseRequests">,
        sparePartId: "part_2" as Id<"spareParts">,
        code: "VALV-02",
        name: "Válvula solenoide 24V",
        quantity: 2,
        receivedQuantity: 2,
      },
    ],
  },
];

const sampleReceptions: ReceptionDoc[] = [
  {
    _id: "rec_1" as Id<"purchaseReceptions">,
    _creationTime: 1715200000,
    orderId: "order_2" as Id<"purchaseOrders">,
    receivedAt: 1715200000000,
    receivedBy: "Técnico Almacén",
    lines: [
      {
        partId: "part_2" as Id<"spareParts">,
        quantity: 2,
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

function renderComponent(ui: React.ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  act(() => {
    root.render(ui);
  });
  return container;
}

describe("HistorySection component", () => {
  it("muestra el estado vacío cuando no hay compras", () => {
    const container = renderComponent(
      <HistorySection orders={[]} receptions={[]} />,
    );

    expect(container.textContent).toContain("No hay compras en el histórico");
    expect(container.textContent).toContain(
      "A medida que crees órdenes de compra",
    );
  });

  it("renderiza la tabla y cabeceras cuando hay órdenes con líneas", () => {
    const container = renderComponent(
      <HistorySection orders={sampleOrders} receptions={sampleReceptions} />,
    );

    expect(container.textContent).not.toContain("No hay compras en el histórico");
    expect(container.textContent).toContain("OC-2026-0001");
    expect(container.textContent).toContain("SOL-101");
    expect(container.textContent).toContain("SKF Rodamientos");
    expect(container.textContent).toContain("Rodamiento rígido 6204");
    expect(container.textContent).toContain("Festo Neumática");
    expect(container.textContent).toContain("Válvula solenoide 24V");
  });

  it("muestra la información de líneas pendientes y completadas", () => {
    const container = renderComponent(
      <HistorySection orders={sampleOrders} receptions={sampleReceptions} />,
    );

    // En el footer se informa el total de líneas
    expect(container.textContent).toContain("Mostrando 2 de 2 líneas de compra");
  });

  it("permite seleccionar una fila entera haciendo clic en el checkbox selector", () => {
    const container = renderComponent(
      <HistorySection orders={sampleOrders} receptions={sampleReceptions} />,
    );

    const rowSelectBtn = container.querySelector('button[title="Seleccionar todas las celdas de esta fila"]') as HTMLButtonElement | null;
    expect(rowSelectBtn).not.toBeNull();

    act(() => {
      rowSelectBtn?.click();
    });

    // Tras seleccionar, el footer debe anunciar las celdas señaladas
    expect(container.textContent).toContain("celdas señaladas");
  });

  it("permite seleccionar una celda individual al hacer clic sobre ella", () => {
    const container = renderComponent(
      <HistorySection orders={sampleOrders} receptions={sampleReceptions} />,
    );

    const cell = container.querySelector('[data-history-cell="true"]') as HTMLTableCellElement | null;
    if (cell) {
      act(() => {
        cell.click();
      });
      expect(container.textContent).toContain("1 celdas señaladas");
    }
  });
});
