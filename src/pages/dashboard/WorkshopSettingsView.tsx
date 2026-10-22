import { useMemo, useState } from "react";
import { Tabs } from "@/components/ui/tabs";
import {
  getAvailableTabs,
  resolveActiveTabId,
  resolveDerivedPermissions,
  WorkshopSettingsTabsHeader,
  WorkshopSettingsTabsPanels,
  type WorkshopSettingsViewProps,
} from "./settings/view";

/**
 * Ajustes del taller: los ajustes de fondo que decide quien los gobierna,
 * organizados en pestañas temáticas para una navegación clara y compacta.
 *
 * Cada pestaña agrupa tarjetas afines y se muestra solo a quien tiene
 * permisos para configurar los elementos correspondientes.
 * Aquí solo se ajusta, no se trabaja: el día a día sigue en sus respectivos módulos.
 */
export function WorkshopSettingsView(props: WorkshopSettingsViewProps) {
  const { defaultTab } = props;
  const availableTabs = useMemo(() => getAvailableTabs(props), [
    props.canManageAlert,
    props.canManageAudit,
    props.canManageArchive,
    props.canPurgeUploads,
    props.canManageMail,
    props.canManageData,
  ]);

  const [selectedTab, setSelectedTab] = useState<string>(() =>
    resolveActiveTabId(availableTabs, defaultTab, defaultTab),
  );

  const activeTab = resolveActiveTabId(availableTabs, selectedTab);
  const derived = resolveDerivedPermissions(props);

  return (
    <div className="flex flex-col gap-6">
      <Tabs
        value={activeTab}
        onValueChange={setSelectedTab}
        className="w-full space-y-6"
      >
        <WorkshopSettingsTabsHeader tabs={availableTabs} />
        <WorkshopSettingsTabsPanels
          {...props}
          hasManageIncidents={derived.hasManageIncidents}
          hasDecideRequests={derived.hasDecideRequests}
        />
      </Tabs>

      <p className="text-xs leading-5 text-muted-foreground">
        Estas son las reglas de fondo del taller. El día a día —buscar en el
        archivo, recuperar lo archivado, trabajar las incidencias— sigue en sus
        módulos.
      </p>
    </div>
  );
}
