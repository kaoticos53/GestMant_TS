import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Id } from "@/convex/_generated/dataModel";
import type { Capability } from "@/lib/permissions";
import { LogOut, Search, Siren, Sparkles } from "lucide-react";
import { Suspense, lazy } from "react";
import { Link } from "react-router";
import { IncidentLookup } from "../IncidentLookup";
import type { RequestFilterId } from "../requests/types";
import type { NavId } from "../types";

const ArchiveView = lazy(() =>
  import("../ArchiveView").then((m) => ({ default: m.ArchiveView })),
);
const AuditView = lazy(() =>
  import("../AuditView").then((m) => ({ default: m.AuditView })),
);
const EquipmentView = lazy(() =>
  import("../EquipmentView").then((m) => ({ default: m.EquipmentView })),
);
const IncidentsView = lazy(() =>
  import("../IncidentsView").then((m) => ({ default: m.IncidentsView })),
);
const InventoryView = lazy(() =>
  import("../InventoryView").then((m) => ({ default: m.InventoryView })),
);
const ManualsView = lazy(() =>
  import("../ManualsView").then((m) => ({ default: m.ManualsView })),
);
const MachinesView = lazy(() =>
  import("../MachinesView").then((m) => ({ default: m.MachinesView })),
);
const PermissionsView = lazy(() =>
  import("../PermissionsView").then((m) => ({ default: m.PermissionsView })),
);
const ProfileView = lazy(() =>
  import("../ProfileView").then((m) => ({ default: m.ProfileView })),
);
const PurchasingView = lazy(() =>
  import("../PurchasingView").then((m) => ({ default: m.PurchasingView })),
);
const RequestsView = lazy(() =>
  import("../RequestsView").then((m) => ({ default: m.RequestsView })),
);
const UsersView = lazy(() =>
  import("../UsersView").then((m) => ({ default: m.UsersView })),
);
const WorkshopSettingsView = lazy(() =>
  import("../WorkshopSettingsView").then((m) => ({
    default: m.WorkshopSettingsView,
  })),
);

function ViewSkeleton() {
  return (
    <div className="grid gap-4 animate-pulse">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-44 rounded-lg" />
        <Skeleton className="h-8 w-28 rounded-lg" />
      </div>
      <Skeleton className="h-64 rounded-xl border border-border/70 bg-card/50" />
      <Skeleton className="h-36 rounded-xl border border-border/70 bg-card/50" />
    </div>
  );
}

export interface DashboardContentProps {
  isGuest: boolean;
  showEmptyNotice: boolean;
  loading: boolean;
  activeTab: NavId;
  user: any;
  displayName: string;
  adminOk: boolean;
  can: (capability: Capability) => boolean;
  canSeePurchasing: boolean;
  initialIncidentId: Id<"incidents"> | null;
  incidentsViewKey: number;
  requestsEquipmentFilter: string;
  onEquipmentFilterChange: (val: string) => void;
  initialRequestId: Id<"partRequests"> | null;
  requestsInitialFilter: RequestFilterId;
  requestsViewKey: number;
  inventoryInitialSearch: string;
  inventoryLowStockOnly: boolean;
  inventoryViewKey: number;
  equipmentInitialSearch: string;
  equipmentViewKey: number;
  searchParamsCode: string | null;
  isSeeding: boolean;
  onSeed: () => void;
  onStartEmpty: () => void;
  onSwitchAccount: () => void;
  onOpenIncident: (id: Id<"incidents">) => void;
  goToTab: (id: NavId) => void;
  onEquipmentViewRequests: (equipmentId: string) => void;
}

export function DashboardContent({
  isGuest,
  showEmptyNotice,
  loading,
  activeTab,
  user,
  displayName,
  adminOk,
  can,
  canSeePurchasing,
  initialIncidentId,
  incidentsViewKey,
  requestsEquipmentFilter,
  onEquipmentFilterChange,
  initialRequestId,
  requestsInitialFilter,
  requestsViewKey,
  inventoryInitialSearch,
  inventoryLowStockOnly,
  inventoryViewKey,
  equipmentInitialSearch,
  equipmentViewKey,
  searchParamsCode,
  isSeeding,
  onSeed,
  onStartEmpty,
  onSwitchAccount,
  onOpenIncident,
  goToTab,
  onEquipmentViewRequests,
}: DashboardContentProps) {
  if (isGuest) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center shadow-sm">
        <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-signal/10 text-signal">
          <Search className="size-5" />
        </span>
        <h2 className="mt-4 text-lg font-semibold tracking-tight">
          Sigue o notifica una incidencia
        </h2>
        <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
          Estás en una sesión de invitado: escribe el código que te dieron al
          notificarla para comprobar su estado y seguimiento, o notifica una nueva incidencia.
          La cola de trabajo, las peticiones y el inventario están reservados para
          usuarios con cuenta del taller.
        </p>
        <IncidentLookup
          className="mx-auto mt-5 max-w-md"
          initialCode={searchParamsCode}
        />
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button asChild className="gap-2">
            <Link to="/reportar">
              <Siren className="size-4" />
              Notificar una incidencia
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={onSwitchAccount}
          >
            <LogOut className="size-4" />
            Entrar con mi cuenta
          </Button>
        </div>
      </div>
    );
  }

  if (
    showEmptyNotice &&
    activeTab !== "profile" &&
    activeTab !== "permissions" &&
    activeTab !== "settings" &&
    activeTab !== "archive" &&
    activeTab !== "audit"
  ) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center shadow-sm">
        <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-signal/10 text-signal">
          <Sparkles className="size-5" />
        </span>
        <h2 className="mt-4 text-lg font-semibold tracking-tight">
          El taller todavía no tiene datos
        </h2>
        <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
          Puedes cargar la muestra de ejemplo para recorrer el flujo completo, o
          empezar con el taller vacío y dar de alta tus propios repuestos,
          equipos e incidencias.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {can("manageInventory") && (
            <Button
              type="button"
              className="gap-2"
              onClick={onSeed}
              disabled={isSeeding}
            >
              <Sparkles className="size-4" />
              {isSeeding ? "Cargando datos..." : "Cargar datos de ejemplo"}
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onStartEmpty}>
            Empezar con el taller vacío
          </Button>
        </div>
        {!can("manageInventory") && (
          <p className="mt-3 text-sm text-muted-foreground">
            Los datos de ejemplo los carga quien puede modificar el catálogo de
            repuestos.
          </p>
        )}
      </div>
    );
  }

  return (
    <Suspense fallback={<ViewSkeleton />}>
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
          key={`incidents-${incidentsViewKey}`}
          currentUserId={user?._id ?? null}
          currentUserName={displayName}
          canAssign={can("manageIncidents")}
          initialDetailId={initialIncidentId}
        />
      ) : activeTab === "requests" ? (
        <RequestsView
          key={`requests-${requestsViewKey}`}
          equipmentFilter={requestsEquipmentFilter}
          onEquipmentFilterChange={onEquipmentFilterChange}
          canManage={can("decideRequests")}
          canPurchase={can("managePurchasing") && can("viewPurchasing")}
          initialDetailId={initialRequestId}
          initialFilter={requestsInitialFilter}
        />
      ) : activeTab === "purchasing" && canSeePurchasing ? (
        <PurchasingView canManage={can("managePurchasing")} />
      ) : activeTab === "inventory" && can("viewInventory") ? (
        <InventoryView
          key={`inventory-${inventoryViewKey}`}
          canManage={can("manageInventory")}
          currentUserId={user?._id ?? null}
          initialSearch={inventoryInitialSearch}
          initialLowStockOnly={inventoryLowStockOnly}
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
          key={`equipment-${equipmentViewKey}`}
          canManage={can("manageEquipment")}
          canWriteManuals={can("viewManuals") && !isGuest}
          canManageManuals={can("manageManuals")}
          currentUserId={user?._id ?? null}
          initialSearch={equipmentInitialSearch}
          onViewRequests={onEquipmentViewRequests}
        />
      ) : activeTab === "archive" ? (
        <ArchiveView
          canArchiveIncidents={can("manageIncidents")}
          canArchiveRequests={can("decideRequests")}
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
        />
      ) : activeTab === "audit" && adminOk ? (
        <AuditView onOpenIncident={onOpenIncident} />
      ) : activeTab === "users" && adminOk ? (
        <UsersView />
      ) : activeTab === "permissions" && adminOk ? (
        <PermissionsView />
      ) : null}
    </Suspense>
  );
}
