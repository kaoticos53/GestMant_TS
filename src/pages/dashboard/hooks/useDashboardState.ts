import { createElement, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { DEFAULT_GRANTS, type Capability } from "@/lib/permissions";
import {
  DEFAULT_ROLE,
  isSystemRole,
  roleBadgeClassName,
} from "@/lib/roles";
import { cn } from "@/lib/utils";
import {
  buildDashboardStats,
  buildHeaderActions,
  buildNavItems,
  computeNavBadges,
  getHeadingInfo,
  isSummaryHidden,
} from "../constants/navConfig";
import {
  formatDocumentTitle,
  getDisplayName,
  getDisplayNameInitial,
  isAccountDeactivated,
} from "../helpers/dashboardHelpers";
import { useDashboardNavigation } from "./useDashboardNavigation";
import { useDashboardSeed } from "./useDashboardSeed";
import { useEnsureRole } from "./useEnsureRole";
import { useSidebarPanel } from "./useSidebarPanel";
import { useWorkAlertState } from "./useWorkAlertState";

export function useDashboardState() {
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
  } = useWorkAlertState(user, role);

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

  const displayName = getDisplayName(user);
  const initial = getDisplayNameInitial(displayName);

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
    document.title = formatDocumentTitle(heading.title);
  }, [heading.title]);

  const roleBadge = needsRole
    ? createElement(
        "span",
        {
          className:
            "inline-flex rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground",
        },
        "Configurando perfil...",
      )
    : createElement(
        "span",
        {
          className: cn(
            "inline-flex rounded-full border px-2.5 py-1 text-xs font-medium",
            roleBadgeClassName(role),
          ),
        },
        roleLabel,
      );

  const accountDeactivated = isAccountDeactivated(user);

  return {
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
    searchParamsCode: searchParams.get("codigo"),
    // Sidebar & Layout
    sidebarRef,
    sidebarCollapsed,
    sidebarWidth,
    sidebarResizing,
    resizeHandleProps,
    toggleSidebar,
    // Navegación
    navigation,
    navItems,
    navBadges,
    activeTab,
    goToTab,
    openIncident,
    handleSearchSelect,
    openNotification,
    // Cabecera & Estadísticas
    heading,
    headerActions,
    loading,
    stats,
    summaryHidden,
    // Alerta de trabajo
    alertRoleKeys,
    alertDays,
    staleWork,
    alertDismissed,
    dismissAlert,
    // Estado de taller y siembra
    showEmptyNotice,
    isSeeding,
    handleSeed,
    handleStartEmpty,
    // Acciones de cuenta
    handleSignOut,
    handleSwitchAccount,
    // Diálogo de informe semanal
    weeklyReportOpen,
    setWeeklyReportOpen,
  };
}
