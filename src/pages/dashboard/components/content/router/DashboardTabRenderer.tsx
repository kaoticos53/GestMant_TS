import type { DashboardTabRouterProps } from "../types";
import { canAccessDashboardTab } from "./helpers";
import {
  ArchiveView,
  AuditView,
  EquipmentView,
  IncidentsView,
  InventoryView,
  MachinesView,
  ManualsView,
  PermissionsView,
  ProfileView,
  PurchasingView,
  RequestsView,
  UsersView,
  WorkshopSettingsView,
} from "./lazyViews";

/**
 * Despacha de forma declarativa la vista asociada a la pestaña activa del dashboard.
 */
export function DashboardTabRenderer({
  navigation,
  user,
  displayName,
  adminOk,
  can,
  canSeePurchasing,
  isGuest,
}: Omit<DashboardTabRouterProps, "loading">) {
  const {
    activeTab,
    target,
    viewKeys,
    goToTab,
    openIncident,
    openRequest,
    openEquipmentViewRequests,
    setRequestsEquipmentFilter,
  } = navigation;

  const allowed = canAccessDashboardTab(activeTab, {
    can,
    canSeePurchasing,
    adminOk,
    isGuest,
  });

  if (!allowed) {
    return null;
  }

  switch (activeTab) {
    case "profile":
      return (
        <ProfileView
          user={user}
          onOpenIncidents={() => goToTab("incidents")}
          onOpenRequests={() => goToTab("requests")}
        />
      );

    case "incidents":
      return (
        <IncidentsView
          key={`incidents-${viewKeys.incidents}`}
          currentUserId={user?._id ?? null}
          currentUserName={displayName}
          canAssign={can("manageIncidents")}
          initialDetailId={target.incidentId ?? null}
          canOpenRequests={can("viewRequests")}
          onOpenRequest={openRequest}
        />
      );

    case "requests":
      return (
        <RequestsView
          key={`requests-${viewKeys.requests}`}
          equipmentFilter={target.requestsEquipmentFilter ?? "all"}
          onEquipmentFilterChange={setRequestsEquipmentFilter}
          canManage={can("decideRequests")}
          canPurchase={can("managePurchasing") && can("viewPurchasing")}
          initialDetailId={target.requestId ?? null}
          initialFilter={target.requestsFilter ?? "all"}
        />
      );

    case "purchasing":
      return <PurchasingView canManage={can("managePurchasing")} />;

    case "inventory":
      return (
        <InventoryView
          key={`inventory-${viewKeys.inventory}`}
          canManage={can("manageInventory")}
          currentUserId={user?._id ?? null}
          initialSearch={target.inventorySearch ?? ""}
          initialLowStockOnly={target.inventoryLowStockOnly ?? false}
        />
      );

    case "manuals":
      return (
        <ManualsView
          canManage={can("manageManuals")}
          currentUserId={user?._id ?? null}
        />
      );

    case "machines":
      return <MachinesView />;

    case "equipment":
      return (
        <EquipmentView
          key={`equipment-${viewKeys.equipment}`}
          canManage={can("manageEquipment")}
          canWriteManuals={can("viewManuals") && !isGuest}
          canManageManuals={can("manageManuals")}
          currentUserId={user?._id ?? null}
          initialSearch={target.equipmentSearch ?? ""}
          onViewRequests={openEquipmentViewRequests}
        />
      );

    case "archive":
      return (
        <ArchiveView
          key={`archive-${viewKeys.archive}`}
          initialEntry={target.archiveEntry ?? null}
          canArchiveIncidents={can("manageIncidents")}
          canArchiveRequests={can("decideRequests")}
          canViewCatalog={can("viewInventory")}
          canViewEquipment={can("viewEquipment")}
          currentUserId={user?._id ?? null}
          currentUserName={displayName}
          onOpenRequest={openRequest}
          onOpenSettings={
            can("manageIncidents") || can("decideRequests")
              ? () => goToTab("settings")
              : undefined
          }
        />
      );

    case "settings":
      return (
        <WorkshopSettingsView
          canManageArchive={can("manageIncidents") || can("decideRequests")}
          canManageAlert={can("manageIncidents")}
          canManageAudit={adminOk && can("viewAudit")}
          canPurgeUploads={can("manageIncidents") || can("decideRequests")}
          canManageData={adminOk}
          canManageMail={adminOk}
          canManageIncidents={can("manageIncidents")}
          canDecideRequests={can("decideRequests")}
        />
      );

    case "audit":
      return <AuditView onOpenIncident={openIncident} />;

    case "users":
      return <UsersView />;

    case "permissions":
      return <PermissionsView />;

    default:
      return null;
  }
}
