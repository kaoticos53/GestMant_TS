import type { Doc } from "@/convex/_generated/dataModel";
import type { LucideIcon } from "lucide-react";

/** Props de la vista de perfil de usuario. */
export interface ProfileViewProps {
  user: Doc<"users"> | null | undefined;
  onOpenIncidents: () => void;
  onOpenRequests: () => void;
}

/** Tarjeta de métrica estadística personal. */
export interface ProfileStat {
  label: string;
  value: number;
  hint: string;
  icon: LucideIcon;
  iconClassName: string;
}

/** Chip de información complementaria de contacto o ubicación. */
export interface ProfileMetaChip {
  icon: LucideIcon;
  text: string;
}

/** Props para la cabecera de perfil. */
export interface ProfileHeaderCardProps {
  user: Doc<"users">;
  roleLabel?: string;
  metaChips: ProfileMetaChip[];
  onEdit: () => void;
}

/** Props para el panel de estadísticas del perfil. */
export interface ProfileStatsGridProps {
  stats: ProfileStat[];
}

/** Props para el listado de incidencias asignadas. */
export interface ProfileIncidentsCardProps {
  incidents: Doc<"incidents">[];
  onOpenIncidents: () => void;
}

/** Props para el listado de peticiones de repuesto. */
export interface ProfileRequestsCardProps {
  requests: Doc<"partRequests">[];
  onOpenRequests: () => void;
}

/** Props para el listado de avisos recientes. */
export interface ProfileNotificationsCardProps {
  avisos: Doc<"notifications">[];
}

/** Props para el diálogo de edición de perfil. */
export interface EditProfileDialogProps {
  user: Doc<"users">;
  onClose: () => void;
}
