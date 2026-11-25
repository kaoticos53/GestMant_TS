// @vitest-environment jsdom
import {
  AlertTriangle,
  Boxes,
  Cpu,
  Mail,
  Package,
  ShoppingCart,
} from "lucide-react";
import { act } from "react";
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
import { MobileBottomNav } from "@/pages/dashboard/components/MobileBottomNav";
import type { NavId, NavItem } from "@/pages/dashboard/types";

const BASE_BADGES: Record<NavId, number> = {
  analytics: 0,
  incidents: 4,
  requests: 2,
  purchasing: 0,
  inventory: 50,
  equipment: 12,
  manuals: 0,
  machines: 0,
  archive: 0,
  mailbox: 3,
  audit: 0,
  users: 0,
  permissions: 0,
  settings: 0,
  profile: 0,
};

const FULL_NAV_ITEMS: NavItem[] = [
  {
    id: "incidents",
    label: "Incidencias",
    icon: AlertTriangle,
    badge: 4,
    badgeKind: "queue",
  },
  {
    id: "requests",
    label: "Peticiones",
    icon: Package,
    badge: 2,
    badgeKind: "queue",
  },
  {
    id: "inventory",
    label: "Repuestos",
    icon: Boxes,
    badge: 50,
    badgeKind: "count",
  },
  {
    id: "equipment",
    label: "Equipos",
    icon: Cpu,
    badge: 12,
    badgeKind: "count",
  },
  {
    id: "purchasing",
    label: "Compras",
    icon: ShoppingCart,
    badge: 0,
    badgeKind: "queue",
  },
  {
    id: "mailbox",
    label: "Correo",
    icon: Mail,
    badge: 3,
    badgeKind: "queue",
  },
];

describe("MobileBottomNav", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("muestra hasta 3 pestañas prioritarias permitidas, badge de cola, enlace /reportar y menú", () => {
    const onSelectTab = vi.fn();
    const onOpenMenu = vi.fn();

    act(() => {
      root.render(
        <MemoryRouter>
          <MobileBottomNav
            navItems={FULL_NAV_ITEMS}
            navBadges={BASE_BADGES}
            activeTab="incidents"
            isGuest={false}
            onSelectTab={onSelectTab}
            onOpenMenu={onOpenMenu}
          />
        </MemoryRouter>,
      );
    });

    const text = container.textContent ?? "";
    expect(text).toContain("Incidencias");
    expect(text).toContain("Peticiones");
    expect(text).toContain("Repuestos");
    expect(text).not.toContain("Equipos");
    expect(text).toContain("Notificar");
    expect(text).toContain("Menú");

    // Solo colas muestran contador (4 en Incidencias, 2 en Peticiones; 50 en Repuestos no)
    expect(text).toContain("4");
    expect(text).toContain("2");
    expect(text).not.toContain("50");

    const reportLink = container.querySelector(
      'a[href="/reportar"]',
    ) as HTMLAnchorElement;
    expect(reportLink).not.toBeNull();

    const incidentsBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Incidencias"),
    ) as HTMLButtonElement;
    expect(incidentsBtn.getAttribute("aria-current")).toBe("page");

    const requestsBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Peticiones"),
    ) as HTMLButtonElement;
    act(() => {
      requestsBtn.click();
    });
    expect(onSelectTab).toHaveBeenCalledWith("requests");

    const menuBtn = container.querySelector(
      'button[aria-label="Abrir menú lateral"]',
    ) as HTMLButtonElement;
    act(() => {
      menuBtn.click();
    });
    expect(onOpenMenu).toHaveBeenCalledTimes(1);
  });

  it("oculta la barra cuando el usuario es invitado sin pestañas", () => {
    act(() => {
      root.render(
        <MemoryRouter>
          <MobileBottomNav
            navItems={[]}
            navBadges={BASE_BADGES}
            activeTab="profile"
            isGuest={true}
            onSelectTab={vi.fn()}
            onOpenMenu={vi.fn()}
          />
        </MemoryRouter>,
      );
    });

    expect(container.querySelector("nav")).toBeNull();
  });
});
