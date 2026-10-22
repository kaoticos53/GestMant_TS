import type React from "react";
import type { Id } from "@/convex/_generated/dataModel";
import type { NavId, NavItem } from "../../types";

export interface SidebarHeaderProps {
  onOpenNotification: (notification: { incidentId?: Id<"incidents"> | null }) => void;
  canSendMessages: boolean;
}

export interface SidebarNavListProps {
  isGuest: boolean;
  navItems: NavItem[];
  navBadges: Record<NavId, number>;
  activeTab: NavId;
  onSelectTab: (id: NavId) => void;
}

export interface SidebarFooterProps {
  activeTab: NavId;
  onSelectTab: (id: NavId) => void;
  displayName: string;
  initial: string;
  userEmail?: string | null;
  isGuest: boolean;
  roleBadge: React.ReactNode;
  toggleSidebar: () => void;
  sidebarCollapsed: boolean;
  onSignOut: () => void;
}

export interface SidebarResizeHandleProps {
  sidebarWidth: number;
  sidebarResizing: boolean;
  resizeHandleProps: Record<string, unknown>;
}
