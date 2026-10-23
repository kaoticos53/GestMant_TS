import type { Capability } from "@/lib/permissions";
import type { NavId } from "@/pages/dashboard/types";

export interface TabAccessContext {
  can: (capability: Capability) => boolean;
  canSeePurchasing: boolean;
  adminOk: boolean;
  isGuest: boolean;
}

/**
 * Lo que hay que cumplir para abrir una pestaña del panel.
 *
 * Se escribe una vez, en una sola tabla, en lugar de repartirlo por un `switch`:
 * así el reparto de accesos se lee de un vistazo —qué pestaña es de todos, cuál
 * pide una capacidad, cuál es solo del administrador— y añadir una pestaña
 * nueva sin decidir quién la ve lo señala el compilador, no un usuario sin
 * acceso. Los tipos de las pestañas (`NavId`) y de las capacidades
 * (`Capability`) son los mismos que usa el resto de la aplicación.
 *
 * - `open`: la abre cualquiera que haya entrado, sin más.
 * - `flag`: depende de un dato ya calculado fuera (hoy, si se puede ver
 *   compras, que mezcla capacidad y contenido).
 * - `capability`: exige una capacidad concreta; `staffOnly` añade que la sesión
 *   no sea anónima.
 * - `staff`: cualquier miembro del taller, nunca un invitado.
 * - `admin`: solo el administrador.
 */
export type TabAccessRule =
  | { kind: "open" }
  | { kind: "flag"; flag: "canSeePurchasing" }
  | { kind: "capability"; capability: Capability; staffOnly?: boolean }
  | { kind: "staff" }
  | { kind: "admin" };

/**
 * La matriz de accesos del panel. Una fila por pestaña; el `satisfies` obliga a
 * que estén todas las del menú (`NavId`) y ninguna de más.
 */
export const TAB_ACCESS_POLICY = {
  profile: { kind: "open" },
  incidents: { kind: "open" },
  requests: { kind: "open" },
  archive: { kind: "open" },
  settings: { kind: "open" },
  purchasing: { kind: "flag", flag: "canSeePurchasing" },
  inventory: { kind: "capability", capability: "viewInventory" },
  manuals: { kind: "capability", capability: "viewManuals", staffOnly: true },
  machines: { kind: "staff" },
  equipment: { kind: "capability", capability: "viewEquipment" },
  audit: { kind: "admin" },
  users: { kind: "admin" },
  permissions: { kind: "admin" },
} as const satisfies Record<NavId, TabAccessRule>;

/**
 * Determina si la pestaña solicitada tiene autorización según los permisos y rol del usuario.
 */
export function canAccessDashboardTab(
  tab: NavId,
  context: TabAccessContext,
): boolean {
  const rule: TabAccessRule = TAB_ACCESS_POLICY[tab];
  const { can, canSeePurchasing, adminOk, isGuest } = context;

  switch (rule.kind) {
    case "open":
      return true;
    case "flag":
      return rule.flag === "canSeePurchasing" ? canSeePurchasing : false;
    case "capability":
      if (rule.staffOnly && isGuest) return false;
      return can(rule.capability);
    case "staff":
      return !isGuest;
    case "admin":
      return adminOk;
    default:
      // Una regla nueva sin resolver aquí no abre nada: es el lado seguro.
      return false;
  }
}
