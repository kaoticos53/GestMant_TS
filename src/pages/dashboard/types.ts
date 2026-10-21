import type { Id } from "@/convex/_generated/dataModel";
import type { LucideIcon } from "lucide-react";
import type { OpenArchivedDoc } from "./ArchiveView";
import type { RequestFilterId } from "./requests/types";

export type NavId =
  | "incidents"
  | "requests"
  | "purchasing"
  | "inventory"
  | "equipment"
  | "manuals"
  | "machines"
  | "archive"
  | "audit"
  | "users"
  | "permissions"
  | "settings"
  | "profile";

export interface NavItem {
  id: NavId;
  label: string;
  icon: LucideIcon;
  /** Contador a mostrar en la píldora del menú (0 = sin píldora). */
  badge: number;
}

/** Preferencia del menú guardada en el perfil (viene del documento `users`). */
export interface SidebarLayoutProfile {
  _id: string;
  sidebarWidth?: number;
  sidebarCollapsed?: boolean;
}

/** Estado cohesivo de navegación y filtros entre submódulos del Dashboard. */
export interface NavigationTarget {
  tab: NavId;
  incidentId?: Id<"incidents"> | null;
  requestId?: Id<"partRequests"> | null;
  requestsEquipmentFilter?: string;
  requestsFilter?: RequestFilterId;
  archiveEntry?: OpenArchivedDoc | null;
  inventorySearch?: string;
  inventoryLowStockOnly?: boolean;
  equipmentSearch?: string;
  timestamp?: number;
}

