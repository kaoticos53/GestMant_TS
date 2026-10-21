// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PurchaseHistoryRow } from "@/lib/purchasing";
import {
  DEFAULT_HISTORY_COLUMNS,
  useCellSelection,
} from "@/pages/dashboard/purchasing/hooks/useCellSelection";
import { useHistoryExport } from "@/pages/dashboard/purchasing/hooks/useHistoryExport";

const sampleRows: PurchaseHistoryRow[] = [
  {
    id: "order-1-req-1-0",
    orderId: "order-1" as any,
    orderReference: "OC-0001",
    solicitudeCode: "SOL-101",
    position: 1,
    description: "Rodamiento 6204-2RS",
    quantity: 10,
    receivedQuantity: 5,
    supplier: "SKF Rodamientos",
    observations: "Urgente línea 2",
    pendingQuantity: 5,
    orderedDate: "10/05/2026",
    receivedDate: "15/05/2026",
  },
  {
    id: "order-2-req-2-0",
    orderId: "order-2" as any,
    orderReference: "OC-0002",
    solicitudeCode: "SOL-102",
    position: 1,
    description: "Retén de aceite 35x52x7",
    quantity: 4,
    receivedQuantity: 4,
    supplier: "Festo España",
    observations: "",
    pendingQuantity: 0,
    orderedDate: "12/05/2026",
    receivedDate: "14/05/2026",
  },
];

let roots: Root[] = [];

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  document.body.innerHTML = "";
  roots = [];
  vi.clearAllMocks();
});

afterEach(async () => {
  await act(async () => {
    for (const root of roots) root.unmount();
  });
  roots = [];
  document.body.innerHTML = "";
});

describe("useCellSelection", () => {
  it("inicia sin celdas seleccionadas", () => {
    let api!: ReturnType<typeof useCellSelection>;
    function TestComp() {
      api = useCellSelection(sampleRows);
      return null;
    }

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    act(() => {
      root.render(<TestComp />);
    });

    expect(api.selectedCount).toBe(0);
    expect(api.areAllSelected).toBe(false);
    expect(api.isSelected("order-1-req-1-0", "orderReference")).toBe(false);
    expect(api.isRowSelected("order-1-req-1-0")).toBe(false);
  });

  it("permite alternar celdas individuales con toggleCell", () => {
    let api!: ReturnType<typeof useCellSelection>;
    function TestComp() {
      api = useCellSelection(sampleRows);
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
      api.toggleCell("order-1-req-1-0", "description");
    });

    expect(api.selectedCount).toBe(1);
    expect(api.isSelected("order-1-req-1-0", "description")).toBe(true);
    expect(api.isSelected("order-1-req-1-0", "orderReference")).toBe(false);

    // Al volver a pulsar, se retira
    act(() => {
      api.toggleCell("order-1-req-1-0", "description");
    });

    expect(api.selectedCount).toBe(0);
    expect(api.isSelected("order-1-req-1-0", "description")).toBe(false);
  });

  it("permite alternar filas enteras con toggleRow", () => {
    let api!: ReturnType<typeof useCellSelection>;
    function TestComp() {
      api = useCellSelection(sampleRows);
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
      api.toggleRow("order-1-req-1-0");
    });

    expect(api.selectedCount).toBe(DEFAULT_HISTORY_COLUMNS.length);
    expect(api.isRowSelected("order-1-req-1-0")).toBe(true);
    expect(api.isRowSelected("order-2-req-2-0")).toBe(false);

    // Deseleccionar fila
    act(() => {
      api.toggleRow("order-1-req-1-0");
    });

    expect(api.selectedCount).toBe(0);
    expect(api.isRowSelected("order-1-req-1-0")).toBe(false);
  });

  it("permite seleccionar y limpiar todo con toggleAll y clearSelection", () => {
    let api!: ReturnType<typeof useCellSelection>;
    function TestComp() {
      api = useCellSelection(sampleRows);
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
      api.toggleAll();
    });

    const totalCells = sampleRows.length * DEFAULT_HISTORY_COLUMNS.length;
    expect(api.selectedCount).toBe(totalCells);
    expect(api.areAllSelected).toBe(true);

    act(() => {
      api.clearSelection();
    });

    expect(api.selectedCount).toBe(0);
    expect(api.areAllSelected).toBe(false);
  });
});

describe("useHistoryExport", () => {
  it("copia filas visibles o celdas seleccionadas al portapapeles", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    let exportApi!: ReturnType<typeof useHistoryExport>;
    const selectedCells = new Set(["order-1-req-1-0:orderReference", "order-1-req-1-0:quantity"]);

    function TestComp() {
      exportApi = useHistoryExport(sampleRows, selectedCells);
      return null;
    }

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    act(() => {
      root.render(<TestComp />);
    });

    let success = false;
    await act(async () => {
      success = await exportApi.copyToClipboard();
    });

    expect(success).toBe(true);
    expect(writeTextMock).toHaveBeenCalledTimes(1);
    expect(exportApi.isCopied).toBe(true);
  });
});
