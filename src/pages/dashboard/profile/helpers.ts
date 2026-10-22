import {
  Bell,
  Briefcase,
  MapPin,
  Package,
  Phone,
  Siren,
} from "lucide-react";
import type { ProfileMetaChip, ProfileStat } from "./types";

/** Filtra y ordena las incidencias asignadas directamente o en taller al usuario. */
export function filterUserIncidents<
  T extends {
    assigneeId?: string;
    workshopAssigneeId?: string;
    updatedAt: number;
  },
>(incidents: readonly T[], userId: string): T[] {
  return incidents
    .filter(
      (item) =>
        item.assigneeId === userId || item.workshopAssigneeId === userId,
    )
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Filtra y ordena las peticiones de repuesto creadas por el usuario (por id o nombre histórico). */
export function filterUserRequests<
  T extends {
    requesterId?: string;
    requesterName?: string;
    createdAt: number;
  },
>(requests: readonly T[], userId: string, userName?: string): T[] {
  const safeName = userName ?? "";
  return requests
    .filter(
      (item) =>
        item.requesterId === userId ||
        (item.requesterId === undefined && item.requesterName === safeName),
    )
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** Construye la inicial mayúscula del nombre o correo para el avatar. */
export function getUserInitial(user: {
  name?: string;
  email?: string;
}): string {
  const displayName = user.name || user.email || "U";
  return displayName.trim().charAt(0).toUpperCase() || "U";
}

/** Construye los chips de contacto y ubicación secundarios si están definidos. */
export function buildProfileMetaChips(user: {
  position?: string;
  location?: string;
  phone?: string;
}): ProfileMetaChip[] {
  const chips: (ProfileMetaChip | null)[] = [
    user.position ? { icon: Briefcase, text: user.position } : null,
    user.location ? { icon: MapPin, text: user.location } : null,
    user.phone ? { icon: Phone, text: user.phone } : null,
  ];
  return chips.filter((c): c is ProfileMetaChip => c !== null);
}

/** Construye las 4 tarjetas de métricas cuantitativas del perfil. */
export function buildProfileStats(input: {
  openIncidentsCount: number;
  closedIncidentsCount: number;
  myRequestsCount: number;
  pendingRequestsCount: number;
  unreadCount: number;
}): ProfileStat[] {
  return [
    {
      label: "Incidencias activas",
      value: input.openIncidentsCount,
      hint:
        input.openIncidentsCount === 0
          ? "Nada pendiente de ti"
          : "En curso o taller",
      icon: Siren,
      iconClassName: "bg-signal/10 text-signal",
    },
    {
      label: "Incidencias cerradas",
      value: input.closedIncidentsCount,
      hint: "Resueltas o sin resolución",
      icon: Briefcase,
      iconClassName: "bg-emerald-600/10 text-emerald-700",
    },
    {
      label: "Mis peticiones",
      value: input.myRequestsCount,
      hint:
        input.pendingRequestsCount > 0
          ? `${input.pendingRequestsCount} pendiente${
              input.pendingRequestsCount === 1 ? "" : "s"
            } de revisión`
          : input.myRequestsCount === 0
            ? "Todavía no has pedido material"
            : "Ninguna pendiente",
      icon: Package,
      iconClassName: "bg-amber-500/10 text-amber-700",
    },
    {
      label: "Avisos sin leer",
      value: input.unreadCount,
      hint:
        input.unreadCount === 0
          ? "Todo al día"
          : "Pulsa la campana para revisarlos",
      icon: Bell,
      iconClassName: "bg-muted text-muted-foreground",
    },
  ];
}
