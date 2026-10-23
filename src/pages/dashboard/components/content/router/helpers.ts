import type { Capability } from "@/lib/permissions";
import type { NavId } from "../../types";

export interface TabAccessContext {
  can: (capability: Capability) => boolean;
  canSeePurchasing: boolean;
  adminOk: boolean;
  isGuest: boolean;
}

/**
 * Determina si la pestaña solicitada tiene autorización según los permisos y rol del usuario.
 */
export function canAccessDashboardTab(
  tab: NavId,
  context: TabAccessContext,
): boolean {
  const { can, canSeePurchasing, adminOk, isGuest } = context;

  switch (tab) {
    case "profile":
    case "incidents":
    case "requests":
    case "archive":
    case "settings":
      return true;

    case "purchasing":
      return canSeePurchasing;

    case "inventory":
      return can("viewInventory");

    case "manuals":
      return can("viewManuals") && !isGuest;

    case "machines":
      return !isGuest;

    case "equipment":
      return can("viewEquipment");

    case "audit":
    case "users":
    case "permissions":
      return adminOk;

    default:
      return false;
  }
}
