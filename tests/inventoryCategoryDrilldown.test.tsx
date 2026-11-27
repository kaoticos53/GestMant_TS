// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import type { DashboardNavigation } from "@/pages/dashboard/hooks/useDashboardNavigation";
import type { NavigationTarget } from "@/pages/dashboard/types";

const { STATE } = vi.hoisted(() => ({
  STATE: {
    parts: [] as unknown[],
    incidents: [] as unknown[],
  },
}));

vi.mock("@/components/AbilityProvider", () => ({
  AbilityProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Can: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  return {
    useQuery: (query: unknown) => {
      const name =
        typeof query === "function" || (typeof query === "object" && query !== null)
          ? getFunctionName(query as Parameters<typeof getFunctionName>[0])
          : "";
      if (name === "spareParts:list") return STATE.parts;
      if (name === "incidents:list") return STATE.incidents;
      if (name === "partRequests:list") return [];
      if (name === "equipment:list") return [];
      if (name === "equipmentModels:list") return [];
      if (name === "userPrefs:get") return null;
      if (name === "ai:availability") return { available: false };
      return undefined;
    },
    useMutation: () => vi.fn(),
  };
});

vi.mock("@/pages/dashboard/components/content/router/lazyViews", () => ({
  AnalyticsView: ({
    onSelectPartCategory,
    onSelectEquipment,
  }: {
    onSelectPartCategory?: (category: string) => void;
    onSelectEquipment?: (label: string) => void;
  }) => (
    <div>
      <button
        type="button"
        data-testid="analytics-cat-btn"
        onClick={() => onSelectPartCategory?.("Eléctrica")}
      >
        Pulsar categoría Eléctrica
      </button>
      <button
        type="button"
        data-testid="analytics-eq-btn"
        onClick={() => onSelectEquipment?.("HDC-3500")}
      >
        Pulsar modelo HDC-3500
      </button>
    </div>
  ),
  InventoryView: ({
    initialSearch = "",
    initialCategory = "all",
  }: {
    initialSearch?: string;
    initialCategory?: string;
  }) => (
    <div
      data-testid="mock-inventory"
      data-search={initialSearch}
      data-category={initialCategory}
    />
  ),
  ArchiveView: () => null,
  AuditView: () => null,
  EquipmentView: () => null,
  IncidentsView: ({
    initialSearch = "",
    initialFilter = "all",
  }: {
    initialSearch?: string;
    initialFilter?: string;
  }) => (
    <div
      data-testid="mock-incidents"
      data-search={initialSearch}
      data-filter={initialFilter}
    />
  ),
  MachinesView: () => null,
  MailboxView: () => null,
  ManualsView: () => null,
  PermissionsView: () => null,
  ProfileView: () => null,
  PurchasingView: () => null,
  RequestsView: () => null,
  UsersView: () => null,
  WorkshopSettingsView: () => null,
}));

import { AbilityProvider } from "@/components/AbilityProvider";
import { DashboardTabRenderer } from "@/pages/dashboard/components/content/router/DashboardTabRenderer";
import { IncidentsView } from "@/pages/dashboard/IncidentsView";
import { InventoryView } from "@/pages/dashboard/InventoryView";

function RouterHarness() {
  const [target, setTarget] = useState<NavigationTarget>({
    tab: "analytics",
    inventorySearch: "",
    inventoryCategory: "all",
    inventoryLowStockOnly: false,
  });

  const navigation = {
    target,
    tab: target.tab,
    activeTab: target.tab,
    viewKeys: {
      incidents: 0,
      requests: 0,
      archive: 0,
      mailbox: 0,
      inventory: 0,
      equipment: 0,
      manuals: 0,
    },
    setTarget,
    goToTab: vi.fn(),
    openRequests: vi.fn(),
    openRequest: vi.fn(),
    openIncident: vi.fn(),
    openNotification: vi.fn(),
    openInventory: vi.fn(),
    setRequestsEquipmentFilter: vi.fn(),
    openEquipmentViewRequests: vi.fn(),
    handleSearchSelect: vi.fn(),
  } as unknown as DashboardNavigation;

  return (
    <DashboardTabRenderer
      navigation={navigation}
      user={null}
      displayName="Técnico"
      adminOk={false}
      can={(cap) =>
        cap === "viewAnalytics" ||
        cap === "viewInventory" ||
        cap === "viewIncidents"
      }
      canSeePurchasing={false}
      isGuest={false}
    />
  );
}

describe("Drill-down de Repuestos por categoría", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    STATE.parts = [];
    STATE.incidents = [];
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("DashboardTabRenderer pasa inventoryCategory sin escribir en el filtro de texto al pulsar categoría", () => {
    act(() => {
      root.render(<RouterHarness />);
    });

    const btn = container.querySelector(
      '[data-testid="analytics-cat-btn"]',
    ) as HTMLButtonElement;
    act(() => {
      btn.click();
    });

    const mockInv = container.querySelector('[data-testid="mock-inventory"]');
    expect(mockInv).not.toBeNull();
    expect(mockInv?.getAttribute("data-category")).toBe("Eléctrica");
    expect(mockInv?.getAttribute("data-search")).toBe("");
  });

  it("InventoryView aplica initialCategory en el selector de categoría y mantiene el buscador vacío", () => {
    const now = Date.now();
    STATE.parts = [
      {
        _id: "p-1" as Id<"spareParts">,
        code: "EL-01",
        name: "Fuente 24V",
        category: "Climatización",
        unit: "ud",
        stock: 5,
        minStock: 2,
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: "p-2" as Id<"spareParts">,
        code: "OP-02",
        name: "Lente zoom",
        category: "Óptica",
        unit: "ud",
        stock: 3,
        minStock: 1,
        createdAt: now,
        updatedAt: now,
      },
    ];

    act(() => {
      root.render(
        <AbilityProvider>
          <InventoryView initialSearch="" initialCategory="Climatización" />
        </AbilityProvider>,
      );
    });

    const searchInput = container.querySelector(
      'input[aria-label="Buscar repuesto"]',
    ) as HTMLInputElement;
    expect(searchInput.value).toBe("");

    const categoryTrigger = container.querySelector(
      '[aria-label="Filtrar por categoría"]',
    );
    expect(categoryTrigger?.textContent).toContain("Climatización");

    const text = container.textContent ?? "";
    expect(text).toContain("Fuente 24V");
    expect(text).not.toContain("Lente zoom");
  });

  it("DashboardTabRenderer abre Incidencias filtradas por modelo al pulsar Equipos con más incidencias", () => {
    act(() => {
      root.render(<RouterHarness />);
    });

    const btn = container.querySelector(
      '[data-testid="analytics-eq-btn"]',
    ) as HTMLButtonElement;
    act(() => {
      btn.click();
    });

    const mockInc = container.querySelector('[data-testid="mock-incidents"]');
    expect(mockInc).not.toBeNull();
    expect(mockInc?.getAttribute("data-search")).toBe("HDC-3500");
    expect(mockInc?.getAttribute("data-filter")).toBe("all");
  });

  it("IncidentsView aplica initialSearch para filtrar las incidencias del modelo seleccionado", () => {
    const now = Date.now();
    STATE.incidents = [
      {
        _id: "inc-1" as Id<"incidents">,
        reference: "INC-0010",
        status: "assigned",
        priority: "normal",
        equipmentKind: "Cámara",
        model: "HDC-3500",
        serialNumber: "SN-3500",
        location: "Plató 1",
        reporterName: "Laura",
        description: "Fallo señal SDI",
        reportedAt: now,
        updatedAt: now,
      },
      {
        _id: "inc-2" as Id<"incidents">,
        reference: "INC-0011",
        status: "reported",
        priority: "urgent",
        equipmentKind: "Monitor",
        model: "BVM-HX310",
        serialNumber: "SN-310",
        location: "Control",
        reporterName: "Carlos",
        description: "No enciende",
        reportedAt: now - 1000,
        updatedAt: now - 1000,
      },
    ];

    act(() => {
      root.render(
        <MemoryRouter>
          <IncidentsView initialSearch="HDC-3500" />
        </MemoryRouter>,
      );
    });

    const text = container.textContent ?? "";
    expect(text).toContain("INC-0010");
    expect(text).not.toContain("INC-0011");
  });
});
