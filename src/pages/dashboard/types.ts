import type { Id } from "@/convex/_generated/dataModel";
import type { LucideIcon } from "lucide-react";
import type { OpenArchivedDoc } from "./ArchiveView";
import type { RequestFilterId } from "./requests/types";

export type NavId =
  | "analytics"
  | "incidents"
  | "requests"
  | "purchasing"
  | "inventory"
  | "equipment"
  | "manuals"
  | "machines"
  | "archive"
  | "mailbox"
  | "audit"
  | "users"
  | "permissions"
  | "settings"
  | "profile";

export type NavGroup = "operacion" | "catalogo" | "archivo" | "administracion";

export type NavBadgeKind = "queue" | "count";

export interface NavItem {
  id: NavId;
  label: string;
  icon: LucideIcon;
  /** Contador a mostrar en la píldora del menú (0 = sin píldora). */
  badge: number;
  group?: NavGroup;
  badgeKind?: NavBadgeKind;
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
  incidentsFilter?: import("@/lib/workshop").IncidentStatus | "all";
  requestId?: Id<"partRequests"> | null;
  requestsEquipmentFilter?: string;
  requestsFilter?: RequestFilterId;
  archiveEntry?: OpenArchivedDoc | null;
  inventorySearch?: string;
  inventoryCategory?: string;
  inventoryLowStockOnly?: boolean;
  equipmentSearch?: string;
  manualId?: Id<"manuals"> | null;
  manualsSearch?: string;
  purchasingSection?: "pending" | "orders" | "movements" | "history";
  purchaseOrderId?: Id<"purchaseOrders"> | null;
  timestamp?: number;
}
