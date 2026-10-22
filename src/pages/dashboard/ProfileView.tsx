import { useState } from "react";
import type { ProfileViewProps } from "./profile/types";
import { useProfileData } from "./profile/hooks/useProfileData";
import { ProfileSkeleton } from "./profile/components/ProfileSkeleton";
import { ProfileHeaderCard } from "./profile/components/ProfileHeaderCard";
import { ProfileStatsGrid } from "./profile/components/ProfileStatsGrid";
import { ProfileIncidentsCard } from "./profile/components/ProfileIncidentsCard";
import { ProfileRequestsCard } from "./profile/components/ProfileRequestsCard";
import { ProfileNotificationsCard } from "./profile/components/ProfileNotificationsCard";
import { EditProfileDialog } from "./profile/dialogs/EditProfileDialog";

/**
 * Perfil del usuario: mini-dashboard con sus datos, sus incidencias
 * asignadas, sus peticiones y sus avisos. Se abre pulsando su nombre en la
 * barra lateral inferior.
 */
export function ProfileView({
  user,
  onOpenIncidents,
  onOpenRequests,
}: ProfileViewProps) {
  const {
    myIncidents,
    myRequests,
    avisos,
    stats,
    metaChips,
    me,
  } = useProfileData(user);

  const [editOpen, setEditOpen] = useState(false);

  if (!user) {
    return <ProfileSkeleton />;
  }

  return (
    <div className="flex flex-col gap-5">
      <ProfileHeaderCard
        user={user}
        roleLabel={me?.label}
        metaChips={metaChips}
        onEdit={() => setEditOpen(true)}
      />

      <ProfileStatsGrid stats={stats} />

      <div className="grid gap-4 lg:grid-cols-2">
        <ProfileIncidentsCard
          incidents={myIncidents.slice(0, 5)}
          onOpenIncidents={onOpenIncidents}
        />

        <ProfileRequestsCard
          requests={myRequests.slice(0, 5)}
          onOpenRequests={onOpenRequests}
        />
      </div>

      <ProfileNotificationsCard avisos={avisos.slice(0, 4)} />

      {editOpen && (
        <EditProfileDialog user={user} onClose={() => setEditOpen(false)} />
      )}
    </div>
  );
}
