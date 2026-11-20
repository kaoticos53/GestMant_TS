// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkshopAnalyticsResult } from "@/lib/analytics";
import { settle } from "./settle";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { mockUseQuery } = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useQuery: mockUseQuery,
}));

vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children?: ReactNode }) => (
      <div data-testid="recharts-responsive">{children}</div>
    ),
  };
});

import { AnalyticsView } from "@/pages/dashboard/AnalyticsView";

const SAMPLE_ANALYTICS: WorkshopAnalyticsResult = {
  kpis: {
    activeIncidents: 7,
    totalIncidents: 25,
    resolvedLast30d: 14,
    resolutionRatePct: 72,
    avgResolutionHours: 18.5,
    activeRequests: 4,
    urgentRequests: 2,
    totalParts: 120,
    lowStockParts: 5,
    outOfStockParts: 1,
    totalEquipment: 32,
    decommissionedEquipment: 2,
    pendingPurchases: 3,
  },
  incidentsByStatus: [
    { status: "open", label: "Abierta", count: 4 },
    { status: "in_progress", label: "En curso", count: 3 },
    { status: "resolved", label: "Resuelta", count: 18 },
  ],
  weeklyTrend: [
    { weekLabel: "02/11", reported: 3, resolved: 2 },
    { weekLabel: "09/11", reported: 5, resolved: 4 },
  ],
  partsByCategory: [
    { category: "Filtros", total: 40, normal: 37, lowStock: 3 },
    { category: "Correas", total: 25, normal: 23, lowStock: 2 },
  ],
  stockMovementsSummary: [
    { kind: "stock_in", label: "Entrada", entries: 12, units: 48 },
    { kind: "stock_out", label: "Salida", entries: 9, units: 21 },
  ],
  topProblematicEquipment: [
    { label: "Compresor Atlas GA-15", count: 6, openCount: 2 },
  ],
  criticalParts: [
    {
      code: "REP-001",
      name: "Filtro de aceite hidráulico",
      stock: 0,
      minStock: 4,
      unit: "ud",
    },
  ],
};

describe("AnalyticsView", () => {
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

  it("muestra KPIs, secciones de gráficos y listas de acción rápida", async () => {
    const onOpenIncidents = vi.fn();
    const onOpenRequests = vi.fn();
    const onOpenInventoryLowStock = vi.fn();
    const onOpenEquipment = vi.fn();

    mockUseQuery.mockReturnValue(SAMPLE_ANALYTICS);

    await act(async () => {
      root.render(
        <AnalyticsView
          onOpenIncidents={onOpenIncidents}
          onOpenRequests={onOpenRequests}
          onOpenInventoryLowStock={onOpenInventoryLowStock}
          onOpenEquipment={onOpenEquipment}
        />,
      );
      await settle();
    });

    const text = container.textContent ?? "";
    expect(text).toContain("Incidencias activas");
    expect(text).toContain("7");
    expect(text).toContain("72%");
    expect(text).toContain("Incidencias por estado");
    expect(text).toContain("Tendencia semanal");
    expect(text).toContain("Repuestos por categoría");
    expect(text).toContain("Movimientos de stock");
    expect(text).toContain("Compresor Atlas GA-15");
    expect(text).toContain("Filtro de aceite hidráulico");
    expect(text).toContain("REP-001");

    const incidentsBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="kpi-incidents"]',
    );
    expect(incidentsBtn).not.toBeNull();
    await act(async () => {
      incidentsBtn?.click();
      await settle();
    });
    expect(onOpenIncidents).toHaveBeenCalledTimes(1);
  });

  it("muestra estado de carga cuando analytics es undefined", async () => {
    mockUseQuery.mockReturnValue(undefined);

    await act(async () => {
      root.render(
        <AnalyticsView
          onOpenIncidents={vi.fn()}
          onOpenRequests={vi.fn()}
          onOpenInventoryLowStock={vi.fn()}
          onOpenEquipment={vi.fn()}
        />,
      );
      await settle();
    });

    expect(container.textContent).toContain("Cargando");
  });
});
