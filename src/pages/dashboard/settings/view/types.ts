import type { LucideIcon } from "lucide-react";

export type WorkshopTabId =
  | "catalogs"
  | "models"
  | "alerts"
  | "storage"
  | "mail"
  | "data";

export interface WorkshopTabItem {
  id: WorkshopTabId;
  label: string;
  icon: LucideIcon;
}

export interface WorkshopSettingsPermissions {
  /** Quien coordina incidencias o decide peticiones ajusta el archivo. */
  canManageArchive?: boolean;
  /** Quien coordina las incidencias ajusta el aviso de trabajo sin constancia. */
  canManageAlert?: boolean;
  /** Quien audita el expediente reparte sus avisos entre los roles. */
  canManageAudit?: boolean;
  /** Quien gobierna el taller purga lo que la noche va a barrer del formulario y ve la limpieza del almacén. */
  canPurgeUploads?: boolean;
  /** Quien puede gestionar el inventario carga la muestra y vacía el taller. */
  canManageData?: boolean;
  /** El correo del taller lo configura y lo prueba el administrador. */
  canManageMail?: boolean;
  /** Capacidad para gestionar incidencias y verlas en la papelera. */
  canManageIncidents?: boolean;
  /** Capacidad para decidir peticiones y verlas en la papelera. */
  canDecideRequests?: boolean;
}

export interface WorkshopSettingsViewProps extends WorkshopSettingsPermissions {
  /** Pestaña inicial a mostrar si está disponible para el usuario. */
  defaultTab?: string;
}

export interface WorkshopSettingsTabsHeaderProps {
  tabs: WorkshopTabItem[];
}

export interface WorkshopSettingsTabsPanelsProps extends WorkshopSettingsPermissions {
  hasManageIncidents: boolean;
  hasDecideRequests: boolean;
}
