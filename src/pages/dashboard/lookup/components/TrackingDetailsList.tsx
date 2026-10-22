import type { LucideIcon } from "lucide-react";
import {
  CalendarClock,
  CheckCircle2,
  MapPin,
  Tag,
  UserRound,
} from "lucide-react";
import type { ReactNode } from "react";
import { formatDateTime, formatRelativeTime } from "@/lib/workshop";
import type { TrackingDetailsListProps } from "../types";

/** Un dato de la ficha con icono accesible y etiqueta visible. */
function Detail({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-1.5">
      <Icon
        className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
        aria-hidden
      />
      <div>
        <dt className="text-muted-foreground">{label}</dt>
        <dd className="text-foreground">{children}</dd>
      </div>
    </div>
  );
}

/** Lista de definición con los metadatos clave de la incidencia. */
export function TrackingDetailsList({ tracking }: TrackingDetailsListProps) {
  return (
    <dl className="mt-4 grid gap-x-4 gap-y-2.5 text-xs sm:grid-cols-2">
      <Detail icon={CalendarClock} label="Notificada">
        {formatDateTime(tracking.reportedAt)}
      </Detail>
      {tracking.closedAt !== null && (
        <Detail icon={CheckCircle2} label="Cerrada">
          {formatDateTime(tracking.closedAt)}{" "}
          <span className="text-muted-foreground">
            ({formatRelativeTime(tracking.closedAt)})
          </span>
        </Detail>
      )}
      {tracking.location && (
        <Detail icon={MapPin} label="Ubicación">
          {tracking.location}
        </Detail>
      )}
      {tracking.serialNumber && (
        <Detail icon={Tag} label="Número de serie">
          <span className="font-mono">{tracking.serialNumber}</span>
        </Detail>
      )}
      {(tracking.assigneeName || tracking.workshopAssigneeName) && (
        <Detail icon={UserRound} label="Quién la lleva">
          {[tracking.assigneeName, tracking.workshopAssigneeName]
            .filter(Boolean)
            .join(" · ")}
        </Detail>
      )}
    </dl>
  );
}
