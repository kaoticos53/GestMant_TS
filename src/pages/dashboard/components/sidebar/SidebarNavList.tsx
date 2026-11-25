import { Fragment } from "react";
import { Siren } from "lucide-react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";
import {
  NAV_GROUP_LABELS,
  NAV_GROUP_ORDER,
} from "../../constants/navConfig";
import { prefetchTab } from "../content/router/lazyViews";
import { getNavButtonClass, getNavPillClass } from "./helpers";
import type { SidebarNavListProps } from "./types";

export function SidebarNavList({
  isGuest,
  navItems,
  navBadges,
  activeTab,
  onSelectTab,
  itemClassName,
}: SidebarNavListProps) {
  const renderItem = (item: (typeof navItems)[number]) => {
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
        className={cn(getNavButtonClass(active), itemClassName)}
      >
        <item.icon className="size-4 shrink-0" />
        <span className="flex-1 truncate">{item.label}</span>
        {badge > 0 && (
          <span className={getNavPillClass(active, item.badgeKind)}>
            {badge}
          </span>
        )}
      </button>
    );
  };

  const groupedSections = NAV_GROUP_ORDER.map((group) => ({
    group,
    label: NAV_GROUP_LABELS[group],
    items: navItems.filter((item) => item.group === group),
  })).filter((section) => section.items.length > 0);

  const ungrouped = navItems.filter((item) => !item.group);

  return (
    <nav
      aria-label="Módulos"
      className="flex flex-1 flex-col gap-1 overflow-y-auto p-3"
    >
      {isGuest && (
        <Link
          to="/reportar"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-signal transition-colors hover:bg-signal/10"
        >
          <Siren className="size-4 shrink-0" />
          <span className="flex-1 truncate">Notificar incidencia</span>
        </Link>
      )}
      {groupedSections.map((section) => (
        <Fragment key={section.group}>
          <p className="px-3 pb-1 pt-3 first:pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {section.label}
          </p>
          {section.items.map(renderItem)}
        </Fragment>
      ))}
      {ungrouped.length > 0 && (
        <>
          <p className="px-3 pb-1 pt-3 first:pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Módulos
          </p>
          {ungrouped.map(renderItem)}
        </>
      )}
    </nav>
  );
}
