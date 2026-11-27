import type { DashboardTabRouterProps } from "../types";
import { canAccessDashboardTab } from "./helpers";
import {
  AnalyticsView,
  ArchiveView,
  AuditView,
  EquipmentView,
  IncidentsView,
  InventoryView,
  MachinesView,
  MailboxView,
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
    openInventory,
    openEquipmentViewRequests,
    setRequestsEquipmentFilter,
    setTarget,
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
    case "analytics":
      return (
        <AnalyticsView
          onOpenIncidents={() => goToTab("incidents")}
          onOpenRequests={() => goToTab("requests")}
          onOpenInventoryLowStock={() => openInventory(true)}
          onOpenEquipment={() => goToTab("equipment")}
          onOpenPurchasingPending={
            canSeePurchasing
              ? () =>
                  setTarget((prev) => ({
                    ...prev,
                    tab: "purchasing",
                    purchasingSection: "pending",
                    purchaseOrderId: null,
                    timestamp: Date.now(),
                  }))
              : undefined
          }
          onSelectIncidentStatus={
            can("viewIncidents")
              ? (status) =>
                  setTarget((prev) => ({
                    ...prev,
                    tab: "incidents",
                    incidentsFilter: status,
                    incidentsSearch: "",
                    incidentId: null,
                    timestamp: Date.now(),
                  }))
              : undefined
          }
          onSelectPartCategory={
            can("viewInventory")
              ? (category) =>
                  setTarget((prev) => ({
                    ...prev,
                    tab: "inventory",
                    inventorySearch: "",
                    inventoryCategory: category,
                    inventoryLowStockOnly: false,
                    timestamp: Date.now(),
                  }))
              : undefined
          }
          onSelectEquipment={
            can("viewIncidents")
              ? (label) =>
                  setTarget((prev) => ({
                    ...prev,
                    tab: "incidents",
                    incidentsSearch: label,
                    incidentsFilter: "all",
                    incidentId: null,
                    timestamp: Date.now(),
                  }))
              : undefined
          }
          onSelectPart={(code) =>
            setTarget((prev) => ({
              ...prev,
              tab: "inventory",
              inventorySearch: code,
              inventoryCategory: "all",
              inventoryLowStockOnly: false,
              timestamp: Date.now(),
            }))
          }
        />
      );

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
          key={`incidents-${viewKeys.incidents}-${target.incidentsFilter ?? "all"}-${target.incidentsSearch ?? ""}`}
          currentUserId={user?._id ?? null}
          currentUserName={displayName}
          canAssign={can("manageIncidents")}
          initialDetailId={target.incidentId ?? null}
          initialFilter={target.incidentsFilter ?? "all"}
          initialSearch={target.incidentsSearch ?? ""}
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
          onOpenPurchasing={
            can("viewPurchasing")
              ? (section, orderId) =>
                  setTarget((prev) => ({
                    ...prev,
                    tab: "purchasing",
                    purchasingSection: section,
                    purchaseOrderId: orderId ?? null,
                    timestamp: Date.now(),
                  }))
              : undefined
          }
          onOpenIncident={can("viewIncidents") ? openIncident : undefined}
        />
      );

    case "purchasing":
      return (
        <PurchasingView
          key={`purchasing-${target.purchasingSection ?? "pending"}-${target.purchaseOrderId ?? ""}-${target.timestamp ?? 0}`}
          canManage={can("managePurchasing")}
          initialSection={target.purchasingSection ?? "pending"}
          initialOrderId={target.purchaseOrderId ?? null}
          onOpenRequest={can("viewRequests") ? openRequest : undefined}
        />
      );

    case "inventory":
      return (
        <InventoryView
          key={`inventory-${viewKeys.inventory}-${target.inventoryCategory ?? "all"}-${target.inventorySearch ?? ""}-${target.inventoryLowStockOnly ? "low" : "all"}`}
          canManage={can("manageInventory")}
          currentUserId={user?._id ?? null}
          initialSearch={target.inventorySearch ?? ""}
          initialCategory={target.inventoryCategory ?? "all"}
          initialLowStockOnly={target.inventoryLowStockOnly ?? false}
          onOpenEquipmentModel={(modelName) =>
            setTarget((prev) => ({
              ...prev,
              tab: "equipment",
              equipmentSearch: modelName,
              timestamp: Date.now(),
            }))
          }
        />
      );

    case "manuals":
      return (
        <ManualsView
          key={`manuals-${viewKeys.manuals}-${target.manualId ?? ""}-${target.manualsSearch ?? ""}`}
          canManage={can("manageManuals")}
          canWriteNotes={can("viewManuals") && !isGuest}
          currentUserId={user?._id ?? null}
          initialSearch={target.manualsSearch ?? ""}
          initialDetailId={target.manualId ?? null}
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

    case "mailbox":
      return (
        <MailboxView
          key={`mailbox-${viewKeys.mailbox}`}
          onOpenSettings={() => goToTab("settings")}
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
          canUseMailbox={!isGuest && can("viewMailbox")}
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
