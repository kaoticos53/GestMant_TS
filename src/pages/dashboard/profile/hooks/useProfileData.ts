import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { isClosedIncident, isIncidentInProgress } from "@/lib/incidentFlow";
import {
  buildProfileMetaChips,
  buildProfileStats,
  filterUserIncidents,
  filterUserRequests,
} from "../helpers";

/**
 * Hook que suscribe las colas vivas de incidencias, peticiones y avisos en Convex,
 * y deriva las métricas y listados específicos del usuario en sesión.
 */
export function useProfileData(user: Doc<"users"> | null | undefined) {
  const incidents = useQuery(api.incidents.list, {}) ?? [];
  const requests = useQuery(api.partRequests.list, {}) ?? [];
  const notifications = useQuery(api.notifications.list);
  const me = useQuery(api.permissions.myPermissions);

  if (!user) {
    return {
      isLoading: true,
      myIncidents: [],
      openIncidents: [],
      closedIncidents: [],
      myRequests: [],
      pendingRequests: [],
      avisos: [],
      unreadCount: 0,
      stats: [],
      metaChips: [],
      me: undefined,
    };
  }

  const myIncidents = filterUserIncidents(incidents, user._id);
  const openIncidents = myIncidents.filter((item) =>
    isIncidentInProgress(item.status),
  );
  const closedIncidents = myIncidents.filter((item) =>
    isClosedIncident(item.status),
  );

  const myRequests = filterUserRequests(requests, user._id, user.name);
  const pendingRequests = myRequests.filter((item) => item.status === "pending");

  const avisos = notifications ?? [];
  const unreadCount = avisos.filter((item) => !item.read).length;

  const stats = buildProfileStats({
    openIncidentsCount: openIncidents.length,
    closedIncidentsCount: closedIncidents.length,
    myRequestsCount: myRequests.length,
    pendingRequestsCount: pendingRequests.length,
    unreadCount,
  });

  const metaChips = buildProfileMetaChips(user);

  return {
    isLoading: false,
    myIncidents,
    openIncidents,
    closedIncidents,
    myRequests,
    pendingRequests,
    avisos,
    unreadCount,
    stats,
    metaChips,
    me,
  };
}
