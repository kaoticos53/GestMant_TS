import { createElement, useEffect, useRef, useState } from "react";
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
import type { NavId } from "../types";

const VALID_NAV_IDS: ReadonlySet<string> = new Set([
  "analytics",
  "incidents",
  "requests",
  "purchasing",
  "inventory",
  "equipment",
  "manuals",
  "machines",
  "archive",
  "mailbox",
  "audit",
  "users",
  "permissions",
  "settings",
  "profile",
]);

export function useDashboardState() {
  const { user, signOut } = useAuth();
  const isGuest = user?.isAnonymous === true;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const { role, roles, roleLabel, adminOk, needsRole } = useEnsureRole(
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
  // El QR de una etiqueta abre el panel con el código ya escrito en el buscador
  // del módulo que toca: `?equipo=` lleva a los equipos y `?repuesto=` al
  // almacén. Se lee una sola vez, al montar; después manda la navegación.
  const [initialTarget] = useState(() => {
    const equipment = searchParams.get("equipo")?.trim();
    const part = searchParams.get("repuesto")?.trim();
    const tabParam = searchParams.get("tab")?.trim();
    if (equipment) {
      return { tab: "equipment" as const, equipmentSearch: equipment };
    }
    if (part) return { tab: "inventory" as const, inventorySearch: part };
    if (tabParam && VALID_NAV_IDS.has(tabParam)) {
      return { tab: tabParam as NavId };
    }
    return {};
  });
  const navigation = useDashboardNavigation(can, navItems, initialTarget);
  const {
    activeTab,
    goToTab,
    openIncident,
    handleSearchSelect,
    openNotification,
  } = navigation;

  // Sincronización bidireccional URL (?tab=…) <-> pestaña activa y scroll superior al navegar
  const urlTab = searchParams.get("tab");
  const prevTabRef = useRef<NavId>(activeTab);
  const prevUrlTabRef = useRef<string | null>(urlTab);

  useEffect(() => {
    if (urlTab !== prevUrlTabRef.current) {
      prevUrlTabRef.current = urlTab;
      if (urlTab && VALID_NAV_IDS.has(urlTab) && urlTab !== activeTab) {
        prevTabRef.current = urlTab as NavId;
        goToTab(urlTab as NavId);
      }
      return;
    }

    if (activeTab !== prevTabRef.current) {
      prevTabRef.current = activeTab;
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0 });
      }
      if (
        urlTab !== activeTab ||
        searchParams.has("equipo") ||
        searchParams.has("repuesto")
      ) {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete("equipo");
        nextParams.delete("repuesto");
        nextParams.set("tab", activeTab);
        prevUrlTabRef.current = activeTab;
        setSearchParams(nextParams, { replace: false });
      }
    }
  }, [activeTab, goToTab, searchParams, setSearchParams, urlTab]);

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
  } = useWorkAlertState(user, roles.length > 0 ? roles : role);

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
