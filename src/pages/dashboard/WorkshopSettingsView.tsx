import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Archive, Bell, Database, FolderTree, Mail, type LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { AuditAlertSettingsCard } from "./settings/AuditAlertSettingsCard";
import { AutomaticArchiveCard } from "./settings/AutomaticArchiveCard";
import { CatalogsCard } from "./settings/CatalogsCard";
import { MailAudienceCard } from "./settings/MailAudienceCard";
import { MailServerCard } from "./settings/MailServerCard";
import { StorageCleanupCard } from "./settings/StorageCleanupCard";
import { TrashCard } from "./settings/TrashCard";
import { UnusedUploadsCard } from "./settings/UnusedUploadsCard";
import { WorkAlertSettingsCard } from "./settings/WorkAlertSettingsCard";
import { WorkshopDataCard } from "./settings/WorkshopDataCard";

/**
 * Ajustes del taller: los ajustes de fondo que decide quien los gobierna,
 * organizados en pestañas temáticas para una navegación clara y compacta.
 *
 * Cada pestaña agrupa tarjetas afines y se muestra solo a quien tiene
 * permisos para configurar los elementos correspondientes:
 * - Catálogos: clasificaciones, listas y tipos del taller.
 * - Avisos: aviso de trabajo sin constancia y alertas del expediente.
 * - Almacén y archivo: archivado automático, papelera y limpieza de almacén.
 * - Correo: configuración del servidor de salida y audiencia de notificaciones.
 * - Datos del taller: datos de muestra y reinicio del taller.
 *
 * Aquí solo se ajusta, no se trabaja: el día a día sigue en sus respectivos módulos.
 */
export function WorkshopSettingsView({
  canManageArchive = false,
  canManageAlert = false,
  canManageAudit = false,
  canPurgeUploads = false,
  canManageData = false,
  canManageMail = false,
  canManageIncidents,
  canDecideRequests,
  defaultTab,
}: {
  /** Quien coordina incidencias o decide peticiones ajusta el archivo. */
  canManageArchive?: boolean;
  /** Quien coordina las incidencias ajusta el aviso de trabajo sin constancia. */
  canManageAlert?: boolean;
  /** Quien audita el expediente reparte sus avisos entre los roles. */
  canManageAudit?: boolean;
  /**
   * Quien gobierna el taller mira —y purga— lo que la noche va a barrer del
   * formulario, y ve la limpieza del almacén entera con su botón.
   */
  canPurgeUploads?: boolean;
  /**
   * Quien puede gestionar el inventario carga la muestra y vacía el taller: es
   * el permiso con el que se puso la muestra de ejemplo.
   */
  canManageData?: boolean;
  /**
   * El correo del taller lo configura —y lo prueba— el administrador: es una
   * llave del deployment y un remitente los dos, no una preferencia de cada rol.
   */
  canManageMail?: boolean;
  /** Capacidad para gestionar incidencias y verlas en la papelera. */
  canManageIncidents?: boolean;
  /** Capacidad para decidir peticiones y verlas en la papelera. */
  canDecideRequests?: boolean;
  /** Pestaña inicial a mostrar si está disponible para el usuario. */
  defaultTab?: string;
}) {
  const hasManageIncidents =
    canManageIncidents ?? (canManageAlert || canManageArchive);
  const hasDecideRequests = canDecideRequests ?? canManageArchive;
  const availableTabs = useMemo(() => {
    const list: Array<{
      id: string;
      label: string;
      icon: LucideIcon;
    }> = [{ id: "catalogs", label: "Catálogos", icon: FolderTree }];

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
  }, [
    canManageAlert,
    canManageAudit,
    canManageArchive,
    canPurgeUploads,
    canManageMail,
    canManageData,
  ]);

  const firstAvailableId = availableTabs[0]?.id ?? "catalogs";
  const [selectedTab, setSelectedTab] = useState<string>(
    defaultTab && availableTabs.some((t) => t.id === defaultTab)
      ? defaultTab
      : firstAvailableId
  );

  // Garantizar que la pestaña activa siempre sea una de las visibles para el usuario actual
  const activeTab = availableTabs.some((t) => t.id === selectedTab)
    ? selectedTab
    : firstAvailableId;

  return (
    <div className="flex flex-col gap-6">
      <Tabs
        value={activeTab}
        onValueChange={setSelectedTab}
        className="w-full space-y-6"
      >
        <div className="overflow-x-auto pb-1">
          <TabsList className="inline-flex h-auto w-auto flex-wrap items-center justify-start gap-1 p-1 bg-muted/60 border border-border/50">
            {availableTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="flex items-center gap-2 px-3.5 py-1.5 text-xs sm:text-sm font-medium transition-all"
                >
                  <Icon className="size-4 shrink-0" />
                  <span>{tab.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        <TabsContent
          value="catalogs"
          className="space-y-5 focus-visible:outline-none"
        >
          <CatalogsCard />
        </TabsContent>

        {(canManageAlert || canManageAudit) && (
          <TabsContent
            value="alerts"
            className="space-y-5 focus-visible:outline-none"
          >
            {canManageAlert && <WorkAlertSettingsCard />}
            {canManageAudit && <AuditAlertSettingsCard />}
          </TabsContent>
        )}

        {(canManageArchive || canPurgeUploads) && (
          <TabsContent
            value="storage"
            className="space-y-5 focus-visible:outline-none"
          >
            {canManageArchive && <AutomaticArchiveCard />}
            {canPurgeUploads && (
              <TrashCard
                canManageIncidents={hasManageIncidents}
                canDecideRequests={hasDecideRequests}
              />
            )}
            {canPurgeUploads && <UnusedUploadsCard />}
            {canPurgeUploads && <StorageCleanupCard />}
          </TabsContent>
        )}

        {canManageMail && (
          <TabsContent
            value="mail"
            className="space-y-5 focus-visible:outline-none"
          >
            <MailServerCard />
            <MailAudienceCard />
          </TabsContent>
        )}

        {canManageData && (
          <TabsContent
            value="data"
            className="space-y-5 focus-visible:outline-none"
          >
            <WorkshopDataCard />
          </TabsContent>
        )}
      </Tabs>

      <p className="text-xs leading-5 text-muted-foreground">
        Estas son las reglas de fondo del taller. El día a día —buscar en el
        archivo, recuperar lo archivado, trabajar las incidencias— sigue en sus
        módulos.
      </p>
    </div>
  );
}
