// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
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
      if (name === "equipment:list") return [];
      if (name === "equipmentModels:list") return [];
      if (name === "userPrefs:get") return null;
      return undefined;
    },
    useMutation: () => vi.fn(),
  };
});

vi.mock("@/pages/dashboard/components/content/router/lazyViews", () => ({
  AnalyticsView: ({
    onSelectPartCategory,
  }: {
    onSelectPartCategory?: (category: string) => void;
  }) => (
    <button
      type="button"
      data-testid="analytics-cat-btn"
      onClick={() => onSelectPartCategory?.("Eléctrica")}
    >
      Pulsar categoría Eléctrica
    </button>
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
  IncidentsView: () => null,
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
      can={(cap) => cap === "viewAnalytics" || cap === "viewInventory"}
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
});
