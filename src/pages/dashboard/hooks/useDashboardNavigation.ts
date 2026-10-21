import type { Id } from "@/convex/_generated/dataModel";
import type { Capability } from "@/lib/permissions";
import { useCallback, useMemo, useState } from "react";
import type { SearchHit } from "../GlobalSearch";
import type { RequestFilterId } from "../requests/types";
import type { NavId, NavItem, NavigationTarget } from "../types";

export const INITIAL_NAVIGATION_TARGET: NavigationTarget = {
  tab: "incidents",
  incidentId: null,
  requestId: null,
  requestsEquipmentFilter: "all",
  requestsFilter: "all",
  archiveEntry: null,
  inventorySearch: "",
  inventoryLowStockOnly: false,
  equipmentSearch: "",
  timestamp: Date.now(),
};

export function useDashboardNavigation(
  can: (capability: Capability) => boolean,
  navItems: NavItem[],
) {
  const [target, setTarget] = useState<NavigationTarget>(INITIAL_NAVIGATION_TARGET);
  const [viewKeys, setViewKeys] = useState({
    incidents: 0,
    requests: 0,
    archive: 0,
    inventory: 0,
    equipment: 0,
  });

  const activeAllowed =
    target.tab === "profile" || navItems.some((item) => item.id === target.tab);
  const fallbackTab: NavId = navItems.some((item) => item.id === "requests")
    ? "requests"
    : (navItems[0]?.id ?? "profile");
  const activeTab: NavId = activeAllowed ? target.tab : fallbackTab;

  const goToTab = useCallback((id: NavId) => {
    setTarget((prev) => ({
      ...prev,
      tab: id,
      incidentId: null,
      requestId: null,
      archiveEntry: null,
      inventorySearch: "",
      equipmentSearch: "",
      requestsFilter: "all",
      inventoryLowStockOnly: false,
      timestamp: Date.now(),
    }));
    setViewKeys((prev) => ({
      ...prev,
      incidents: prev.incidents + 1,
      requests: prev.requests + 1,
      archive: prev.archive + 1,
      inventory: prev.inventory + 1,
      equipment: prev.equipment + 1,
    }));
  }, []);

  const openRequests = useCallback((filter: RequestFilterId) => {
    setTarget((prev) => ({
      ...prev,
      tab: "requests",
      requestsFilter: filter,
      requestsEquipmentFilter: "all",
      requestId: null,
      timestamp: Date.now(),
    }));
    setViewKeys((prev) => ({ ...prev, requests: prev.requests + 1 }));
  }, []);

  const openRequest = useCallback(
    (id: Id<"partRequests">) => {
      if (!can("viewRequests")) return;
      setTarget((prev) => ({
        ...prev,
        tab: "requests",
        requestId: id,
        requestsFilter: "all",
        requestsEquipmentFilter: "all",
        timestamp: Date.now(),
      }));
      setViewKeys((prev) => ({ ...prev, requests: prev.requests + 1 }));
    },
    [can],
  );

  const openIncident = useCallback((id: Id<"incidents">) => {
    setTarget((prev) => ({
      ...prev,
      tab: "incidents",
      incidentId: id,
      timestamp: Date.now(),
    }));
    setViewKeys((prev) => ({ ...prev, incidents: prev.incidents + 1 }));
  }, []);

  const openNotification = useCallback(
    (notification: { incidentId?: Id<"incidents"> | null }) => {
      if (notification.incidentId) {
        openIncident(notification.incidentId);
      } else {
        goToTab("incidents");
      }
    },
    [goToTab, openIncident],
  );

  const openInventory = useCallback((lowStockOnly: boolean) => {
    setTarget((prev) => ({
      ...prev,
      tab: "inventory",
      inventoryLowStockOnly: lowStockOnly,
      inventorySearch: "",
      timestamp: Date.now(),
    }));
    setViewKeys((prev) => ({ ...prev, inventory: prev.inventory + 1 }));
  }, []);

  const setRequestsEquipmentFilter = useCallback((equipmentId: string) => {
    setTarget((prev) => ({ ...prev, requestsEquipmentFilter: equipmentId }));
  }, []);

  const openEquipmentViewRequests = useCallback((equipmentId: string) => {
    setTarget((prev) => ({
      ...prev,
      tab: "requests",
      requestsEquipmentFilter: equipmentId,
      requestId: null,
      timestamp: Date.now(),
    }));
    setViewKeys((prev) => ({ ...prev, requests: prev.requests + 1 }));
  }, []);

  const handleSearchSelect = useCallback(
    (hit: SearchHit) => {
      if ((hit.kind === "incident" || hit.kind === "request") && hit.archived) {
        if (!can(hit.kind === "incident" ? "viewIncidents" : "viewRequests")) {
          return;
        }
        setTarget((prev) => ({
          ...prev,
          tab: "archive",
          archiveEntry: { kind: hit.kind, id: hit.id },
          timestamp: Date.now(),
        }));
        setViewKeys((prev) => ({ ...prev, archive: prev.archive + 1 }));
        return;
      }
      if (hit.kind === "incident") {
        if (!can("viewIncidents")) return;
        setTarget((prev) => ({
          ...prev,
          tab: "incidents",
          incidentId: hit.id,
          timestamp: Date.now(),
        }));
        setViewKeys((prev) => ({ ...prev, incidents: prev.incidents + 1 }));
        return;
      }
      if (hit.kind === "request") {
        if (!can("viewRequests")) return;
        setTarget((prev) => ({
          ...prev,
          tab: "requests",
          requestId: hit.id,
          requestsFilter: "all",
          timestamp: Date.now(),
        }));
        setViewKeys((prev) => ({ ...prev, requests: prev.requests + 1 }));
        return;
      }
      if (hit.kind === "part") {
        if (!can("viewInventory")) return;
        setTarget((prev) => ({
          ...prev,
          tab: "inventory",
          inventorySearch: hit.term,
          inventoryLowStockOnly: false,
          timestamp: Date.now(),
        }));
        setViewKeys((prev) => ({ ...prev, inventory: prev.inventory + 1 }));
      } else {
        if (!can("viewEquipment")) return;
        setTarget((prev) => ({
          ...prev,
          tab: "equipment",
          equipmentSearch: hit.term,
          timestamp: Date.now(),
        }));
        setViewKeys((prev) => ({ ...prev, equipment: prev.equipment + 1 }));
      }
    },
    [can],
  );

  return useMemo(
    () => ({
      target,
      tab: target.tab,
      activeTab,
      viewKeys,
      setTarget,
      goToTab,
      openRequests,
      openRequest,
      openIncident,
      openNotification,
      openInventory,
      setRequestsEquipmentFilter,
      openEquipmentViewRequests,
      handleSearchSelect,
    }),
    [
      target,
      activeTab,
      viewKeys,
      goToTab,
      openRequests,
      openRequest,
      openIncident,
      openNotification,
      openInventory,
      setRequestsEquipmentFilter,
      openEquipmentViewRequests,
      handleSearchSelect,
    ],
  );
}

export type DashboardNavigation = ReturnType<typeof useDashboardNavigation>;
