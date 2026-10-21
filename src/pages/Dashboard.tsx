import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { DEFAULT_GRANTS, type Capability } from "@/lib/permissions";
import {
  DEFAULT_ROLE,
  isSystemRole,
  roleBadgeClassName,
} from "@/lib/roles";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { LogOut } from "lucide-react";
import { Suspense, lazy, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { WorkAlertNotice } from "./dashboard/WorkAlertNotice";
import { DashboardContent } from "./dashboard/components/DashboardContent";
import { DashboardHeader } from "./dashboard/components/DashboardHeader";
import { DashboardSidebar } from "./dashboard/components/DashboardSidebar";
import { DashboardStats } from "./dashboard/components/DashboardStats";
import { PageHeader } from "./dashboard/components/PageHeader";
import {
  buildDashboardStats,
  buildHeaderActions,
  buildNavItems,
  computeNavBadges,
  getHeadingInfo,
  isSummaryHidden,
} from "./dashboard/constants/navConfig";
import { useDashboardNavigation } from "./dashboard/hooks/useDashboardNavigation";
import { useDashboardSeed } from "./dashboard/hooks/useDashboardSeed";
import { useEnsureRole } from "./dashboard/hooks/useEnsureRole";
import { useSidebarPanel } from "./dashboard/hooks/useSidebarPanel";
import { useWorkAlertState } from "./dashboard/hooks/useWorkAlertState";

const WeeklyReportDialog = lazy(() =>
  import("./dashboard/WeeklyReportDialog").then((m) => ({
    default: m.WeeklyReportDialog,
  })),
);

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const isGuest = user?.isAnonymous === true;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const permissions = useQuery(api.permissions.myPermissions);
  const [weeklyReportOpen, setWeeklyReportOpen] = useState(false);

  // Menú lateral colapsable y persistido
  const {
    width: sidebarWidth,
    resizing: sidebarResizing,
    collapsed: sidebarCollapsed,
    toggleCollapsed: toggleSidebar,
    asideRef: sidebarRef,
    resizeHandleProps,
  } = useSidebarPanel(isGuest ? null : user);

  // Control de rol y permisos
  const { role, roleLabel, adminOk, needsRole } = useEnsureRole(
    user,
    permissions?.label,
  );

  const grants = isGuest
    ? DEFAULT_GRANTS.guest
    : (permissions?.grants ??
      DEFAULT_GRANTS[isSystemRole(role) ? role : DEFAULT_ROLE]);
  const can = (capability: Capability) => grants[capability] === true;
  const canConfigureReport = can("manageIncidents") || can("decideRequests");
  const canSeePurchasing = can("viewPurchasing") || can("managePurchasing");

  // Configuración de módulos según permisos y navegación
  const navItems = buildNavItems({ can, adminOk, isGuest, canSeePurchasing });
  const navigation = useDashboardNavigation(can, navItems);
  const {
    activeTab,
    goToTab,
    openIncident,
    handleSearchSelect,
    openNotification,
  } = navigation;

  // Alertas de trabajo y estado de taller vacío
  const {
    summary,
    alertDays,
    alertRoleKeys,
    seesAlert,
    staleWork,
    alertDismissed,
    dismissAlert,
    restoreAlert,
    handleStartEmpty,
    markStartedEmpty,
    isEmpty,
    showEmptyNotice,
  } = useWorkAlertState(
    user,
    role,
    summary?.parts.total ?? 0,
    summary?.requests.active ?? 0,
    summary === undefined,
  );

  // Carga de datos de demostración
  const { isSeeding, isSeedingMore, handleSeed, handleSeedMore } = useDashboardSeed({
    onSeedSuccess: () => markStartedEmpty(false),
  });

  const loading = summary === undefined;
  const navBadges = computeNavBadges(summary);
  const stats = buildDashboardStats({
    summary,
    can,
    openRequests: navigation.openRequests,
    openInventory: navigation.openInventory,
  });
  const summaryHidden = isSummaryHidden(activeTab, stats.length);
  const heading = getHeadingInfo(activeTab, isGuest, summary);

  const headerActions = buildHeaderActions({
    canConfigureReport,
    onOpenWeeklyReport: () => setWeeklyReportOpen(true),
    seesAlert,
    hasStaleWork: staleWork.length > 0,
    alertDismissed,
    onRestoreAlert: restoreAlert,
    canManageInventory: can("manageInventory"),
    isEmpty,
    isSeedingMore,
    loading,
    onSeedMore: () => void handleSeedMore(),
  });

  const displayName =
    user?.name ||
    user?.email ||
    (user?.isAnonymous ? "Invitado" : "Responsable de repuestos");
  const initial = displayName.trim().charAt(0).toUpperCase() || "R";

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleSwitchAccount = async () => {
    await signOut();
    navigate("/auth");
  };

  // Actualizar título del documento en el navegador
  useEffect(() => {
    document.title = `${heading.title} · Pulso Taller`;
  }, [heading.title]);

  const roleBadge = needsRole ? (
    <span className="inline-flex rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
      Configurando perfil...
    </span>
  ) : (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-xs font-medium",
        roleBadgeClassName(role),
      )}
    >
      {roleLabel}
    </span>
  );

  // Cuenta dada de baja: acceso bloqueado hasta reactivación por administrador
  if (user && user.active === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-md rounded-xl border border-border/70 bg-card p-8 text-center shadow-sm">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <LogOut className="size-6" />
          </span>
          <h1 className="mt-4 text-xl font-semibold tracking-tight">
            Cuenta desactivada
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Tu acceso al taller ha sido dado de baja. Habla con el administrador
            del equipo si crees que es un error.
          </p>
          <Button type="button" className="mt-5 gap-2" onClick={handleSignOut}>
            <LogOut className="size-4" />
            Cerrar sesión
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        Saltar al contenido
      </a>
      <DashboardSidebar
        sidebarRef={sidebarRef}
        sidebarCollapsed={sidebarCollapsed}
        sidebarWidth={sidebarWidth}
        sidebarResizing={sidebarResizing}
        resizeHandleProps={resizeHandleProps}
        toggleSidebar={toggleSidebar}
        isGuest={isGuest}
        canSearchCatalog={can("viewInventory")}
        canSendMessages={can("sendMessages")}
        onSearchSelect={handleSearchSelect}
        onOpenNotification={openNotification}
        navItems={navItems}
        navBadges={navBadges}
        activeTab={activeTab}
        onSelectTab={goToTab}
        displayName={displayName}
        initial={initial}
        userEmail={user?.email}
        roleBadge={roleBadge}
        onSignOut={handleSignOut}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader
          sidebarCollapsed={sidebarCollapsed}
          toggleSidebar={toggleSidebar}
          roleBadge={roleBadge}
          onOpenNotification={openNotification}
          canSendMessages={can("sendMessages")}
          isGuest={isGuest}
          canSearchCatalog={can("viewInventory")}
          onSearchSelect={handleSearchSelect}
          activeTab={activeTab}
          goToTab={goToTab}
          initial={initial}
          onSignOut={handleSignOut}
          navItems={navItems}
          navBadges={navBadges}
        />

        <main
          id="contenido"
          tabIndex={-1}
          className="mx-auto w-full max-w-7xl flex-1 px-4 pb-1 pt-4 sm:px-6 sm:pt-5"
        >
          <PageHeader
            title={heading.title}
            count={heading.count}
            description={heading.description}
            actions={headerActions}
          />

          {!summaryHidden && (
            <WorkAlertNotice
              role={role}
              audience={alertRoleKeys}
              days={alertDays}
              staleWork={staleWork}
              dismissed={alertDismissed}
              canOpenSettings={can("manageIncidents")}
              onOpenIncident={openIncident}
              onOpenSettings={() => goToTab("settings")}
              onDismiss={dismissAlert}
            />
          )}

          <DashboardStats
            loading={loading}
            hidden={summaryHidden}
            stats={stats}
          />

          <section className="mt-2">
            <DashboardContent
              navigation={navigation}
              isGuest={isGuest}
              showEmptyNotice={showEmptyNotice}
              loading={loading}
              user={user}
              displayName={displayName}
              adminOk={adminOk}
              can={can}
              canSeePurchasing={canSeePurchasing}
              searchParamsCode={searchParams.get("codigo")}
              isSeeding={isSeeding}
              onSeed={() => void handleSeed()}
              onStartEmpty={handleStartEmpty}
              onSwitchAccount={() => void handleSwitchAccount()}
            />
          </section>
        </main>

        {weeklyReportOpen && (
          <Suspense fallback={null}>
            <WeeklyReportDialog
              open={weeklyReportOpen}
              onOpenChange={setWeeklyReportOpen}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}
