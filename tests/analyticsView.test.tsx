// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import type { WorkshopAnalyticsResult } from "@/lib/analytics";
import { settle } from "./settle";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

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

const ADMIN_ANALYTICS: WorkshopAnalyticsResult = {
  capabilities: {
    incidents: true,
    manageIncidents: true,
    requests: true,
    decideRequests: true,
    inventory: true,
    equipment: true,
    purchasing: true,
    admin: true,
  },
  trendGranularity: "week",
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
  myDay: {
    assignedOpenCount: 2,
    assignedUrgentOrHighCount: 1,
    unassignedReportedCount: 3,
    myRequestsReadyCount: 1,
    myRequestsWaitingCount: 1,
    myStaleCount: 1,
    myPriorityIncidents: [
      {
        id: "inc-1",
        reference: "INC-0010",
        label: "HDC-3500",
        status: "assigned",
        statusLabel: "Asignada",
        priority: "urgent",
        priorityLabel: "Urgente",
        reportedAt: Date.parse("2026-11-18T09:00:00Z"),
      },
    ],
    myReadyRequests: [
      {
        id: "req-1",
        reference: "PET-0021",
        status: "materialReceived",
        statusLabel: "Material recibido",
        equipment: "HDC-3500",
        createdAt: Date.parse("2026-11-19T09:00:00Z"),
      },
    ],
  },
  incidentsByStatus: [
    { status: "reported", label: "Notificada", count: 4 },
    { status: "assigned", label: "Asignada", count: 3 },
    { status: "resolved", label: "Resuelta", count: 18 },
  ],
  incidentsByPriority: [
    { priority: "urgent", label: "Urgente", count: 2 },
    { priority: "high", label: "Alta", count: 2 },
    { priority: "medium", label: "Media", count: 2 },
    { priority: "low", label: "Baja", count: 1 },
  ],
  workloadByTechnician: [
    { name: "Teo Técnico", count: 4, urgentCount: 1, unassigned: false },
    { name: "Sin asignar", count: 3, urgentCount: 1, unassigned: true },
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
    { kind: "purchase_reception", label: "Recepción de compra", entries: 12, units: 48 },
    { kind: "request_delivery", label: "Entrega de petición", entries: 9, units: 21 },
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
      onOrder: true,
    },
  ],
  staleWork: [
    {
      id: "inc-2",
      reference: "INC-0008",
      status: "workshop",
      statusLabel: "En taller",
      assigneeName: "Teo Técnico",
      days: 5,
      isMine: false,
    },
  ],
  externalRepairs: [
    {
      id: "inc-3",
      reference: "INC-0009",
      equipmentLabel: "OPM-4250",
      companyName: "Sony Broadcast SAT",
      expectedReturnAt: Date.parse("2026-11-15T00:00:00Z"),
      overdue: true,
    },
  ],
  purchasingSummary: {
    pendingRequestsToDecide: 4,
    requestsWithoutReference: 1,
    materialReceivedPendingDelivery: 2,
    openOrdersCount: 1,
    openOrders: [
      {
        id: "po-1",
        reference: "OC-0004",
        supplier: "Electro Suministros",
        status: "pending",
        orderedAt: Date.parse("2026-11-10T09:00:00Z"),
        ageDays: 10,
        pendingUnits: 4,
        totalUnits: 6,
      },
    ],
  },
  systemHealth: {
    activeUsers: 8,
    inactiveUsers: 1,
    failedJobs: 1,
    activeJobs: 0,
    trashFilesCount: 3,
    unreadableFiles: 0,
    lastCleanupAt: Date.parse("2026-11-26T04:00:00Z"),
    recentAuditEvents: 5,
  },
};

const TECH_ANALYTICS: WorkshopAnalyticsResult = {
  ...ADMIN_ANALYTICS,
  capabilities: {
    incidents: true,
    manageIncidents: false,
    requests: true,
    decideRequests: false,
    inventory: false,
    equipment: false,
    purchasing: false,
    admin: false,
  },
  partsByCategory: [],
  stockMovementsSummary: [],
  criticalParts: [],
  workloadByTechnician: [],
  purchasingSummary: {
    pendingRequestsToDecide: 0,
    requestsWithoutReference: 0,
    materialReceivedPendingDelivery: 0,
    openOrdersCount: 0,
    openOrders: [],
  },
  systemHealth: null,
};

function clickTab(container: HTMLElement, label: string) {
  const tab = Array.from(container.querySelectorAll('[role="tab"]')).find(
    (el) => el.textContent?.includes(label),
  ) as HTMLButtonElement | undefined;
  if (!tab) throw new Error(`Tab "${label}" no encontrado`);
  tab.click();
}

describe("AnalyticsView (Propuesta A por capacidades)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
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

  it("abre en Mi jornada para un técnico sin mostrar módulos de almacén, compras, equipos ni sistema", async () => {
    const onOpenIncident = vi.fn();
    const onOpenRequest = vi.fn();
    mockUseQuery.mockReturnValue(TECH_ANALYTICS);

    await act(async () => {
      root.render(
        <AnalyticsView
          onOpenIncidents={vi.fn()}
          onOpenRequests={vi.fn()}
          onOpenIncident={onOpenIncident}
          onOpenRequest={onOpenRequest}
        />,
      );
      await settle();
    });

    const text = container.textContent ?? "";
    expect(text).toContain("Mis incidencias abiertas");
    expect(text).toContain("Sin asignar (notificadas)");
    expect(text).toContain("Paradas sin constancia");
    expect(text).toContain("Mis peticiones listas");
    expect(text).toContain("INC-0010");
    expect(text).toContain("PET-0021");
    expect(text).toContain("Compresor Atlas GA-15");

    // No se pintan tarjetas/lentes sin permiso
    expect(text).not.toContain("Stock bajo / agotado");
    expect(text).not.toContain("Equipos registrados");
    expect(text).not.toContain("Almacén y compras");
    expect(text).not.toContain("Sistema");
    expect(text).not.toContain("Ver equipos");

    // Abrir incidencia directa desde Mi jornada
    const incBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("INC-0010"),
    );
    await act(async () => {
      incBtn?.click();
      await settle();
    });
    expect(onOpenIncident).toHaveBeenCalledWith("inc-1" as Id<"incidents">);
  });

  it("permite al administrador navegar por Taller, Almacén y compras y Sistema", async () => {
    const onOpenIncidents = vi.fn();
    const onOpenAudit = vi.fn();
    mockUseQuery.mockReturnValue(ADMIN_ANALYTICS);

    await act(async () => {
      root.render(
        <AnalyticsView
          onOpenIncidents={onOpenIncidents}
          onOpenRequests={vi.fn()}
          onOpenInventoryLowStock={vi.fn()}
          onOpenEquipment={vi.fn()}
          onOpenPurchasingPending={vi.fn()}
          onOpenPurchasingOrders={vi.fn()}
          onOpenSettings={vi.fn()}
          onOpenUsers={vi.fn()}
          onOpenAudit={onOpenAudit}
        />,
      );
      await settle();
    });

    // Arranca en Taller
    let text = container.textContent ?? "";
    expect(text).toContain("Incidencias activas");
    expect(text).toContain("72%");
    expect(text).toContain("Tendencia semanal");
    expect(text).toContain("Carga activa por técnico");
    expect(text).toContain("Compresor Atlas GA-15");

    const incidentsBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="kpi-incidents"]',
    );
    await act(async () => {
      incidentsBtn?.click();
      await settle();
    });
    expect(onOpenIncidents).toHaveBeenCalledTimes(1);

    // Cambia a Almacén y compras
    await act(async () => {
      clickTab(container, "Almacén y compras");
      await settle();
    });
    text = container.textContent ?? "";
    expect(text).toContain("Repuestos por categoría");
    expect(text).toContain("Movimientos de stock");
    expect(text).toContain("Filtro de aceite hidráulico");
    expect(text).toContain("REP-001");
    expect(text).toContain("En pedido");
    expect(text).toContain("OC-0004");

    // Cambia a Sistema
    await act(async () => {
      clickTab(container, "Sistema");
      await settle();
    });
    text = container.textContent ?? "";
    expect(text).toContain("Almacenamiento y limpieza");
    expect(text).toContain("Trabajos en segundo plano");
    expect(text).toContain("Usuarios del taller");

    const auditKpi = container.querySelector<HTMLButtonElement>(
      '[data-testid="kpi-system-audit"]',
    );
    await act(async () => {
      auditKpi?.click();
      await settle();
    });
    expect(onOpenAudit).toHaveBeenCalledTimes(1);
  });

  it("muestra estado de carga cuando analytics es undefined", async () => {
    mockUseQuery.mockReturnValue(undefined);

    await act(async () => {
      root.render(
        <AnalyticsView onOpenIncidents={vi.fn()} onOpenRequests={vi.fn()} />,
      );
      await settle();
    });

    expect(container.textContent).toContain("Cargando");
  });

  it("recuerda la lente elegida, oculta gráficos globales duplicados en Mi jornada y navega a Mis incidencias/peticiones", async () => {
    const onOpenMyIncidents = vi.fn();
    const onOpenMyRequests = vi.fn();
    mockUseQuery.mockReturnValue(ADMIN_ANALYTICS);

    await act(async () => {
      root.render(
        <AnalyticsView
          onOpenIncidents={vi.fn()}
          onOpenRequests={vi.fn()}
          onOpenMyIncidents={onOpenMyIncidents}
          onOpenMyRequests={onOpenMyRequests}
        />,
      );
      await settle();
    });

    // Cambiar a Mi jornada y verificar persistencia
    await act(async () => {
      clickTab(container, "Mi jornada");
      await settle();
    });

    expect(window.localStorage.getItem("pulso:analytics-lens")).toBe("my_day");
    expect(container.textContent).toContain("Mis incidencias abiertas");
    // Los gráficos globales viven en Taller, así que no se duplican en Mi jornada
    expect(container.textContent).not.toContain("Equipos con más incidencias");

    const myIncBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="kpi-my-incidents"]',
    );
    const myReqBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="kpi-my-requests"]',
    );
    await act(async () => {
      myIncBtn?.click();
      myReqBtn?.click();
      await settle();
    });
    expect(onOpenMyIncidents).toHaveBeenCalledTimes(1);
    expect(onOpenMyRequests).toHaveBeenCalledWith("materialReceived");

    // Re-montar debe abrir directamente en Mi jornada
    await act(async () => {
      root.unmount();
    });
    root = createRoot(container);
    await act(async () => {
      root.render(
        <AnalyticsView onOpenIncidents={vi.fn()} onOpenRequests={vi.fn()} />,
      );
      await settle();
    });
    expect(container.textContent).toContain("Mis incidencias abiertas");
  });
});
