import type { api } from "@/convex/_generated/api";
import type { Capability } from "@/lib/permissions";
import {
  Archive,
  BookOpen,
  Boxes,
  CircleAlert,
  ClipboardList,
  Cpu,
  Eye,
  FileClock,
  Mail,
  PackageCheck,
  ShieldCheck,
  ShoppingCart,
  Siren,
  SlidersHorizontal,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";
import type { DashboardStatItem } from "../components/DashboardStats";
import type { PageHeaderAction } from "../components/PageHeader";
import type { RequestFilterId } from "../requests/types";
import type { NavId, NavItem } from "../types";

export type WorkshopSummaryData = typeof api.dashboard.summary._returnType;

/** Metadatos textuales de cabecera para cada módulo del panel de control. */
export const MODULE_META: Record<NavId, { title: string; description: string }> = {
  incidents: {
    title: "Incidencias",
    description:
      "Lo que se ha notificado y en qué punto está: asígnalo, verifícalo y ciérralo con su parte.",
  },
  requests: {
    title: "Peticiones de repuesto",
    description:
      "El material que pide el taller: apruébalo, entrega lo que hay en el almacén y deja rastro de cada entrega.",
  },
  purchasing: {
    title: "Compras",
    description:
      "Lo que el almacén no cubre: órdenes por proveedor y recepciones con su albarán.",
  },
  inventory: {
    title: "Repuestos",
    description:
      "El catálogo del almacén: existencias, mínimos y ubicación de cada repuesto.",
  },
  equipment: {
    title: "Equipos",
    description:
      "El inventario del taller, con modelo, número de serie y su mantenimiento preventivo.",
  },
  manuals: {
    title: "Manuales",
    description:
      "La documentación de los equipos: PDFs y notas del taller, por tipo, marca y modelo.",
  },
  machines: {
    title: "Flujos y estados",
    description:
      "Cómo avanza cada caso —incidencia, petición y compra—: de qué estado a cuál se puede ir y por qué.",
  },
  archive: {
    title: "Archivo del taller",
    description:
      "Lo cerrado y lo decidido que ya no está en el día a día: búscalo aquí o recupéralo.",
  },
  audit: {
    title: "Auditoría de documentos",
    description:
      "La trazabilidad de los documentos: quién movió qué, cuándo y desde dónde.",
  },
  users: {
    title: "Usuarios",
    description:
      "Quién entra al taller, con qué rol y desde cuándo. Las bajas se reactivan desde aquí.",
  },
  permissions: {
    title: "Roles y permisos",
    description:
      "Qué ve y qué puede modificar cada rol. Solo el administrador entra en esta pantalla.",
  },
  settings: {
    title: "Ajustes del taller",
    description:
      "Correo, archivado automático, avisos y almacenamiento, en un solo sitio.",
  },
  profile: {
    title: "Mi perfil",
    description:
      "Tu ficha en el taller: datos de contacto, incidencias asignadas y avisos.",
  },
};

export interface BuildNavItemsParams {
  can: (capability: Capability) => boolean;
  adminOk: boolean;
  isGuest: boolean;
  canSeePurchasing: boolean;
}

/** Construye la lista de navegación lateral respetando permisos y rol. */
export function buildNavItems({
  can,
  adminOk,
  isGuest,
  canSeePurchasing,
}: BuildNavItemsParams): NavItem[] {
  return [
    ...(can("viewIncidents")
      ? [
          {
            id: "incidents" as const,
            label: "Incidencias",
            icon: Siren,
            badge: 0,
          },
        ]
      : []),
    ...(can("viewRequests")
      ? [
          {
            id: "requests" as const,
            label: "Peticiones",
            icon: ClipboardList,
            badge: 0,
          },
        ]
      : []),
    ...(canSeePurchasing
      ? [
          {
            id: "purchasing" as const,
            label: "Compras",
            icon: ShoppingCart,
            badge: 0,
          },
        ]
      : []),
    ...(can("viewInventory")
      ? [
          {
            id: "inventory" as const,
            label: "Repuestos",
            icon: Boxes,
            badge: 0,
          },
        ]
      : []),
    ...(can("viewEquipment")
      ? [
          {
            id: "equipment" as const,
            label: "Equipos",
            icon: Cpu,
            badge: 0,
          },
        ]
      : []),
    ...(can("viewManuals") && !isGuest
      ? [
          {
            id: "manuals" as const,
            label: "Manuales",
            icon: BookOpen,
            badge: 0,
          },
        ]
      : []),
    ...(!isGuest
      ? [
          {
            id: "machines" as const,
            label: "Flujos y estados",
            icon: Workflow,
            badge: 0,
          },
        ]
      : []),
    ...(can("viewIncidents") || can("viewRequests")
      ? [
          {
            id: "archive" as const,
            label: "Archivo",
            icon: Archive,
            badge: 0,
          },
        ]
      : []),
    ...(adminOk && can("viewAudit")
      ? [
          {
            id: "audit" as const,
            label: "Auditoría de documentos",
            icon: FileClock,
            badge: 0,
          },
        ]
      : []),
    ...(adminOk && can("manageUsers")
      ? [
          {
            id: "users" as const,
            label: "Usuarios",
            icon: Users,
            badge: 0,
          },
        ]
      : []),
    ...(adminOk && can("configurePermissions")
      ? [
          {
            id: "permissions" as const,
            label: "Roles y permisos",
            icon: ShieldCheck,
            badge: 0,
          },
        ]
      : []),
    ...(can("manageIncidents") ||
    can("decideRequests") ||
    (adminOk && can("viewAudit"))
      ? [
          {
            id: "settings" as const,
            label: "Ajustes del taller",
            icon: SlidersHorizontal,
            badge: 0,
          },
        ]
      : []),
  ];
}

/** Calcula los contadores de badges del menú lateral a partir del resumen del taller. */
export function computeNavBadges(
  summary: WorkshopSummaryData | undefined,
): Record<NavId, number> {
  return {
    incidents: summary?.incidents.reported ?? 0,
    requests: summary?.requests.pending ?? 0,
    purchasing: summary?.purchasing.pending ?? 0,
    inventory: summary?.parts.total ?? 0,
    equipment: summary?.equipment ?? 0,
    manuals: summary?.manuals ?? 0,
    machines: 0,
    archive: 0,
    audit: 0,
    users: 0,
    permissions: 0,
    settings: 0,
    profile: 0,
  };
}

export interface BuildStatsParams {
  summary: WorkshopSummaryData | undefined;
  can: (capability: Capability) => boolean;
  openRequests: (filter: RequestFilterId) => void;
  openInventory: (lowStockOnly: boolean) => void;
}

/** Construye la tira de estadísticas rápidas del taller. */
export function buildDashboardStats({
  summary,
  can,
  openRequests,
  openInventory,
}: BuildStatsParams): DashboardStatItem[] {
  const pendingRequests = summary?.requests.pending ?? 0;
  const urgentPending = summary?.requests.urgent ?? 0;
  const withoutReference = summary?.requests.withoutReference ?? 0;
  const issuedRequests = summary?.requests.issued ?? 0;
  const lowStockParts = summary?.parts.lowStock ?? 0;
  const totalParts = summary?.parts.total ?? 0;

  return [
    ...(can("viewRequests")
      ? [
          {
            label: "Peticiones pendientes",
            value: pendingRequests,
            hint:
              pendingRequests === 0
                ? "Cola revisada, nada que aprobar"
                : [
                    urgentPending > 0 ? `${urgentPending} urgentes` : null,
                    withoutReference > 0
                      ? `${withoutReference} sin repuesto`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Ninguna urgente",
            icon: ClipboardList,
            iconClassName: "bg-signal/10 text-signal",
            go: () => openRequests("pending"),
          },
        ]
      : []),
    ...(can("viewInventory")
      ? [
          {
            label: "Repuestos con stock bajo",
            value: lowStockParts,
            hint:
              lowStockParts === 0
                ? "Todo por encima del mínimo"
                : "Por debajo del mínimo",
            icon: CircleAlert,
            iconClassName: "bg-amber-500/10 text-amber-700",
            go: () => openInventory(true),
          },
          {
            label: "Repuestos en catálogo",
            value: totalParts,
            hint: "Repuestos gestionados",
            icon: Boxes,
            iconClassName: "bg-muted text-muted-foreground",
            go: () => openInventory(false),
          },
        ]
      : []),
    ...(can("viewRequests")
      ? [
          {
            label: "Peticiones entregadas",
            value: issuedRequests,
            hint: "Material ya en manos del técnico",
            icon: PackageCheck,
            iconClassName: "bg-emerald-600/10 text-emerald-700",
            go: () => openRequests("issued"),
          },
        ]
      : []),
  ];
}

const TABS_WITHOUT_SUMMARY: ReadonlySet<NavId> = new Set([
  "profile",
  "permissions",
  "settings",
  "archive",
  "machines",
  "audit",
]);

/** Determina si la tira de resumen debe ocultarse en la vista actual. */
export function isSummaryHidden(activeTab: NavId, statsCount: number): boolean {
  return TABS_WITHOUT_SUMMARY.has(activeTab) || statsCount === 0;
}

/** Obtiene el título, descripción y contador para la cabecera de la página. */
export function getHeadingInfo(
  activeTab: NavId,
  isGuest: boolean,
  summary: WorkshopSummaryData | undefined,
): { title: string; description: string; count: number | null } {
  if (isGuest) {
    return {
      title: "Sesión de invitado",
      description:
        "Sigue una incidencia con el código que te dieron al notificarla. El resto del taller es para quien entra con su cuenta.",
      count: null,
    };
  }

  const meta = MODULE_META[activeTab];
  const count =
    activeTab === "incidents"
      ? (summary?.incidents.reported ?? null)
      : activeTab === "requests"
        ? (summary?.requests.pending ?? null)
        : activeTab === "purchasing"
          ? (summary?.purchasing.pending ?? null)
          : activeTab === "inventory"
            ? (summary?.parts.total ?? null)
            : activeTab === "equipment"
              ? (summary?.equipment ?? null)
              : activeTab === "manuals"
                ? (summary?.manuals ?? null)
                : null;

  return {
    title: meta.title,
    description: meta.description,
    count,
  };
}

export interface BuildHeaderActionsParams {
  canConfigureReport: boolean;
  onOpenWeeklyReport: () => void;
  seesAlert: boolean;
  hasStaleWork: boolean;
  alertDismissed: boolean;
  onRestoreAlert: () => void;
  canManageInventory: boolean;
  isEmpty: boolean;
  isSeedingMore: boolean;
  loading: boolean;
  onSeedMore: () => void;
}

/** Construye las acciones contextuales del menú de cabecera. */
export function buildHeaderActions({
  canConfigureReport,
  onOpenWeeklyReport,
  seesAlert,
  hasStaleWork,
  alertDismissed,
  onRestoreAlert,
  canManageInventory,
  isEmpty,
  isSeedingMore,
  loading,
  onSeedMore,
}: BuildHeaderActionsParams): PageHeaderAction[] {
  return [
    ...(canConfigureReport
      ? [
          {
            label: "Resumen semanal por correo",
            icon: Mail,
            onSelect: onOpenWeeklyReport,
          },
        ]
      : []),
    ...(seesAlert && hasStaleWork && alertDismissed
      ? [
          {
            label: "Volver a mostrar el aviso",
            icon: Eye,
            onSelect: onRestoreAlert,
          },
        ]
      : []),
    ...(canManageInventory && !isEmpty
      ? [
          {
            label: isSeedingMore
              ? "Generando datos de ejemplo…"
              : "Más datos de ejemplo",
            icon: Sparkles,
            onSelect: onSeedMore,
            disabled: isSeedingMore || loading,
            separatorBefore: true,
          },
        ]
      : []),
  ];
}
