import { Suspense, lazy } from "react";
import { WorkAlertNotice } from "./dashboard/WorkAlertNotice";
import { DashboardContent } from "./dashboard/components/DashboardContent";
import { DashboardHeader } from "./dashboard/components/DashboardHeader";
import { DashboardInactiveNotice } from "./dashboard/components/DashboardInactiveNotice";
import { DashboardSidebar } from "./dashboard/components/DashboardSidebar";
import { DashboardStats } from "./dashboard/components/DashboardStats";
import { PageHeader } from "./dashboard/components/PageHeader";
import { useDashboardState } from "./dashboard/hooks/useDashboardState";

const WeeklyReportDialog = lazy(() =>
  import("./dashboard/WeeklyReportDialog").then((m) => ({
    default: m.WeeklyReportDialog,
  })),
);

export default function Dashboard() {
  const {
    user,
    isGuest,
    accountDeactivated,
    displayName,
    initial,
    role,
    roleBadge,
    adminOk,
    can,
    canSeePurchasing,
    searchParamsCode,
    sidebarRef,
    sidebarCollapsed,
    sidebarWidth,
    sidebarResizing,
    resizeHandleProps,
    toggleSidebar,
    navigation,
    navItems,
    navBadges,
    activeTab,
    goToTab,
    openIncident,
    handleSearchSelect,
    openNotification,
    heading,
    headerActions,
    loading,
    stats,
    summaryHidden,
    alertRoleKeys,
    alertDays,
    staleWork,
    alertDismissed,
    dismissAlert,
    showEmptyNotice,
    isSeeding,
    handleSeed,
    handleStartEmpty,
    handleSignOut,
    handleSwitchAccount,
    weeklyReportOpen,
    setWeeklyReportOpen,
  } = useDashboardState();

  if (accountDeactivated) {
    return <DashboardInactiveNotice onSignOut={() => void handleSignOut()} />;
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
        onSignOut={() => void handleSignOut()}
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
          onSignOut={() => void handleSignOut()}
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
              searchParamsCode={searchParamsCode}
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
