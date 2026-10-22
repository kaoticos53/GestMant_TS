import {
  Archive,
  Bell,
  Database,
  FolderTree,
  Layers,
  Mail,
} from "lucide-react";
import type {
  WorkshopSettingsPermissions,
  WorkshopTabItem,
} from "./types";

/**
 * Resuelve permisos derivados para la gestión de incidencias y decisión de peticiones en papelera.
 */
export function resolveDerivedPermissions(permissions: WorkshopSettingsPermissions) {
  const {
    canManageAlert = false,
    canManageArchive = false,
    canManageIncidents,
    canDecideRequests,
  } = permissions;

  const hasManageIncidents =
    canManageIncidents ?? (canManageAlert || canManageArchive);
  const hasDecideRequests = canDecideRequests ?? canManageArchive;

  return { hasManageIncidents, hasDecideRequests };
}

/**
 * Determina qué pestañas de ajustes están disponibles para el usuario según sus privilegios.
 */
export function getAvailableTabs(
  permissions: WorkshopSettingsPermissions,
): WorkshopTabItem[] {
  const {
    canManageAlert = false,
    canManageAudit = false,
    canManageArchive = false,
    canPurgeUploads = false,
    canManageMail = false,
    canManageData = false,
  } = permissions;

  const list: WorkshopTabItem[] = [
    {
      id: "catalogs",
      label: "Catálogos y autocompletado",
      icon: FolderTree,
    },
    { id: "models", label: "Modelos de equipos", icon: Layers },
  ];

  if (canManageAlert || canManageAudit) {
    list.push({ id: "alerts", label: "Avisos", icon: Bell });
  }
  if (canManageArchive || canPurgeUploads) {
    list.push({ id: "storage", label: "Almacén y archivo", icon: Archive });
  }
  if (canManageMail) {
    list.push({ id: "mail", label: "Correo", icon: Mail });
  }
  if (canManageData) {
    list.push({ id: "data", label: "Datos del taller", icon: Database });
  }

  return list;
}

/**
 * Resuelve la pestaña activa asegurando que exista entre las disponibles,
 * con fallback a defaultTab o al primer tab disponible ("catalogs").
 */
export function resolveActiveTabId(
  availableTabs: WorkshopTabItem[],
  currentTab?: string,
  defaultTab?: string,
): string {
  const firstAvailableId = availableTabs[0]?.id ?? "catalogs";

  // Si hay una pestaña actual seleccionada y está entre las disponibles, usarla
  if (currentTab && availableTabs.some((t) => t.id === currentTab)) {
    return currentTab;
  }

  // Si hay una defaultTab solicitada y está disponible, usarla
  if (defaultTab && availableTabs.some((t) => t.id === defaultTab)) {
    return defaultTab;
  }

  return firstAvailableId;
}
