import { useState } from "react";
import type { ProfileViewProps } from "./profile/types";
import { useProfileData } from "./profile/hooks/useProfileData";
import { ProfileSkeleton } from "./profile/components/ProfileSkeleton";
import { ProfileHeaderCard } from "./profile/components/ProfileHeaderCard";
import { ProfileStatsGrid } from "./profile/components/ProfileStatsGrid";
import { ProfileIncidentsCard } from "./profile/components/ProfileIncidentsCard";
import { ProfileRequestsCard } from "./profile/components/ProfileRequestsCard";
import { ProfilePermissionsCard } from "./profile/components/ProfilePermissionsCard";
import { EditProfileDialog } from "./profile/dialogs/EditProfileDialog";
import { ChangePasswordDialog } from "./profile/dialogs/ChangePasswordDialog";

/**
 * Perfil del usuario: mini-dashboard con sus datos, sus incidencias
 * asignadas, sus peticiones y permisos efectivos. Se abre pulsando su nombre
 * en la barra lateral inferior.
 */
export function ProfileView({
  user,
  onOpenIncidents,
  onOpenRequests,
  onOpenIncident,
  onOpenRequest,
}: ProfileViewProps) {
  const {
    myIncidents,
    myRequests,
    stats,
    metaChips,
    me,
  } = useProfileData(user);

  const [editOpen, setEditOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  if (!user) {
    return <ProfileSkeleton />;
  }

  const canChangePassword = !user.isAnonymous && Boolean(user.email);

  return (
    <div className="flex flex-col gap-5">
      <ProfileHeaderCard
        user={user}
        roleLabel={me?.label}
        roleDetails={me?.roleDetails}
        metaChips={metaChips}
        onEdit={() => setEditOpen(true)}
        onChangePassword={
          canChangePassword ? () => setPasswordOpen(true) : undefined
        }
      />

      <ProfileStatsGrid stats={stats} />

      <div className="grid gap-4 lg:grid-cols-2">
        <ProfileIncidentsCard
          incidents={myIncidents.slice(0, 5)}
          onOpenIncidents={onOpenIncidents}
          onOpenIncident={onOpenIncident}
        />

        <ProfileRequestsCard
          requests={myRequests.slice(0, 5)}
          onOpenRequests={onOpenRequests}
          onOpenRequest={onOpenRequest}
        />
      </div>

      <ProfilePermissionsCard grants={me?.grants} />

      {editOpen && (
        <EditProfileDialog user={user} onClose={() => setEditOpen(false)} />
      )}

      {passwordOpen && (
        <ChangePasswordDialog onClose={() => setPasswordOpen(false)} />
      )}
    </div>
  );
}
