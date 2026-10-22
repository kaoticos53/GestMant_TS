import { ModuleErrorBoundary } from "@/components/ModuleErrorBoundary";
import { Skeleton } from "@/components/ui/skeleton";
import { Suspense, lazy } from "react";
import { DashboardViewSkeleton } from "./DashboardViewSkeleton";
import type { DashboardTabRouterProps } from "./types";

const ArchiveView = lazy(() =>
  import("../../ArchiveView").then((m) => ({ default: m.ArchiveView })),
);
const AuditView = lazy(() =>
  import("../../AuditView").then((m) => ({ default: m.AuditView })),
);
const EquipmentView = lazy(() =>
  import("../../EquipmentView").then((m) => ({ default: m.EquipmentView })),
);
const IncidentsView = lazy(() =>
  import("../../IncidentsView").then((m) => ({ default: m.IncidentsView })),
);
const InventoryView = lazy(() =>
  import("../../InventoryView").then((m) => ({ default: m.InventoryView })),
);
const ManualsView = lazy(() =>
  import("../../ManualsView").then((m) => ({ default: m.ManualsView })),
);
const MachinesView = lazy(() =>
  import("../../MachinesView").then((m) => ({ default: m.MachinesView })),
);
const PermissionsView = lazy(() =>
  import("../../PermissionsView").then((m) => ({ default: m.PermissionsView })),
);
const ProfileView = lazy(() =>
  import("../../ProfileView").then((m) => ({ default: m.ProfileView })),
);
const PurchasingView = lazy(() =>
  import("../../PurchasingView").then((m) => ({ default: m.PurchasingView })),
);
const RequestsView = lazy(() =>
  import("../../RequestsView").then((m) => ({ default: m.RequestsView })),
);
const UsersView = lazy(() =>
  import("../../UsersView").then((m) => ({ default: m.UsersView })),
);
const WorkshopSettingsView = lazy(() =>
  import("../../WorkshopSettingsView").then((m) => ({
    default: m.WorkshopSettingsView,
  })),
);

export function DashboardTabRouter({
  navigation,
  loading,
  user,
  displayName,
  adminOk,
  can,
  canSeePurchasing,
  isGuest,
}: DashboardTabRouterProps) {
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

  return (
    <ModuleErrorBoundary key={activeTab} moduleName={activeTab}>
      <Suspense fallback={<DashboardViewSkeleton />}>
        {activeTab === "profile" ? (
          <ProfileView
            user={user}
            onOpenIncidents={() => goToTab("incidents")}
            onOpenRequests={() => goToTab("requests")}
          />
        ) : loading && activeTab !== "permissions" ? (
          <div className="grid gap-4">
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
          </div>
        ) : activeTab === "incidents" ? (
          <IncidentsView
            key={`incidents-${viewKeys.incidents}`}
            currentUserId={user?._id ?? null}
            currentUserName={displayName}
            canAssign={can("manageIncidents")}
            initialDetailId={target.incidentId ?? null}
            // Ver las peticiones es lo que permite saltar a una: sin ese permiso la
            // ficha las enseña —el estado del material es parte del caso— pero no
            // ofrece un botón que llevaría a un módulo cerrado.
            canOpenRequests={can("viewRequests")}
            onOpenRequest={openRequest}
          />
        ) : activeTab === "requests" ? (
          <RequestsView
            key={`requests-${viewKeys.requests}`}
            equipmentFilter={target.requestsEquipmentFilter ?? "all"}
            onEquipmentFilterChange={setRequestsEquipmentFilter}
            canManage={can("decideRequests")}
            canPurchase={can("managePurchasing") && can("viewPurchasing")}
            initialDetailId={target.requestId ?? null}
            initialFilter={target.requestsFilter ?? "all"}
          />
        ) : activeTab === "purchasing" && canSeePurchasing ? (
          <PurchasingView canManage={can("managePurchasing")} />
        ) : activeTab === "inventory" && can("viewInventory") ? (
          <InventoryView
            key={`inventory-${viewKeys.inventory}`}
            canManage={can("manageInventory")}
            currentUserId={user?._id ?? null}
            initialSearch={target.inventorySearch ?? ""}
            initialLowStockOnly={target.inventoryLowStockOnly ?? false}
          />
        ) : activeTab === "manuals" && can("viewManuals") && !isGuest ? (
          <ManualsView
            canManage={can("manageManuals")}
            currentUserId={user?._id ?? null}
          />
        ) : activeTab === "machines" && !isGuest ? (
          <MachinesView />
        ) : activeTab === "equipment" && can("viewEquipment") ? (
          <EquipmentView
            key={`equipment-${viewKeys.equipment}`}
            canManage={can("manageEquipment")}
            canWriteManuals={can("viewManuals") && !isGuest}
            canManageManuals={can("manageManuals")}
            currentUserId={user?._id ?? null}
            initialSearch={target.equipmentSearch ?? ""}
            onViewRequests={openEquipmentViewRequests}
          />
        ) : activeTab === "archive" ? (
          <ArchiveView
            key={`archive-${viewKeys.archive}`}
            initialEntry={target.archiveEntry ?? null}
            canArchiveIncidents={can("manageIncidents")}
            canArchiveRequests={can("decideRequests")}
            // La ficha del archivo se abre en solo lectura, pero necesita el
            // catálogo y el inventario para contar el stock y el equipo.
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
        ) : activeTab === "settings" ? (
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
        ) : activeTab === "audit" && adminOk ? (
          <AuditView onOpenIncident={openIncident} />
        ) : activeTab === "users" && adminOk ? (
          <UsersView />
        ) : activeTab === "permissions" && adminOk ? (
          <PermissionsView />
        ) : null}
      </Suspense>
    </ModuleErrorBoundary>
  );
}
