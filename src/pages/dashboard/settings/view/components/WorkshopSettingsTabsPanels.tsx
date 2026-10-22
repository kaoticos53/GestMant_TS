import { TabsContent } from "@/components/ui/tabs";
import { AuditAlertSettingsCard } from "@/pages/dashboard/settings/AuditAlertSettingsCard";
import { AutomaticArchiveCard } from "@/pages/dashboard/settings/AutomaticArchiveCard";
import { CatalogsCard } from "@/pages/dashboard/settings/CatalogsCard";
import { EquipmentModelsCard } from "@/pages/dashboard/settings/EquipmentModelsCard";
import { MailAudienceCard } from "@/pages/dashboard/settings/MailAudienceCard";
import { MailServerCard } from "@/pages/dashboard/settings/MailServerCard";
import { StorageCleanupCard } from "@/pages/dashboard/settings/StorageCleanupCard";
import { TrashCard } from "@/pages/dashboard/settings/TrashCard";
import { UnusedUploadsCard } from "@/pages/dashboard/settings/UnusedUploadsCard";
import { WorkAlertSettingsCard } from "@/pages/dashboard/settings/WorkAlertSettingsCard";
import { WorkshopDataCard } from "@/pages/dashboard/settings/WorkshopDataCard";
import type { WorkshopSettingsTabsPanelsProps } from "../types";

export function WorkshopSettingsTabsPanels({
  canManageArchive = false,
  canManageAlert = false,
  canManageAudit = false,
  canPurgeUploads = false,
  canManageData = false,
  canManageMail = false,
  hasManageIncidents,
  hasDecideRequests,
}: WorkshopSettingsTabsPanelsProps) {
  return (
    <>
      <TabsContent
        value="catalogs"
        className="space-y-6 focus-visible:outline-none"
      >
        <CatalogsCard />
      </TabsContent>

      <TabsContent
        value="models"
        className="space-y-6 focus-visible:outline-none"
      >
        <EquipmentModelsCard />
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
    </>
  );
}
