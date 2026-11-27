import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useConvex } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AiResultsDialog } from "@/components/ai/AiResultsDialog";
import { WorkshopAiChatProvider } from "@/components/ai/WorkshopAiChatButton";
import { MODULE_META } from "./dashboard/constants/navConfig";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import type { AiResultTable } from "@/lib/ai/types";
import {
  subscribeAiOpenReference,
  subscribeAiShowTables,
} from "@/lib/aiBridge";
import { type QuickAction } from "./dashboard/GlobalSearch";
import { buildSearchGroupsFromResponse } from "./dashboard/search/helpers";
import { WorkAlertNotice } from "./dashboard/WorkAlertNotice";
import { DashboardContent } from "./dashboard/components/DashboardContent";
import { DashboardHeader } from "./dashboard/components/DashboardHeader";
import { DashboardInactiveNotice } from "./dashboard/components/DashboardInactiveNotice";
import { KeyboardShortcutsDialog } from "./dashboard/components/KeyboardShortcutsDialog";
import { MobileBottomNav } from "./dashboard/components/MobileBottomNav";
import { AbilityProvider } from "@/components/AbilityProvider";
import { BackgroundJobsToastBridge } from "@/components/jobs/BackgroundJobsToastBridge";
import { DashboardSidebar } from "./dashboard/components/DashboardSidebar";
import { DashboardStats } from "./dashboard/components/DashboardStats";
import { PageHeader } from "./dashboard/components/PageHeader";
import { useDashboardState } from "./dashboard/hooks/useDashboardState";
import type { NavId } from "./dashboard/types";

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
    roles,
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

  const convex = useConvex();
  const navigate = useNavigate();
  const [aiTables, setAiTables] = useState<AiResultTable[] | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const quickActions = useMemo<QuickAction[]>(() => {
    const allowed = new Set(navItems.map((item) => item.id));
    const tabMeta: {
      tab: NavId;
      label: string;
      subtitle: string;
      shortcut: string;
      keywords: string[];
    }[] = [
      {
        tab: "incidents",
        label: "Ir a Incidencias",
        subtitle: "Abrir la cola de incidencias del taller",
        shortcut: "g i",
        keywords: ["incidencias", "averias", "cola"],
      },
      {
        tab: "requests",
        label: "Ir a Peticiones de repuesto",
        subtitle: "Abrir la cola de peticiones de material",
        shortcut: "g p",
        keywords: ["peticiones", "repuestos", "solicitudes"],
      },
      {
        tab: "inventory",
        label: "Ir a Repuestos",
        subtitle: "Abrir el inventario y existencias",
        shortcut: "g r",
        keywords: ["repuestos", "inventario", "almacen", "stock"],
      },
      {
        tab: "equipment",
        label: "Ir a Equipos",
        subtitle: "Abrir el parque de equipos",
        shortcut: "g e",
        keywords: ["equipos", "parque", "alta"],
      },
      {
        tab: "purchasing",
        label: "Ir a Compras",
        subtitle: "Abrir compras y órdenes de compra",
        shortcut: "g c",
        keywords: ["compras", "ordenes", "pedidos", "proveedores"],
      },
      {
        tab: "analytics",
        label: "Ir a Analítica",
        subtitle: "Abrir indicadores y gráficas del taller",
        shortcut: "g a",
        keywords: ["analitica", "metricas", "kpi", "estadisticas"],
      },
      {
        tab: "mailbox",
        label: "Ir a Correo",
        subtitle: "Abrir el buzón de correo",
        shortcut: "g o",
        keywords: ["correo", "buzon", "zimbra", "mensajes"],
      },
    ];

    const actions: QuickAction[] = [
      {
        id: "report-incident",
        label: "Notificar incidencia",
        subtitle: "Abrir el formulario público de nueva incidencia",
        keywords: ["nueva", "incidencia", "averia", "reportar"],
        onRun: () => {
          void navigate("/reportar");
        },
      },
    ];

    for (const item of tabMeta) {
      if (!allowed.has(item.tab)) continue;
      actions.push({
        id: `go-${item.tab}`,
        label: item.label,
        subtitle: item.subtitle,
        keywords: item.keywords,
        shortcut: item.shortcut,
        onRun: () => goToTab(item.tab),
      });
    }

    actions.push({
      id: "keyboard-shortcuts",
      label: "Ver atajos de teclado",
      subtitle: "Mostrar los atajos de navegación y correo",
      keywords: ["atajos", "teclado", "ayuda"],
      shortcut: "?",
      onRun: () => setShortcutsOpen(true),
    });

    return actions;
  }, [goToTab, navItems, navigate]);

  const navigateIfAllowed = (tab: NavId) => {
    if (navItems.some((item) => item.id === tab)) {
      goToTab(tab);
    }
  };

  useKeyboardShortcuts({
    active: !accountDeactivated,
    shortcuts: [
      {
        key: "?",
        onTrigger: () => setShortcutsOpen((prev) => !prev),
      },
    ],
    chords: [
      { prefix: "g", key: "i", onTrigger: () => navigateIfAllowed("incidents") },
      { prefix: "g", key: "p", onTrigger: () => navigateIfAllowed("requests") },
      { prefix: "g", key: "r", onTrigger: () => navigateIfAllowed("inventory") },
      { prefix: "g", key: "e", onTrigger: () => navigateIfAllowed("equipment") },
      { prefix: "g", key: "m", onTrigger: () => navigateIfAllowed("manuals") },
      { prefix: "g", key: "c", onTrigger: () => navigateIfAllowed("purchasing") },
      { prefix: "g", key: "a", onTrigger: () => navigateIfAllowed("analytics") },
      { prefix: "g", key: "o", onTrigger: () => navigateIfAllowed("mailbox") },
    ],
  });

  const { setTarget } = navigation;

  useEffect(() => {
    const unsubTables = subscribeAiShowTables(setAiTables);
    const unsubOpen = subscribeAiOpenReference((detail) => {
      if (
        detail.kind === "purchasing" ||
        /^(OC|PC)-/i.test(detail.reference)
      ) {
        goToTab("purchasing");
        return;
      }
      if (detail.kind === "manuals") {
        setTarget((prev) => ({
          ...prev,
          tab: "manuals",
          manualId: detail.id ? (detail.id as Id<"manuals">) : null,
          manualsSearch: detail.id ? "" : detail.reference,
          timestamp: Date.now(),
        }));
        return;
      }
      if (detail.kind === "parts") {
        handleSearchSelect({
          kind: "part",
          id: (detail.id ?? "") as Id<"spareParts">,
          term: detail.reference,
          title: detail.reference,
          subtitle: "",
        });
        return;
      }
      if (detail.kind === "equipment") {
        handleSearchSelect({
          kind: "equipment",
          id: (detail.id ?? "") as Id<"equipment">,
          term: detail.reference,
          title: detail.reference,
          subtitle: "",
        });
        return;
      }

      void convex
        .query(api.search.global, { query: detail.reference })
        .then((res) => {
          const groups = buildSearchGroupsFromResponse(res);
          const firstHit = groups.flatMap((g) => g.hits)[0];
          if (firstHit) {
            handleSearchSelect(firstHit);
          } else if (detail.kind === "incidents") {
            goToTab("incidents");
          } else if (detail.kind === "requests") {
            goToTab("requests");
          }
        })
        .catch(() => {});
    });
    return () => {
      unsubTables();
      unsubOpen();
    };
  }, [convex, goToTab, handleSearchSelect, setTarget]);

  if (accountDeactivated) {
    return <DashboardInactiveNotice onSignOut={() => void handleSignOut()} />;
  }

  return (
    <AbilityProvider>
      <WorkshopAiChatProvider
        enabled={!isGuest}
        activeView={MODULE_META[activeTab]?.title}
        showDebugTools={adminOk}
      >
        <div className="flex min-h-screen flex-col overflow-x-clip bg-background lg:flex-row">
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
          quickActions={quickActions}
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
          <BackgroundJobsToastBridge />
          <DashboardHeader
            sidebarCollapsed={sidebarCollapsed}
            toggleSidebar={toggleSidebar}
            roleBadge={roleBadge}
            onOpenNotification={openNotification}
            canSendMessages={can("sendMessages")}
            isGuest={isGuest}
            canSearchCatalog={can("viewInventory")}
            onSearchSelect={handleSearchSelect}
            quickActions={quickActions}
            activeTab={activeTab}
            goToTab={goToTab}
            initial={initial}
            onSignOut={() => void handleSignOut()}
            navItems={navItems}
            navBadges={navBadges}
            mobileMenuOpen={mobileMenuOpen}
            onMobileMenuOpenChange={setMobileMenuOpen}
          />

          <main
            id="contenido"
            tabIndex={-1}
            className="mx-auto w-full min-w-0 max-w-[1600px] flex-1 px-4 pb-20 pt-4 sm:px-6 sm:pt-5 lg:pb-1"
          >
            <PageHeader
              title={heading.title}
              count={heading.count}
              description={heading.description}
              actions={headerActions}
            />

            {!summaryHidden && (
              <WorkAlertNotice
                role={roles.length > 0 ? roles : role}
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

          {aiTables && (
            <AiResultsDialog
              tables={aiTables}
              onClose={() => setAiTables(null)}
            />
          )}

          <KeyboardShortcutsDialog
            open={shortcutsOpen}
            onOpenChange={setShortcutsOpen}
          />
        </div>

        <MobileBottomNav
          navItems={navItems}
          navBadges={navBadges}
          activeTab={activeTab}
          isGuest={isGuest}
          onSelectTab={goToTab}
          onOpenMenu={() => setMobileMenuOpen(true)}
        />
        </div>
      </WorkshopAiChatProvider>
    </AbilityProvider>
  );
}
