import { lazy } from "react";
import type { NavId } from "@/pages/dashboard/types";

/**
 * Vistas del panel, cada una en su trozo.
 *
 * Las cargas viven en un solo mapa porque además de montar la vista hacen otro
 * trabajo: precargarla. `prefetchTab` es lo que se llama al pasar por encima de
 * una pestaña del menú (o al enfocarla con el teclado): el trozo empieza a
 * bajar antes de que nadie pulse, y al pulsar la vista ya está —o casi—. Sin el
 * mapa compartido habría dos listas de importaciones que se irían separando, y
 * precargar una pestaña acabaría bajando un archivo distinto del que monta.
 */
const VIEW_LOADERS = {
  archive: () => import("../../../ArchiveView"),
  audit: () => import("../../../AuditView"),
  equipment: () => import("../../../EquipmentView"),
  incidents: () => import("../../../IncidentsView"),
  inventory: () => import("../../../InventoryView"),
  manuals: () => import("../../../ManualsView"),
  machines: () => import("../../../MachinesView"),
  permissions: () => import("../../../PermissionsView"),
  profile: () => import("../../../ProfileView"),
  purchasing: () => import("../../../PurchasingView"),
  requests: () => import("../../../RequestsView"),
  users: () => import("../../../UsersView"),
  settings: () => import("../../../WorkshopSettingsView"),
} as const satisfies Record<NavId, () => Promise<unknown>>;

/**
 * Empieza a bajar la vista de esa pestaña, sin montarla.
 *
 * Se traga el fallo a propósito: si la precarga no llega —una red que se corta,
 * un despliegue que cambia los nombres de los trozos— la pestaña se comporta
 * como siempre y el error de verdad sale al abrirla, con su aviso y su
 * reintento. Un fallo de precarga no puede romper el menú.
 */
export function prefetchTab(tab: NavId): void {
  void VIEW_LOADERS[tab]().catch(() => {});
}

export const ArchiveView = lazy(() =>
  VIEW_LOADERS.archive().then((m) => ({ default: m.ArchiveView })),
);
export const AuditView = lazy(() =>
  VIEW_LOADERS.audit().then((m) => ({ default: m.AuditView })),
);
export const EquipmentView = lazy(() =>
  VIEW_LOADERS.equipment().then((m) => ({ default: m.EquipmentView })),
);
export const IncidentsView = lazy(() =>
  VIEW_LOADERS.incidents().then((m) => ({ default: m.IncidentsView })),
);
export const InventoryView = lazy(() =>
  VIEW_LOADERS.inventory().then((m) => ({ default: m.InventoryView })),
);
export const ManualsView = lazy(() =>
  VIEW_LOADERS.manuals().then((m) => ({ default: m.ManualsView })),
);
export const MachinesView = lazy(() =>
  VIEW_LOADERS.machines().then((m) => ({ default: m.MachinesView })),
);
export const PermissionsView = lazy(() =>
  VIEW_LOADERS.permissions().then((m) => ({ default: m.PermissionsView })),
);
export const ProfileView = lazy(() =>
  VIEW_LOADERS.profile().then((m) => ({ default: m.ProfileView })),
);
export const PurchasingView = lazy(() =>
  VIEW_LOADERS.purchasing().then((m) => ({ default: m.PurchasingView })),
);
export const RequestsView = lazy(() =>
  VIEW_LOADERS.requests().then((m) => ({ default: m.RequestsView })),
);
export const UsersView = lazy(() =>
  VIEW_LOADERS.users().then((m) => ({ default: m.UsersView })),
);
export const WorkshopSettingsView = lazy(() =>
  VIEW_LOADERS.settings().then((m) => ({ default: m.WorkshopSettingsView })),
);
