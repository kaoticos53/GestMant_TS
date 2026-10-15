import logo from "@/assets/logo.svg";
import { MessagesCenter } from "@/components/MessagesCenter";
import { NotificationBell } from "@/components/NotificationBell";
import { Button } from "@/components/ui/button";
import type { Id } from "@/convex/_generated/dataModel";
import { SIDEBAR_WIDTH_MAX, SIDEBAR_WIDTH_MIN } from "@/lib/sidebar";
import { cn } from "@/lib/utils";
import { DETAILED_VERSION, FULL_VERSION } from "@/version";
import { ChevronRight, LogOut, PanelLeftClose, Siren } from "lucide-react";
import type React from "react";
import { Link } from "react-router";
import { GlobalSearch, type SearchHit } from "../GlobalSearch";
import type { NavId, NavItem } from "../types";

export interface DashboardSidebarProps {
  sidebarRef: React.RefObject<HTMLElement | null>;
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  sidebarResizing: boolean;
  resizeHandleProps: Record<string, unknown>;
  toggleSidebar: () => void;
  isGuest: boolean;
  canSearchCatalog: boolean;
  canSendMessages: boolean;
  onSearchSelect: (hit: SearchHit) => void;
  onOpenNotification: (notification: { incidentId?: Id<"incidents"> | null }) => void;
  navItems: NavItem[];
  navBadges: Record<NavId, number>;
  activeTab: NavId;
  onSelectTab: (id: NavId) => void;
  displayName: string;
  initial: string;
  userEmail?: string | null;
  roleBadge: React.ReactNode;
  onSignOut: () => void;
}

export function DashboardSidebar({
  sidebarRef,
  sidebarCollapsed,
  sidebarWidth,
  sidebarResizing,
  resizeHandleProps,
  toggleSidebar,
  isGuest,
  canSearchCatalog,
  canSendMessages,
  onSearchSelect,
  onOpenNotification,
  navItems,
  navBadges,
  activeTab,
  onSelectTab,
  displayName,
  initial,
  userEmail,
  roleBadge,
  onSignOut,
}: DashboardSidebarProps) {
  const navButtonClass = (active: boolean) =>
    cn(
      "flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors",
      active
        ? "border-signal/30 bg-signal/10 text-signal"
        : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
    );

  const navPillClass = (active: boolean) =>
    cn(
      "rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
      active
        ? "bg-signal text-primary-foreground"
        : "bg-muted text-muted-foreground",
    );

  return (
    <>
      {/* Menú lateral (escritorio): el ancho lo elige quien lo usa y se puede
          plegar del todo. Cuando está plegado desaparece de la vista (su
          contenido no recibe foco), pero queda montado para animar el plegado. */}
      <aside
        id="menu-lateral"
        ref={sidebarRef}
        inert={sidebarCollapsed}
        style={{ width: sidebarCollapsed ? 0 : sidebarWidth }}
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden bg-card/60 lg:flex",
          !sidebarResizing && "transition-[width] duration-200 ease-out",
        )}
      >
        <div className="flex h-16 items-center justify-between gap-2.5 border-b border-border/70 px-5">
          <img
            src={logo}
            alt="Pulso Taller"
            className="size-8 rounded-lg ring-1 ring-border"
          />
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-semibold tracking-tight">
              Pulso Taller
            </span>
            <span className="truncate text-xs text-muted-foreground">
              Equipo audiovisual
            </span>
          </span>
          <div className="flex items-center gap-1.5">
            <NotificationBell onOpen={onOpenNotification} />
            <MessagesCenter canSend={canSendMessages} />
          </div>
        </div>

        {/* Búsqueda global. El invitado no la tiene: sus listas llegan vacías,
            así que buscar ahí no encontraría ni la incidencia que sí puede
            seguir; su puerta es la consulta por código. */}
        {!isGuest && (
          <div className="border-b border-border/70 p-3">
            <GlobalSearch
              canSearchCatalog={canSearchCatalog}
              onSelect={onSearchSelect}
            />
          </div>
        )}

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
                aria-current={active ? "page" : undefined}
                className={navButtonClass(active)}
              >
                <item.icon className="size-4 shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
                {badge > 0 && <span className={navPillClass(active)}>{badge}</span>}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-border/70 p-3">
          <button
            type="button"
            onClick={() => onSelectTab("profile")}
            aria-label="Ver mi perfil"
            aria-current={activeTab === "profile" ? "page" : undefined}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors",
              activeTab === "profile"
                ? "bg-signal/10 ring-1 ring-signal/30"
                : "bg-muted/50 hover:bg-muted",
            )}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-signal/10 text-sm font-semibold text-signal">
              {initial}
            </span>
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate text-sm font-medium">
                {displayName}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {userEmail ?? (isGuest ? "Sesión de invitado" : "Sin correo")}
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </button>

          {/* Plegar el menú del todo: queda la barra con «Mostrar menú». */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleSidebar}
            aria-expanded={!sidebarCollapsed}
            aria-controls="menu-lateral"
            title="Plegar el menú lateral"
            className="mt-2.5 w-full justify-start gap-2 border-border/70 text-muted-foreground hover:text-foreground"
          >
            <PanelLeftClose className="size-4" />
            Plegar menú
          </Button>

          <div className="mt-2.5 flex items-center justify-between gap-2 px-1">
            {roleBadge}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground"
              onClick={onSignOut}
            >
              <LogOut className="size-4" />
              Salir
            </Button>
          </div>

          <div
            className="mt-2 text-center text-[11px] text-muted-foreground/60 select-none"
            title={DETAILED_VERSION}
          >
            {FULL_VERSION}
          </div>
        </div>
      </aside>

      {/* Borde del menú: se arrastra (o se usan las flechas) para cambiar su ancho. */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Redimensionar el menú lateral"
        aria-valuenow={sidebarWidth}
        aria-valuemin={SIDEBAR_WIDTH_MIN}
        aria-valuemax={SIDEBAR_WIDTH_MAX}
        tabIndex={0}
        title="Arrastra para cambiar el ancho · doble clic para restablecer"
        {...resizeHandleProps}
        className="group sticky top-0 hidden h-screen w-1.5 shrink-0 cursor-col-resize touch-none select-none focus-visible:outline-none lg:block"
      >
        {/* La línea del borde queda justo donde estaba la del menú. */}
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-y-0 left-0 w-px -translate-x-1/2 bg-border/70 transition-colors",
            "group-hover:bg-signal/50 group-focus-visible:w-0.5 group-focus-visible:bg-signal",
            sidebarResizing && "w-0.5 bg-signal",
          )}
        />
      </div>
    </>
  );
}
