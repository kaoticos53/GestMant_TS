// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import { settle } from "./settle";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { mockUseQuery } = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useQuery: mockUseQuery,
}));

import { EquipmentMovementsSection } from "@/pages/dashboard/equipment/components/detail/EquipmentMovementsSection";
import { StockMovementsDialog } from "@/pages/dashboard/inventory/dialogs/StockMovementsDialog";

describe("Fase 4 TDD — UI de Movimientos (Stock y Equipos)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("StockMovementsDialog muestra movimientos con delta, saldo resultante y referencia", async () => {
    mockUseQuery.mockReturnValue([
      {
        _id: "mov1",
        sparePartId: "sp1" as Id<"spareParts">,
        partCode: "AUD-POP01",
        partName: "Antiviento",
        kind: "request_reserve",
        previousStock: 6,
        delta: -2,
        nextStock: 4,
        reference: "PET-0098",
        reason: "Petición PET-0098",
        actorName: "Carlos",
        createdAt: 1_700_000_000_000,
      },
    ]);

    await act(async () => {
      root.render(<StockMovementsDialog open={true} onClose={vi.fn()} />);
    });
    await settle();

    expect(document.body.textContent).toContain("AUD-POP01");
    expect(document.body.textContent).toContain("Reserva en petición");
    expect(document.body.textContent).toContain("-2");
    expect(document.body.textContent).toContain("PET-0098");
    expect(document.body.textContent).toContain("Carlos");
  });

  it("EquipmentMovementsSection muestra traslados de ubicación y ciclo de vida", async () => {
    mockUseQuery.mockReturnValue([
      {
        _id: "em1",
        equipmentId: "eq1" as Id<"equipment">,
        equipmentCode: "EQ-001",
        equipmentName: "Cámara",
        kind: "location_change",
        fromLocation: "Plató 1",
        toLocation: "Unidad Móvil 2",
        actorName: "Elena",
        createdAt: 1_700_000_000_000,
      },
    ]);

    await act(async () => {
      root.render(
        <EquipmentMovementsSection equipmentId={"eq1" as Id<"equipment">} />,
      );
    });
    await settle();

    expect(container.textContent).toContain("Desplazamientos y ciclo de vida");
    expect(container.textContent).toContain("Traslado");
    expect(container.textContent).toContain("Plató 1 → Unidad Móvil 2");
    expect(container.textContent).toContain("Elena");
  });
});
