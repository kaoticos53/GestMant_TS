// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { settle } from "./settle";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { mockUseQuery } = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useQuery: mockUseQuery,
}));

import { PartDetailSheet } from "@/pages/dashboard/inventory/components/PartDetailSheet";
import type { EquipmentModelDoc, PartDoc } from "@/pages/dashboard/inventory/types";

const SAMPLE_PART: PartDoc = {
  _id: "part_1" as never,
  _creationTime: 1,
  code: "REP-100",
  partNumber: "PN-999",
  name: "Filtro hidráulico HF",
  category: "Filtros",
  location: "A-12",
  supplier: "HidraMax",
  stock: 2,
  minStock: 5,
  unit: "ud",
  unitPrice: 24.5,
  compatibleModels: ["mod_1" as never],
  createdAt: 1,
  updatedAt: 1,
};

const SAMPLE_MODELS: EquipmentModelDoc[] = [
  {
    _id: "mod_1" as never,
    _creationTime: 1,
    kind: "Compresor",
    brand: "Atlas",
    model: "GA-15",
    createdAt: 1,
    updatedAt: 1,
  } as EquipmentModelDoc,
];

describe("PartDetailSheet (Fase 2)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
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

  it("muestra ficha del repuesto, modelos compatibles y movimientos recientes", async () => {
    mockUseQuery.mockReturnValue([
      {
        _id: "mov_1",
        kind: "manual_adjust",
        delta: -2,
        previousStock: 4,
        nextStock: 2,
        actorName: "Carlos",
        reason: "Cambio preventivo",
        createdAt: Date.now(),
      },
    ]);

    const onStockAdjust = vi.fn();
    const onEdit = vi.fn();
    const onPrintLabel = vi.fn();

    await act(async () => {
      root.render(
        <PartDetailSheet
          part={SAMPLE_PART}
          canManage={true}
          catalogModels={SAMPLE_MODELS}
          onClose={vi.fn()}
          onEdit={onEdit}
          onStockAdjust={onStockAdjust}
          onPrintLabel={onPrintLabel}
        />,
      );
      await settle();
    });

    const text = document.body.textContent ?? "";
    expect(text).toContain("Filtro hidráulico HF");
    expect(text).toContain("REP-100");
    expect(text).toContain("A-12");
    expect(text).toContain("Atlas");
    expect(text).toContain("Ajuste manual");
    expect(text).toContain("Cambio preventivo");

    const adjustBtn = Array.from(document.body.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Ajustar stock"),
    );
    expect(adjustBtn).toBeDefined();
    await act(async () => {
      adjustBtn?.click();
      await settle();
    });
    expect(onStockAdjust).toHaveBeenCalledWith(SAMPLE_PART);
  });

  it("oculta botones de edición y ajuste cuando canManage es false", async () => {
    mockUseQuery.mockReturnValue([]);

    await act(async () => {
      root.render(
        <PartDetailSheet
          part={SAMPLE_PART}
          canManage={false}
          catalogModels={SAMPLE_MODELS}
          onClose={vi.fn()}
          onEdit={vi.fn()}
          onStockAdjust={vi.fn()}
          onPrintLabel={vi.fn()}
        />,
      );
      await settle();
    });

    const text = document.body.textContent ?? "";
    expect(text).not.toContain("Ajustar stock");
    expect(text).not.toContain("Editar ficha");
    expect(text).toContain("Etiqueta");
  });

  it("muestra desglose físico y reservado cuando hay stock reservado", async () => {
    mockUseQuery.mockReturnValue([]);

    await act(async () => {
      root.render(
        <PartDetailSheet
          part={{ ...SAMPLE_PART, stock: 7, reservedStock: 3 }}
          canManage={false}
          catalogModels={SAMPLE_MODELS}
          onClose={vi.fn()}
          onEdit={vi.fn()}
          onStockAdjust={vi.fn()}
          onPrintLabel={vi.fn()}
        />,
      );
      await settle();
    });

    const text = document.body.textContent ?? "";
    expect(text).toContain("Stock disponible");
    expect(text).toContain("Físico 10 ud");
    expect(text).toContain("Reservado 3 ud");
  });
});
