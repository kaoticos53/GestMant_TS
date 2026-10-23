import type { CSSProperties, RefObject } from "react";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * Una fila tal y como la da la consulta del backend (y como la reciben las
 * props de prueba, que las sustituyen con la misma forma).
 */
export type NotificationRow = {
  _id: Id<"notifications">;
  text: string;
  read: boolean;
  incidentId?: Id<"incidents">;
  createdAt: number;
};

export interface NotificationBellProps {
  /**
   * Se invoca al elegir un aviso. Recibe el aviso elegido —los que llevan
   * `incidentId` llevan a su ficha—; el que no lleva, al que abriría `onOpen`.
   */
  onOpen?: (notification: { incidentId?: Id<"incidents"> | null }) => void;
  className?: string;
  notifications?: NotificationRow[];
  markRead?: (args: { id: Id<"notifications"> }) => Promise<void>;
  markAllRead?: () => Promise<void>;
}

export interface NotificationTriggerButtonProps {
  open: boolean;
  unread: number;
  buttonRef: RefObject<HTMLButtonElement | null>;
  onToggle: () => void;
  onMeasure: () => void;
}

export interface NotificationItemButtonProps {
  item: NotificationRow;
  onSelect: (item: NotificationRow) => void;
}

export interface NotificationsPanelProps {
  items: readonly NotificationRow[];
  unread: number;
  panelRef: RefObject<HTMLDivElement | null>;
  panelStyle?: CSSProperties;
  onMarkAllRead: () => void;
  onSelect: (item: NotificationRow) => void;
}
