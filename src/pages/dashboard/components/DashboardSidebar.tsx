import type React from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { GlobalSearch, type SearchHit } from "../GlobalSearch";
import type { NavId, NavItem } from "../types";
import {
  SidebarFooter,
  SidebarHeader,
  SidebarNavList,
  SidebarResizeHandle,
} from "./sidebar";

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
        <SidebarHeader
          onOpenNotification={onOpenNotification}
          canSendMessages={canSendMessages}
        />

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

        <SidebarNavList
          isGuest={isGuest}
          navItems={navItems}
          navBadges={navBadges}
          activeTab={activeTab}
          onSelectTab={onSelectTab}
        />

        <SidebarFooter
          activeTab={activeTab}
          onSelectTab={onSelectTab}
          displayName={displayName}
          initial={initial}
          userEmail={userEmail}
          isGuest={isGuest}
          roleBadge={roleBadge}
          toggleSidebar={toggleSidebar}
          sidebarCollapsed={sidebarCollapsed}
          onSignOut={onSignOut}
        />
      </aside>

      <SidebarResizeHandle
        sidebarWidth={sidebarWidth}
        sidebarResizing={sidebarResizing}
        resizeHandleProps={resizeHandleProps}
      />
    </>
  );
}
