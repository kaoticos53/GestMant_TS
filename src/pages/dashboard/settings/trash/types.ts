import type { WithdrawnIncidentItem } from "@/convex/_incidents/trash";
import type { WithdrawnRequestItem } from "@/convex/_partRequests/trash";
import type { TrashItem } from "@/convex/trash";

export type DeletingEntity =
  | { type: "storage"; item: TrashItem }
  | { type: "incident"; item: WithdrawnIncidentItem }
  | { type: "request"; item: WithdrawnRequestItem };

export type TrashFilter = "all" | "incidents" | "requests" | "storage";

export interface TrashCardProps {
  /** Quien coordina las incidencias puede verlas y recuperarlas en la papelera. */
  canManageIncidents?: boolean;
  /** Quien decide las peticiones de repuesto puede verlas y recuperarlas. */
  canDecideRequests?: boolean;
}
