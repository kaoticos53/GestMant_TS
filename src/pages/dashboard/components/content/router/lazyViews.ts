import { lazy } from "react";

export const ArchiveView = lazy(() =>
  import("../../../ArchiveView").then((m) => ({ default: m.ArchiveView })),
);
export const AuditView = lazy(() =>
  import("../../../AuditView").then((m) => ({ default: m.AuditView })),
);
export const EquipmentView = lazy(() =>
  import("../../../EquipmentView").then((m) => ({ default: m.EquipmentView })),
);
export const IncidentsView = lazy(() =>
  import("../../../IncidentsView").then((m) => ({ default: m.IncidentsView })),
);
export const InventoryView = lazy(() =>
  import("../../../InventoryView").then((m) => ({ default: m.InventoryView })),
);
export const ManualsView = lazy(() =>
  import("../../../ManualsView").then((m) => ({ default: m.ManualsView })),
);
export const MachinesView = lazy(() =>
  import("../../../MachinesView").then((m) => ({ default: m.MachinesView })),
);
export const PermissionsView = lazy(() =>
  import("../../../PermissionsView").then((m) => ({
    default: m.PermissionsView,
  })),
);
export const ProfileView = lazy(() =>
  import("../../../ProfileView").then((m) => ({ default: m.ProfileView })),
);
export const PurchasingView = lazy(() =>
  import("../../../PurchasingView").then((m) => ({
    default: m.PurchasingView,
  })),
);
export const RequestsView = lazy(() =>
  import("../../../RequestsView").then((m) => ({ default: m.RequestsView })),
);
export const UsersView = lazy(() =>
  import("../../../UsersView").then((m) => ({ default: m.UsersView })),
);
export const WorkshopSettingsView = lazy(() =>
  import("../../../WorkshopSettingsView").then((m) => ({
    default: m.WorkshopSettingsView,
  })),
);
