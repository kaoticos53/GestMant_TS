import { Siren } from "lucide-react";
import { Link } from "react-router";
import { prefetchTab } from "../content/router/lazyViews";
import { getNavButtonClass, getNavPillClass } from "./helpers";
import type { SidebarNavListProps } from "./types";

export function SidebarNavList({
  isGuest,
  navItems,
  navBadges,
  activeTab,
  onSelectTab,
}: SidebarNavListProps) {
  return (
    <nav
      aria-label="Módulos"
      className="flex flex-1 flex-col gap-1 overflow-y-auto p-3"
    >
      {/* Sin módulos que ofrecer —el caso del invitado— no se deja el
          epígrafe solo, que parecería una sección a medio hacer. */}
      {navItems.length > 0 && (
        <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Módulos
        </p>
      )}
      {isGuest && (
        <Link
          to="/reportar"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-signal transition-colors hover:bg-signal/10"
        >
          <Siren className="size-4 shrink-0" />
          <span className="flex-1 truncate">Notificar incidencia</span>
        </Link>
      )}
      {navItems.map((item) => {
        const active = activeTab === item.id;
        const badge = navBadges[item.id];
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectTab(item.id)}
            // Con el ratón encima o el foco del teclado, el trozo de la vista
            // empieza a bajar: al pulsar ya está en el navegador.
            onMouseEnter={() => prefetchTab(item.id)}
            onFocus={() => prefetchTab(item.id)}
            aria-current={active ? "page" : undefined}
            className={getNavButtonClass(active)}
          >
            <item.icon className="size-4 shrink-0" />
            <span className="flex-1 truncate">{item.label}</span>
            {badge > 0 && (
              <span className={getNavPillClass(active)}>{badge}</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
