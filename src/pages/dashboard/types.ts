import type { LucideIcon } from "lucide-react";

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
