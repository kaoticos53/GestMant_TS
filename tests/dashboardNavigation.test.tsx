// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useDashboardNavigation } from "@/pages/dashboard/hooks/useDashboardNavigation";
import { useEnsureRole } from "@/pages/dashboard/hooks/useEnsureRole";
import type { NavItem } from "@/pages/dashboard/types";
import { Siren, ClipboardList, Boxes } from "lucide-react";

const ensureRoleMock = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: () => ensureRoleMock,
}));

let roots: Root[] = [];

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  document.body.innerHTML = "";
  roots = [];
  ensureRoleMock.mockReset();
});

afterEach(async () => {
  await act(async () => {
    for (const root of roots) root.unmount();
  });
  roots = [];
  document.body.innerHTML = "";
});

const mockNavItems: NavItem[] = [
  { id: "incidents", label: "Incidencias", icon: Siren, badge: 0 },
  { id: "requests", label: "Peticiones", icon: ClipboardList, badge: 0 },
  { id: "inventory", label: "Repuestos", icon: Boxes, badge: 0 },
];

function setupNav(canFn = () => true) {
  let current!: ReturnType<typeof useDashboardNavigation>;
  function TestComp() {
    current = useDashboardNavigation(canFn as never, mockNavItems);
    return null;
  }
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);

  act(() => {
    root.render(<TestComp />);
  });

  return {
    get current() {
      return current;
    },
  };
}

describe("useDashboardNavigation", () => {
  test("inicia en incidents con valores por defecto", () => {
    const nav = setupNav();
    expect(nav.current.activeTab).toBe("incidents");
    expect(nav.current.target.requestId).toBeNull();
    expect(nav.current.target.incidentId).toBeNull();
  });

  test("goToTab cambia de tab y resetea filtros específicos", () => {
    const nav = setupNav();
    act(() => {
      nav.current.goToTab("inventory");
    });

    expect(nav.current.activeTab).toBe("inventory");
    expect(nav.current.target.requestsFilter).toBe("all");
    expect(nav.current.target.inventoryLowStockOnly).toBe(false);
  });

  test("openRequest cambia al tab requests y establece el requestId", () => {
    const nav = setupNav();
    act(() => {
      nav.current.openRequest("req123" as never);
    });

    expect(nav.current.activeTab).toBe("requests");
    expect(nav.current.target.requestId).toBe("req123");
    expect(nav.current.target.requestsFilter).toBe("all");
  });

  test("openInventory con lowStockOnly activa el filtro correspondiente", () => {
    const nav = setupNav();
    act(() => {
      nav.current.openInventory(true);
    });

    expect(nav.current.activeTab).toBe("inventory");
    expect(nav.current.target.inventoryLowStockOnly).toBe(true);
  });

  test("handleSearchSelect navega correctamente según el tipo de resultado", () => {
    const nav = setupNav();
    act(() => {
      nav.current.handleSearchSelect({
        kind: "incident",
        id: "inc456" as never,
        title: "Motor averiado",
        term: "motor",
      });
    });

    expect(nav.current.activeTab).toBe("incidents");
    expect(nav.current.target.incidentId).toBe("inc456");
  });
});

describe("useEnsureRole", () => {
  test("dispara mutación si el usuario no tiene rol asignado", () => {
    function RoleTestComp() {
      useEnsureRole({ _id: "usr1", role: undefined }, "Técnico");
      return null;
    }

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    act(() => {
      root.render(<RoleTestComp />);
    });

    expect(ensureRoleMock).toHaveBeenCalled();
  });
});
