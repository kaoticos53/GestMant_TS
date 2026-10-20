import logo from "@/assets/logo.svg";
import { MessagesCenter } from "@/components/MessagesCenter";
import { NotificationBell } from "@/components/NotificationBell";
import { Button } from "@/components/ui/button";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { LogOut, PanelLeftOpen } from "lucide-react";
import type React from "react";
import { GlobalSearch, type SearchHit } from "../GlobalSearch";
import type { NavId, NavItem } from "../types";

export interface DashboardHeaderProps {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  roleBadge: React.ReactNode;
  onOpenNotification: (notification: { incidentId?: Id<"incidents"> | null }) => void;
  canSendMessages: boolean;
  isGuest: boolean;
  canSearchCatalog: boolean;
  onSearchSelect: (hit: SearchHit) => void;
  activeTab: NavId;
  goToTab: (id: NavId) => void;
  initial: string;
  onSignOut: () => void;
  navItems: NavItem[];
  navBadges: Record<NavId, number>;
}

export function DashboardHeader({
  sidebarCollapsed,
  toggleSidebar,
  roleBadge,
  onOpenNotification,
  canSendMessages,
  isGuest,
  canSearchCatalog,
  onSearchSelect,
  activeTab,
  goToTab,
  initial,
  onSignOut,
  navItems,
  navBadges,
}: DashboardHeaderProps) {
  const navPillClass = (active: boolean) =>
    cn(
      "rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
      active
        ? "bg-signal text-primary-foreground"
        : "bg-muted text-muted-foreground",
    );

  return (
    <>
      {/* Menú plegado (escritorio): desde aquí se vuelve a desplegar. */}
      {sidebarCollapsed && (
        <div className="sticky top-0 z-30 hidden items-center justify-between gap-3 border-b border-border/70 bg-background/85 px-4 py-2 backdrop-blur-md sm:px-6 lg:flex">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            aria-expanded={!sidebarCollapsed}
            aria-controls="menu-lateral"
            aria-label="Mostrar el menú lateral"
            title="Mostrar el menú"
            className="gap-2 text-muted-foreground"
          >
            <PanelLeftOpen className="size-4" />
            Mostrar menú
          </Button>
          {/* Lo que vivía en el menú: avisos, mensajes y el rol en uso. */}
          <div className="flex shrink-0 items-center gap-2">
            {roleBadge}
            <NotificationBell onOpen={onOpenNotification} />
            <MessagesCenter canSend={canSendMessages} />
          </div>
        </div>
      )}

      {/* Cabecera móvil */}
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-md lg:hidden">
        <div className="flex h-16 items-center justify-between gap-3 px-4">
          <a href="/" className="flex min-w-0 items-center gap-3">
            <img
              src={logo}
              alt="Pulso Taller"
              className="size-8 rounded-lg ring-1 ring-border"
            />
            <span className="truncate text-sm font-semibold tracking-tight">
              Pulso Taller
            </span>
          </a>
          <div className="flex shrink-0 items-center gap-2">
            <NotificationBell onOpen={onOpenNotification} />
            <MessagesCenter canSend={canSendMessages} />
            <span className="hidden sm:block">{roleBadge}</span>
            <button
              type="button"
              onClick={() => goToTab("profile")}
              aria-label="Ver mi perfil"
              aria-current={activeTab === "profile" ? "page" : undefined}
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full bg-signal/10 text-xs font-semibold text-signal transition-shadow",
                activeTab === "profile" && "ring-2 ring-signal/50",
              )}
            >
              {initial}
            </button>
            {/* En el móvil, «Salir» va solo con el icono: su texto empujaba la
                campana y el avatar fuera de la barra. La etiqueta sigue ahí para
                quien no ve el icono. */}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground"
              onClick={onSignOut}
              aria-label="Salir"
              title="Salir"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>

        {/* Módulos en barra horizontal (móvil) */}
        {/* La tira de módulos se recorre en horizontal, sin barra a la vista y
            con parada en cada destino: con once módulos, las flechas del
            navegador ocupaban más que los propios botones. */}
        <nav
          aria-label="Módulos"
          className="flex snap-x gap-1 overflow-x-auto border-t border-border/70 px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {navItems.map((item) => {
            const active = activeTab === item.id;
            const badge = navBadges[item.id];
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => goToTab(item.id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex shrink-0 snap-start items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "border-signal/30 bg-signal/10 text-signal"
                    : "border-border/70 text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
                {badge > 0 && (
                  <span className={navPillClass(true)}>{badge}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Búsqueda global (móvil); el invitado tampoco la tiene */}
        {!isGuest && (
          <div className="border-t border-border/70 px-3 py-2">
            <GlobalSearch
              canSearchCatalog={canSearchCatalog}
              onSelect={onSearchSelect}
            />
          </div>
        )}
      </header>
    </>
  );
}
