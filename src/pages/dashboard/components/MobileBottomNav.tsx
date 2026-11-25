import { Menu, PlusCircle } from "lucide-react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";
import type { NavId, NavItem } from "../types";

const PREFERRED_MOBILE_TABS: NavId[] = [
  "incidents",
  "requests",
  "inventory",
  "equipment",
  "purchasing",
  "mailbox",
];

const SHORT_TAB_LABELS: Partial<Record<NavId, string>> = {
  incidents: "Incidencias",
  requests: "Peticiones",
  inventory: "Repuestos",
  equipment: "Equipos",
  purchasing: "Compras",
  mailbox: "Correo",
};

export interface MobileBottomNavProps {
  navItems: NavItem[];
  navBadges: Record<NavId, number>;
  activeTab: NavId;
  isGuest: boolean;
  onSelectTab: (id: NavId) => void;
  onOpenMenu: () => void;
}

export function MobileBottomNav({
  navItems,
  navBadges,
  activeTab,
  isGuest,
  onSelectTab,
  onOpenMenu,
}: MobileBottomNavProps) {
  if (isGuest && navItems.length === 0) {
    return null;
  }

  const byId = new Map(navItems.map((item) => [item.id, item]));
  const primaryTabs = PREFERRED_MOBILE_TABS.map((id) => byId.get(id))
    .filter((item): item is NavItem => Boolean(item))
    .slice(0, 3);

  return (
    <nav
      aria-label="Navegación rápida móvil"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-background/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <div className="flex h-14 items-stretch justify-around px-1">
        {primaryTabs.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          const badge = navBadges[item.id] ?? item.badge ?? 0;
          const showBadge = badge > 0 && item.badgeKind !== "count";
          const label = SHORT_TAB_LABELS[item.id] ?? item.label;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "text-signal"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="relative inline-flex">
                <Icon className="size-4" />
                {showBadge && (
                  <span className="absolute -right-2.5 -top-1.5 min-w-4 rounded-full bg-signal px-1 text-center text-[10px] font-semibold leading-4 text-signal-foreground tabular-nums">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </span>
              <span className="truncate">{label}</span>
            </button>
          );
        })}

        <Link
          to="/reportar"
          className="flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-1 text-[11px] font-medium text-signal transition-colors hover:text-signal/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <PlusCircle className="size-4" />
          <span className="truncate">Notificar</span>
        </Link>

        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Abrir menú lateral"
          className="flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Menu className="size-4" />
          <span className="truncate">Menú</span>
        </button>
      </div>
    </nav>
  );
}
